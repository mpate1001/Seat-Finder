import { useRef } from 'react';
import { useTransformComponent } from 'react-zoom-pan-pinch';
import './FloorPlan.css';
import floorPlanConfig from '../config/floorPlan.json';

interface TablePosition {
  x: number;
  y: number;
}

// Exported so setup tooling (plans 05-05 LivePreview + 05-06 exportConfig) can
// import the single-source-of-truth config contract. Guest path and setup path
// both flow through this interface — widening it requires updating both.
export interface FloorPlanConfig {
  imageFileName: string;
  tablePositions: Record<string, TablePosition>;
}

interface FloorPlanProps {
  tableNumber: string;
  // Forwarded by MapView: the ref is attached to the assigned table's pin div
  // so the zoom animation can target it. Typed as React.Ref (not React.RefObject)
  // so a MutableRefObject from useRef<HTMLDivElement | null>(null) and callback
  // refs both satisfy the intrinsic <div ref={...}> prop under React 18 strict.
  assignedPinRef: React.Ref<HTMLDivElement>;
  onImageLoad: () => void;
  // Optional — when omitted, falls back to the imported floorPlan.json so the
  // guest code path behaves byte-identically. Setup's LivePreview passes a
  // synthetic config derived from draft pins (D-13).
  config?: FloorPlanConfig;
  // Optional — when provided, a plain <img src={imageSrc}/> is rendered
  // instead of the <picture> with AVIF/WebP/PNG srcsets. Setup's LivePreview
  // passes a blob: URL produced from the admin-uploaded file.
  imageSrc?: string;
}

const defaultConfig: FloorPlanConfig = floorPlanConfig;

const AVIF_SRCSET =
  '/floor-plan/floor-plan-900.avif 900w, /floor-plan/floor-plan-1600.avif 1600w, /floor-plan/floor-plan-2400.avif 2400w';
const WEBP_SRCSET =
  '/floor-plan/floor-plan-900.webp 900w, /floor-plan/floor-plan-1600.webp 1600w, /floor-plan/floor-plan-2400.webp 2400w';
const PNG_SRCSET =
  '/floor-plan/floor-plan-900.png 900w, /floor-plan/floor-plan-1600.png 1600w, /floor-plan/floor-plan-2400.png 2400w';
const PNG_FALLBACK_SRC = '/floor-plan/floor-plan-1600.png';

/**
 * Returns one warning string per duplicate (x,y) coordinate pair in the
 * supplied config. Extracted from the component body so tests can assert
 * behavior without mocking `import.meta.env.DEV`. Called from within the
 * component behind a DEV gate; called directly by tests.
 *
 * Exporting a plain function from this component module violates the
 * react-refresh/only-export-components rule, but this is intentional: the
 * pure helper is used by the DEV warning branch and by unit tests. HMR fast
 * refresh works correctly for the component default export either way.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function warnDuplicatePositions(config: FloorPlanConfig): string[] {
  const warnings: string[] = [];
  const seen = new Map<string, string>();
  for (const [id, pos] of Object.entries(config.tablePositions)) {
    const key = `${pos.x.toFixed(4)},${pos.y.toFixed(4)}`;
    const prior = seen.get(key);
    if (prior !== undefined) {
      warnings.push(`Duplicate table position: ${id} and ${prior} at ${key}`);
    } else {
      seen.set(key, id);
    }
  }
  return warnings;
}

// Module-load DEV warning for the DEFAULT (imported JSON) config — retained
// from Phase 1 as a bundle-time regression guard. The component body adds a
// per-effective-config warning pass for setup-path live-preview configs.
if (import.meta.env.DEV) {
  for (const msg of warnDuplicatePositions(defaultConfig)) {
    console.warn(msg);
  }
}

export default function FloorPlan({
  tableNumber,
  assignedPinRef,
  onImageLoad,
  config = defaultConfig,
  imageSrc,
}: FloorPlanProps) {
  // DEV: warn once per distinct effective config identity. A ref-backed Set
  // gates the call so guest renders (config === defaultConfig, stable) emit at
  // most one warning, and setup renders only re-warn when the memoized config
  // object actually changes (pin add/delete/drag → new object from useMemo).
  const warnedConfigsRef = useRef<Set<FloorPlanConfig>>(new Set());
  if (import.meta.env.DEV && !warnedConfigsRef.current.has(config)) {
    warnedConfigsRef.current.add(config);
    // Skip re-emitting for the defaultConfig: module-load already warned once
    // for it above; a second pass here would double-log in DEV.
    if (config !== defaultConfig) {
      for (const msg of warnDuplicatePositions(config)) {
        console.warn(msg);
      }
    }
  }

  // Adaptive label visibility (D-09). useTransformComponent re-runs cheaply on every
  // transform state change; we toggle a single class on the wrapper and let CSS drive
  // the fade (no per-marker re-render).
  return useTransformComponent(({ state }) => {
    const labelsVisible = state.scale >= 1.8;
    return (
      <div
        className={`floor-plan-wrapper ${labelsVisible ? 'labels-visible' : ''}`}
      >
        {imageSrc !== undefined ? (
          // Setup live-preview branch — admin-uploaded blob/object URL. No
          // srcset, no AVIF/WebP variants: the admin's source image is what
          // the preview must show pixel-for-pixel.
          <img
            src={imageSrc}
            alt="Floor plan preview"
            loading="eager"
            decoding="async"
            onLoad={onImageLoad}
            ref={(el) => {
              if (el && el.complete && el.naturalWidth > 0) onImageLoad();
            }}
            className="floor-plan-image"
          />
        ) : (
          <picture>
            <source type="image/avif" srcSet={AVIF_SRCSET} sizes="100vw" />
            <source type="image/webp" srcSet={WEBP_SRCSET} sizes="100vw" />
            <img
              src={PNG_FALLBACK_SRC}
              srcSet={PNG_SRCSET}
              sizes="100vw"
              alt="Reception floor plan"
              loading="eager"
              decoding="async"
              onLoad={onImageLoad}
              ref={(el) => {
                // If the browser already has the image cached (e.g. from the
                // preload link in App.tsx), the onLoad event never fires because
                // it completed before React attached the handler. Fire manually.
                if (el && el.complete && el.naturalWidth > 0) onImageLoad();
              }}
              className="floor-plan-image"
            />
          </picture>
        )}
        {Object.entries(config.tablePositions).map(([id, pos]) => {
          // Only render the assigned table's pin. Non-assigned tables keep
          // their numbers visible from the printed floor-plan image —
          // overlaying slate dots obscured the image's own labels.
          if (id !== tableNumber) return null;
          return (
            <div
              key={id}
              ref={assignedPinRef}
              className="pin-assigned"
              data-table-id={id}
              style={{
                left: `${pos.x * 100}%`,
                top: `${pos.y * 100}%`,
              }}
            >
              <span className="pin-pulse-ring" aria-hidden="true" />
              <svg
                className="pin-assigned-svg"
                viewBox="0 0 36 44"
                aria-hidden="true"
              >
                <path
                  d="M18 0 C8 0 0 8 0 18 C0 28 18 44 18 44 C18 44 36 28 36 18 C36 8 28 0 18 0 Z"
                  fill="#d90429"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </svg>
              <span className="pin-assigned-number">{id}</span>
            </div>
          );
        })}
      </div>
    );
  });
}
