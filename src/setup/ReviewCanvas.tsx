/**
 * src/setup/ReviewCanvas.tsx — draft-pin overlay + interaction surface (D-12).
 *
 * The review canvas is where detection correctness is earned: the admin drags
 * mis-placed pins, types over wrong numbers, deletes false positives, and
 * adds missed tables. It is the central UI of plan 05-05.
 *
 * Interaction model:
 *  - DRAG     — pointerdown on a pin → pointermove updates (x,y) fractions
 *               relative to the container. `setPointerCapture` keeps the
 *               drag alive even if the cursor leaves the pin (important for
 *               touch + pen).
 *  - CLICK    — a pointerdown/up pair with <150ms duration AND <4px travel
 *               is treated as a "select + edit" click; the inline editor
 *               seeded with the pin's current tableNumber opens.
 *  - DELETE   — hover-visible `×` button per pin. Keyboard Backspace/Delete
 *               when a pin is selected (pin button takes focus).
 *  - ADD      — toggle "Add pin" mode, then click on empty canvas space to
 *               drop a new DraftPin at fraction coordinates; editor opens
 *               immediately so the admin can type the number.
 *
 * Coordinate discipline:
 *  - The container is the reference frame; pointer positions are converted to
 *    0..1 fractions of containerRect. Scrolling the container is handled
 *    because we use clientX/clientY AGAINST the container's live
 *    getBoundingClientRect — no stale measurements.
 *
 * Pin visuals (D-11):
 *  - `status='ok'`             → red teardrop (reuses the FloorPlan palette).
 *  - `status='low-confidence'` → orange-outline variant (warning).
 *  - `status='needs-number'`   → slate circle with a `?` (placeholder).
 *
 * References:
 *  - .planning/phases/05-setup-tooling/05-CONTEXT.md D-11, D-12, D-14
 *  - src/components/FloorPlan.tsx — pin-assigned teardrop SVG path (reused)
 */

import { useMemo, useRef, useState } from 'react';
import './ReviewCanvas.css';
import { findDuplicatePositions } from './dupWarning';
import type { DraftPin } from './types';

/** Threshold (ms + px) that separates a click from a drag. Matches the touch
 *  UX conventions used in MapView — generous enough to tolerate jitter. */
const CLICK_MAX_DURATION_MS = 180;
const CLICK_MAX_TRAVEL_PX = 4;

export interface ReviewCanvasProps {
  imageUrl: string;
  imageNaturalWidth: number;
  imageNaturalHeight: number;
  pins: DraftPin[];
  selectedPinId: string | null;
  onChange: (next: DraftPin[]) => void;
  onSelect: (pinId: string | null) => void;
  /** When true, all interaction is disabled (post-approve mode, plan 05-06). */
  disabled?: boolean;
}

/** Shape returned from our internal pointer tracker — encapsulates the
 *  click-vs-drag distinction in one place. */
interface PointerTracker {
  pinId: string;
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
}

/**
 * Teardrop SVG path reused from FloorPlan.tsx. Factored here as a constant
 * string so the three visual variants (ok / low-confidence / needs-number)
 * share the path without duplicating the `d` attribute. The visual variant
 * comes from CSS (.review-pin--ok / --low-confidence / --needs-number fill
 * + stroke rules).
 */
const TEARDROP_D =
  'M18 0 C8 0 0 8 0 18 C0 28 18 44 18 44 C18 44 36 28 36 18 C36 8 28 0 18 0 Z';

export default function ReviewCanvas({
  imageUrl,
  imageNaturalWidth,
  imageNaturalHeight,
  pins,
  selectedPinId,
  onChange,
  onSelect,
  disabled = false,
}: ReviewCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackerRef = useRef<PointerTracker | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Recompute duplicate pairs on every pin change — fast enough (§dupWarning
  // O(n²) on ≤100 pins is sub-millisecond). Memoized only for React key
  // stability on the warning list items.
  const duplicatePairs = useMemo(() => findDuplicatePositions(pins), [pins]);

  /** Convert a pointer clientX/clientY to 0..1 fractions of the container. */
  function fractionFromPointer(clientX: number, clientY: number): { x: number; y: number } | null {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    return {
      x: Math.min(1, Math.max(0, fx)),
      y: Math.min(1, Math.max(0, fy)),
    };
  }

  /** Commit the inline editor value back to the pin. */
  function commitEdit(pinId: string, rawValue: string): void {
    const digits = rawValue.replace(/[^0-9]/g, '');
    const tableNumber = digits.length > 0 ? digits : null;
    const nextPins = pins.map((p) => {
      if (p.id !== pinId) return p;
      // Status transitions: supplying a number clears 'needs-number', and we
      // treat any admin-supplied number as 'ok' (the admin has vouched for
      // it; the OCR confidence is no longer authoritative).
      const nextStatus: DraftPin['status'] =
        tableNumber === null ? 'needs-number' : 'ok';
      return { ...p, tableNumber, status: nextStatus };
    });
    onChange(nextPins);
    setEditingPinId(null);
    setEditValue('');
  }

  /** Cancel the inline editor without committing. */
  function cancelEdit(): void {
    setEditingPinId(null);
    setEditValue('');
  }

  /** Open the inline editor for a pin, seeded with its current tableNumber. */
  function openEditor(pin: DraftPin): void {
    setEditingPinId(pin.id);
    setEditValue(pin.tableNumber ?? '');
  }

  /** Delete a pin by id. */
  function deletePin(pinId: string): void {
    onChange(pins.filter((p) => p.id !== pinId));
    if (selectedPinId === pinId) onSelect(null);
    if (editingPinId === pinId) cancelEdit();
  }

  /* ---------------- Pin pointer handlers (drag + click) ---------------- */

  function onPinPointerDown(e: React.PointerEvent<HTMLDivElement>, pin: DraftPin): void {
    if (disabled) return;
    // Avoid capturing on the '×' delete button click — it bubbles.
    if ((e.target as HTMLElement).closest('.review-pin-delete') !== null) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* jsdom + some browsers reject setPointerCapture without a real pointer */
    }
    trackerRef.current = {
      pinId: pin.id,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      moved: false,
    };
    onSelect(pin.id);
  }

  function onPinPointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const tracker = trackerRef.current;
    if (!tracker) return;
    const dx = Math.abs(e.clientX - tracker.startX);
    const dy = Math.abs(e.clientY - tracker.startY);
    if (!tracker.moved && Math.max(dx, dy) > CLICK_MAX_TRAVEL_PX) {
      tracker.moved = true;
    }
    if (tracker.moved) {
      const frac = fractionFromPointer(e.clientX, e.clientY);
      if (frac === null) return;
      const nextPins = pins.map((p) =>
        p.id === tracker.pinId ? { ...p, x: frac.x, y: frac.y } : p,
      );
      onChange(nextPins);
    }
  }

  function onPinPointerUp(e: React.PointerEvent<HTMLDivElement>, pin: DraftPin): void {
    const tracker = trackerRef.current;
    if (!tracker) return;
    const duration = performance.now() - tracker.startTime;
    const shortAndStill = !tracker.moved && duration < CLICK_MAX_DURATION_MS;
    trackerRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer may have already been released — ignore */
    }
    if (shortAndStill) {
      openEditor(pin);
    }
  }

  /* ---------------- Container pointer handler (add mode) ---------------- */

  function onContainerPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (disabled) return;
    // Only fire for clicks on the CONTAINER surface itself (not pins or ×
    // buttons which stop propagation above).
    if ((e.target as HTMLElement).closest('.review-pin') !== null) return;

    const isAddClick = addMode || e.shiftKey;
    if (!isAddClick) return;

    const frac = fractionFromPointer(e.clientX, e.clientY);
    if (frac === null) return;
    const newPin: DraftPin = {
      id: crypto.randomUUID(),
      x: frac.x,
      y: frac.y,
      detectedRadius: 0.02, // default pin visual size — doesn't affect export
      tableNumber: null,
      confidence: 100, // admin-supplied; no OCR confidence applies
      status: 'needs-number',
    };
    onChange([...pins, newPin]);
    onSelect(newPin.id);
    openEditor(newPin);
    setAddMode(false);
  }

  /* ---------------- Keyboard handlers (delete selected pin) ---------------- */

  function onPinKeyDown(e: React.KeyboardEvent<HTMLDivElement>, pin: DraftPin): void {
    if (disabled) return;
    if (editingPinId === pin.id) return; // editor handles its own keys
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      deletePin(pin.id);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openEditor(pin);
    }
  }

  function onEditorKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    pin: DraftPin,
  ): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(pin.id, editValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }

  /* ------------------------------- Render ------------------------------- */

  return (
    <div className="review-canvas-root">
      {duplicatePairs.length > 0 && (
        <div className="review-dup-warning" role="status">
          <strong>Duplicate positions detected.</strong>{' '}
          <span>
            {duplicatePairs.length === 1
              ? '1 pair of pins is within 3% of each other.'
              : `${duplicatePairs.length} pairs of pins are within 3% of each other.`}{' '}
            Review and delete the duplicates.
          </span>
          <ul className="review-dup-warning-list">
            {duplicatePairs.map((pair) => {
              const a = pins.find((p) => p.id === pair.pinId);
              const b = pins.find((p) => p.id === pair.otherPinId);
              const aLabel = a?.tableNumber ?? '?';
              const bLabel = b?.tableNumber ?? '?';
              return (
                <li key={`${pair.pinId}::${pair.otherPinId}`}>
                  Pins “{aLabel}” and “{bLabel}” are close together —
                  consider deleting one.
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="review-canvas-toolbar">
        <button
          type="button"
          className={`review-addmode-toggle ${addMode ? 'is-active' : ''}`}
          onClick={() => setAddMode((v) => !v)}
          disabled={disabled}
          aria-pressed={addMode}
        >
          {addMode ? 'Click image to add pin — click again to cancel' : 'Add pin'}
        </button>
        <span className="review-canvas-hint">
          Tip: hold Shift + click to add a pin. Click a pin to edit its
          number, drag to move, × to delete.
        </span>
      </div>

      <div
        ref={containerRef}
        className={`review-canvas ${addMode ? 'is-addmode' : ''}`}
        onPointerDown={onContainerPointerDown}
        data-testid="review-canvas-container"
        // Inline aspect-ratio so the container tracks the uploaded image's
        // proportions exactly. Combined with max-width: 100% and max-height:
        // 85vh in the stylesheet, the container shrinks on the constrained
        // axis and the other axis resolves via the aspect ratio — so the
        // full image is always visible and % pin coords stay aligned.
        style={{
          aspectRatio: `${imageNaturalWidth} / ${imageNaturalHeight}`,
        }}
      >
        <img
          src={imageUrl}
          alt="Uploaded floor plan under review"
          className="review-canvas-image"
          draggable={false}
        />
        {pins.map((pin) => {
          const isSelected = pin.id === selectedPinId;
          const isEditing = pin.id === editingPinId;
          const label = pin.tableNumber ?? '?';
          return (
            <div
              key={pin.id}
              className={`review-pin review-pin--${pin.status}${isSelected ? ' is-selected' : ''}`}
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`Pin ${label} (${pin.status})`}
              data-pin-id={pin.id}
              onPointerDown={(e) => onPinPointerDown(e, pin)}
              onPointerMove={onPinPointerMove}
              onPointerUp={(e) => onPinPointerUp(e, pin)}
              onKeyDown={(e) => onPinKeyDown(e, pin)}
            >
              {pin.status === 'needs-number' ? (
                <div className="review-pin-placeholder" aria-hidden="true">
                  <span className="review-pin-label">?</span>
                </div>
              ) : (
                <svg
                  className="review-pin-svg"
                  viewBox="0 0 36 44"
                  aria-hidden="true"
                >
                  <path d={TEARDROP_D} />
                </svg>
              )}
              {pin.status !== 'needs-number' && (
                <span className="review-pin-label">{label}</span>
              )}
              <button
                type="button"
                className="review-pin-delete"
                aria-label={`Delete pin ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  deletePin(pin.id);
                }}
                disabled={disabled}
              >
                ×
              </button>
              {isEditing && (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="review-pin-editor"
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => onEditorKeyDown(e, pin)}
                  onBlur={() => commitEdit(pin.id, editValue)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Edit number for pin ${label}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
