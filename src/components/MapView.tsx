import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import { Guest } from '../types';
import floorPlanConfig from '../config/floorPlan.json';
import FloorPlan from './FloorPlan';
import './MapView.css';

interface MapViewProps {
  guest: Guest;
  onClose: () => void;
}

const tablePositions = floorPlanConfig.tablePositions as Record<string, { x: number; y: number }>;

export default function MapView({ guest, onClose }: MapViewProps) {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const assignedPinRef = useRef<HTMLDivElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const hasValidPosition = Boolean(tablePositions[guest.tableNumber]);

  // Escape-to-close — canonical escape-to-close pattern for this codebase.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Browser back-button integration — StrictMode-safe.
  // React 18 StrictMode double-invokes effects in dev (mount → cleanup → mount).
  // The prior implementation pushed state on mount and called history.back() on
  // cleanup; the async popstate from the first cleanup's back() then fired against
  // the second mount's listener and closed the overlay immediately. The guard
  // below (1) pushes at most one history entry per real open via a ref, and
  // (2) only pops the entry when the component is genuinely unmounting (tracked
  // via a cleanup-commit ref that survives StrictMode's synchronous unmount-remount).
  const pushedRef = useRef(false);
  const realUnmountRef = useRef(false);

  useEffect(() => {
    if (!pushedRef.current) {
      history.pushState({ mapOpen: true }, '');
      pushedRef.current = true;
    }

    function handlePopState() {
      // The user pressed Back (or some other code popped the entry).
      // Our entry is gone — don't try to pop it again on unmount.
      pushedRef.current = false;
      onClose();
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // StrictMode fires this cleanup synchronously then re-runs the effect.
      // Defer the "did we actually unmount?" decision to a microtask: if the
      // effect runs again before the microtask fires, realUnmountRef is cleared
      // and we skip the pop.
      realUnmountRef.current = true;
      queueMicrotask(() => {
        if (!realUnmountRef.current) return;
        if (!pushedRef.current) return;
        const state = history.state as { mapOpen?: boolean } | null;
        if (state?.mapOpen) {
          pushedRef.current = false;
          history.back();
        }
      });
    };
  }, [onClose]);

  // Clear the unmount flag on every mount — if StrictMode or a re-render
  // re-invokes the effect, the deferred pop in the previous cleanup aborts.
  useEffect(() => {
    realUnmountRef.current = false;
  });

  // Animation orchestration: 250ms hold → 700ms zoom to 2.75× on assigned pin
  // Only runs when image is loaded AND the guest has a valid position
  useEffect(() => {
    if (!imageLoaded || !hasValidPosition) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const holdMs = prefersReducedMotion ? 0 : 250;
    const zoomMs = prefersReducedMotion ? 0 : 700;

    const timer = window.setTimeout(() => {
      if (!transformRef.current || !assignedPinRef.current) return;
      transformRef.current.zoomToElement(
        assignedPinRef.current,
        2.75,
        zoomMs,
        'easeOutQuart',
        0,
        64,
      );
    }, holdMs);

    return () => window.clearTimeout(timer);
  }, [imageLoaded, hasValidPosition, guest.tableNumber]);

  function handleImageLoad() {
    setImageLoaded(true);
  }

  // Portal to document.body so `.map-overlay { position: fixed }` is rooted at the
  // viewport. Without the portal, MapView renders inside App.tsx's `.card` div,
  // whose `backdrop-filter: blur(10px)` promotes `.card` to the containing block
  // for position:fixed descendants — the overlay would size to the card's padding
  // box, not the viewport.
  return createPortal(
    <div className="map-overlay" role="dialog" aria-modal="true" aria-label="Floor plan map">
      <button
        type="button"
        className="map-close-button"
        onClick={onClose}
        aria-label="Close map"
        title="Close map (Esc)"
      >
        &times;
      </button>

      {hasValidPosition ? (
        <>
          <div className="map-overlay-card" aria-live="polite">
            <h2 className="map-overlay-card-greeting">
              Welcome, {guest.firstName}! — Table {guest.tableNumber}
            </h2>
            {guest.description && (
              <p className="map-overlay-card-description">{guest.description}</p>
            )}
          </div>

          <div className="map-surface">
            <TransformWrapper
              ref={transformRef}
              initialScale={1}
              minScale={1.0}
              maxScale={6}
              centerOnInit={true}
              limitToBounds={true}
              centerZoomedOut={true}
              smooth={true}
              wheel={{ step: 0.2 }}
              doubleClick={{ mode: 'toggle', step: 2.75 }}
              pinch={{ disabled: false }}
              panning={{ velocityDisabled: false }}
            >
              <TransformComponent
                wrapperClass="map-transform-wrapper"
                contentClass="map-transform-content"
              >
                <FloorPlan
                  tableNumber={guest.tableNumber}
                  assignedPinRef={assignedPinRef}
                  onImageLoad={handleImageLoad}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
        </>
      ) : (
        // Missing-table fallback: render a centered error card INSTEAD of the
        // floor plan UI. The previous one-liner was buried inside the greeting
        // card, easy to miss on mobile. role="alert" announces it to screen
        // readers; the floor plan + greeting are both suppressed so there's no
        // half-broken zoom UI to confuse the guest.
        <div className="map-overlay-error-card" role="alert">
          <h2 className="map-overlay-error-headline">
            Table {guest.tableNumber} not found on the floor plan
          </h2>
          <p className="map-overlay-error-body">
            We couldn&apos;t locate Table {guest.tableNumber} on the venue
            diagram, {guest.firstName}. Please ask staff for directions —
            they can point you to the right area.
          </p>
          <button
            type="button"
            className="map-overlay-error-button"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
