import { useTransformComponent } from 'react-zoom-pan-pinch';
import './FloorPlan.css';
import floorPlanConfig from '../config/floorPlan.json';

interface FloorPlanProps {
  tableNumber: string;
  // Forwarded by MapView: the ref is attached to the assigned table's pin div
  // so the zoom animation can target it. Typed as React.Ref (not React.RefObject)
  // so a MutableRefObject from useRef<HTMLDivElement | null>(null) and callback
  // refs both satisfy the intrinsic <div ref={...}> prop under React 18 strict.
  assignedPinRef: React.Ref<HTMLDivElement>;
  onImageLoad: () => void;
}

interface TablePosition {
  x: number;
  y: number;
}

interface FloorPlanConfig {
  imageFileName: string;
  tablePositions: Record<string, TablePosition>;
}

const config: FloorPlanConfig = floorPlanConfig;

const AVIF_SRCSET =
  '/floor-plan/floor-plan-900.avif 900w, /floor-plan/floor-plan-1600.avif 1600w, /floor-plan/floor-plan-2400.avif 2400w';
const WEBP_SRCSET =
  '/floor-plan/floor-plan-900.webp 900w, /floor-plan/floor-plan-1600.webp 1600w, /floor-plan/floor-plan-2400.webp 2400w';
const PNG_SRCSET =
  '/floor-plan/floor-plan-900.png 900w, /floor-plan/floor-plan-1600.png 1600w, /floor-plan/floor-plan-2400.png 2400w';
const PNG_FALLBACK_SRC = '/floor-plan/floor-plan-1600.png';

// DEV duplicate-position warning — retained from Phase 1 (regression guard)
if (import.meta.env.DEV) {
  const seen = new Map<string, string>();
  for (const [id, pos] of Object.entries(config.tablePositions)) {
    const key = `${pos.x.toFixed(4)},${pos.y.toFixed(4)}`;
    if (seen.has(key)) {
      console.warn(`Duplicate table position: ${id} and ${seen.get(key)} at ${key}`);
    }
    seen.set(key, id);
  }
}

export default function FloorPlan({ tableNumber, assignedPinRef, onImageLoad }: FloorPlanProps) {
  // Adaptive label visibility (D-09). useTransformComponent re-runs cheaply on every
  // transform state change; we toggle a single class on the wrapper and let CSS drive
  // the fade (no per-marker re-render).
  return useTransformComponent(({ state }) => {
    const labelsVisible = state.scale >= 1.8;
    return (
      <div
        className={`floor-plan-wrapper ${labelsVisible ? 'labels-visible' : ''}`}
      >
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
