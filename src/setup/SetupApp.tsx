import { useEffect, useMemo, useState } from 'react';
import './SetupApp.css';
import FileDrop from './FileDrop';
import ReviewCanvas from './ReviewCanvas';
import LivePreview from './LivePreview';
import ExportPanel from './ExportPanel';
import { runDetectionPipeline } from './pipeline';
import { validateDraftPins, type ValidationError } from './validation';
import type { DraftPin, PipelineProgress } from './types';

/**
 * SetupApp — the floor-plan admin root (TOOL-01 + TOOL-02 + TOOL-04 wiring).
 *
 * Flow:
 *   upload → Detect → review (drag / edit / delete / add) → Approve → approved
 *
 * `mode`:
 *   - 'idle'      → no image yet OR image loaded but Detect not yet clicked
 *   - 'detecting' → pipeline running (buttons disabled)
 *   - 'review'    → draft pins rendered; admin can edit + Approve
 *   - 'approved'  → ReviewCanvas locked (disabled=true); ExportPanel rendered
 *                   alongside the LivePreview so the admin can still see the
 *                   final layout while downloading.
 *
 * Approve handler (D-15): runs validateDraftPins. On failure → stays in review
 * with the error list rendered inline above the canvas. On success → mode
 * flips to 'approved' and ExportPanel replaces the Approve/Start-over row.
 *
 * StrictMode / single-flight / blob-URL lifecycle notes preserved from plan
 * 05-05 — see the prior SetupApp.tsx comments for the detailed rationale.
 */

type SetupMode = 'idle' | 'detecting' | 'review' | 'approved';

export default function SetupApp(): JSX.Element {
  const [uploadedBitmap, setUploadedBitmap] = useState<ImageBitmap | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [draftPins, setDraftPins] = useState<DraftPin[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [status, setStatus] = useState<PipelineProgress | null>(null);
  const [mode, setMode] = useState<SetupMode>('idle');
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );

  // Revoke the previous object URL whenever it's replaced or the component
  // unmounts. The cleanup captures the URL value at the time the effect ran,
  // so a later-replaced URL will be revoked correctly.
  useEffect(() => {
    if (uploadedImageUrl === null) return;
    const url = uploadedImageUrl;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [uploadedImageUrl]);

  // Clear the validation error banner whenever the pins change — once the
  // admin starts correcting issues, the old error list becomes misleading.
  // The Approve button re-runs validation on the next click so nothing is
  // lost.
  useEffect(() => {
    setValidationErrors([]);
  }, [draftPins]);

  // Pin-status counts for the summary bar — cheap derived state.
  const pinStatusCounts = useMemo(() => {
    const counts = { ok: 0, low: 0, needs: 0 };
    for (const pin of draftPins) {
      if (pin.status === 'ok') counts.ok += 1;
      else if (pin.status === 'low-confidence') counts.low += 1;
      else if (pin.status === 'needs-number') counts.needs += 1;
    }
    return counts;
  }, [draftPins]);

  // The review canvas's selected pin feeds into LivePreview's focused-table
  // spotlight. Empty string = no highlight (the FloorPlan's default branch).
  const focusedTableNumber = useMemo(() => {
    if (selectedPinId === null) return '';
    const pin = draftPins.find((p) => p.id === selectedPinId);
    return pin?.tableNumber ?? '';
  }, [selectedPinId, draftPins]);

  function handleImageReady(
    bitmap: ImageBitmap,
    fileName: string,
    objectUrl: string,
  ): void {
    // useEffect cleanup will revoke the *previous* URL when uploadedImageUrl
    // is replaced — we don't need to revoke here.
    setUploadedBitmap(bitmap);
    setUploadedFileName(fileName);
    setUploadedImageUrl(objectUrl);
    setDraftPins([]);
    setSelectedPinId(null);
    setStatus(null);
    setMode('idle');
    setError(null);
    setValidationErrors([]);
  }

  function handleUploadError(message: string): void {
    setError(message);
  }

  async function handleDetect(): Promise<void> {
    if (uploadedBitmap === null || uploadedFileName === null) return;
    if (mode === 'detecting') return; // single-flight guard (Pitfall 2)
    setMode('detecting');
    setError(null);
    setStatus({ stage: 'preparing', message: 'Preparing image...' });
    try {
      const pins = await runDetectionPipeline(
        uploadedBitmap,
        uploadedFileName,
        (p) => setStatus(p),
      );
      setDraftPins(pins);
      setMode('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Detection failed');
      setMode('idle');
    }
  }

  function handleReupload(): void {
    // The useEffect cleanup revokes the object URL when we null it out.
    setUploadedBitmap(null);
    setUploadedFileName(null);
    setUploadedImageUrl(null);
    setDraftPins([]);
    setSelectedPinId(null);
    setStatus(null);
    setMode('idle');
    setError(null);
    setValidationErrors([]);
  }

  function handleApprove(): void {
    const result = validateDraftPins(draftPins);
    if (!result.ok) {
      setValidationErrors(result.errors);
      return; // stay in review
    }
    setValidationErrors([]);
    setMode('approved');
  }

  function handleBackToEdit(): void {
    setValidationErrors([]);
    setMode('review');
  }

  function handleEditPin(pinId: string): void {
    setSelectedPinId(pinId);
    // Scroll the pin into view so the admin can see what they're fixing.
    // We defer to next tick so any re-render from setSelectedPinId has landed.
    setTimeout(() => {
      const pinEl = document.querySelector(
        `[data-pin-id="${pinId}"]`,
      ) as HTMLElement | null;
      if (pinEl && typeof pinEl.scrollIntoView === 'function') {
        pinEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  }

  // Status line text — the OCR stage prints "(done/total)" so long runs show
  // "Reading circle numbers... (12/54)" style progress.
  const statusLine =
    status === null
      ? ''
      : typeof status.done === 'number' && typeof status.total === 'number'
        ? `${status.message} (${status.done}/${status.total})`
        : status.message;

  const hasUpload = uploadedBitmap !== null && uploadedImageUrl !== null;
  const canApprove = draftPins.length > 0;
  const isApproved = mode === 'approved';
  const isReviewing = mode === 'review' || mode === 'approved';

  return (
    <main className="setup-app">
      <div className="setup-card">
        <h1>Setup tool</h1>
        <p className="setup-subtitle">
          Floor-plan admin — route obscurity only, DO NOT share this URL.
        </p>

        {error !== null && (
          <div className="setup-error-card" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="setup-retry-button"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {!hasUpload && (
          <FileDrop onImageReady={handleImageReady} onError={handleUploadError} />
        )}

        {hasUpload && !isReviewing && (
          <div className="setup-preflight">
            <p className="setup-preflight-filename">
              <strong>Loaded:</strong> {uploadedFileName} (
              {uploadedBitmap?.width}×{uploadedBitmap?.height})
            </p>
            <div className="setup-preflight-actions">
              <button
                type="button"
                className="setup-detect-button"
                onClick={handleDetect}
                disabled={mode === 'detecting'}
              >
                {mode === 'detecting' ? 'Detecting...' : 'Detect tables'}
              </button>
              <button
                type="button"
                className="setup-reupload-button"
                onClick={handleReupload}
                disabled={mode === 'detecting'}
              >
                Re-upload
              </button>
            </div>
            {statusLine !== '' && (
              <p className="setup-status-line" aria-live="polite">
                {statusLine}
              </p>
            )}
          </div>
        )}

        {hasUpload && isReviewing && uploadedImageUrl !== null && (
          <div className="setup-review">
            <div className="setup-review-summary">
              <p className="setup-review-summary-headline">
                {isApproved ? 'Approved layout' : 'Found'}{' '}
                <strong>{draftPins.length}</strong> table
                {draftPins.length === 1 ? '' : 's'}.
                {isApproved
                  ? ' Download the JSON below — edits are locked.'
                  : ' Review, correct, then approve below.'}
              </p>
              <p className="setup-review-summary-counts">
                <span className="setup-count setup-count--ok">
                  {pinStatusCounts.ok} OK
                </span>{' '}
                <span className="setup-count setup-count--low">
                  {pinStatusCounts.low} low-confidence
                </span>{' '}
                <span className="setup-count setup-count--needs">
                  {pinStatusCounts.needs} needs number
                </span>
              </p>
            </div>

            {validationErrors.length > 0 && !isApproved && (
              <div className="setup-validation-errors" role="alert">
                <p className="setup-validation-errors-headline">
                  <strong>
                    Can&apos;t approve yet — {validationErrors.length} issue
                    {validationErrors.length === 1 ? '' : 's'} to fix:
                  </strong>
                </p>
                <ul className="setup-validation-errors-list">
                  {validationErrors.map((err, idx) => (
                    <li key={`${err.kind}:${err.pinId}:${idx}`}>
                      <span className="setup-validation-errors-kind">
                        {err.kind}
                      </span>{' '}
                      — {err.detail}{' '}
                      <button
                        type="button"
                        className="setup-validation-errors-link"
                        onClick={() => handleEditPin(err.pinId)}
                      >
                        Edit pin
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="setup-review-grid">
              <div className="setup-review-pane">
                <h2 className="setup-pane-title">
                  {isApproved ? 'Approved (locked)' : 'Review'}
                </h2>
                <ReviewCanvas
                  imageUrl={uploadedImageUrl}
                  imageNaturalWidth={uploadedBitmap?.width ?? 1}
                  imageNaturalHeight={uploadedBitmap?.height ?? 1}
                  pins={draftPins}
                  selectedPinId={selectedPinId}
                  onChange={setDraftPins}
                  onSelect={setSelectedPinId}
                  disabled={isApproved}
                />
              </div>
              <div className="setup-review-pane">
                <h2 className="setup-pane-title">Live preview</h2>
                <LivePreview
                  pins={draftPins}
                  imageUrl={uploadedImageUrl}
                  imageFileName={uploadedFileName ?? 'floor-plan'}
                  focusedTableNumber={focusedTableNumber}
                />
              </div>
            </div>

            {isApproved ? (
              <ExportPanel
                pins={draftPins}
                imageFileName={uploadedFileName ?? 'floor-plan.png'}
                onBack={handleBackToEdit}
              />
            ) : (
              <div className="setup-review-actions">
                <button
                  type="button"
                  className="setup-approve-button"
                  onClick={handleApprove}
                  disabled={!canApprove}
                  title={
                    canApprove
                      ? 'Validate pins, then lock + export'
                      : 'Add at least one pin before approving'
                  }
                >
                  Approve + export
                </button>
                <button
                  type="button"
                  className="setup-reupload-button"
                  onClick={handleReupload}
                >
                  Start over
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
