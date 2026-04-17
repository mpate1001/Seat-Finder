import { useEffect, useRef, useState } from 'react';
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

  // Escape-to-close — copied verbatim from TableModal.tsx lines 12-22
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Browser back-button integration — from RESEARCH.md Pattern 6
  // IMPORTANT: never call history.back() inside the popstate handler (infinite loop risk)
  useEffect(() => {
    history.pushState({ mapOpen: true }, '');

    function handlePopState() {
      onClose();
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // If MapView is closing via × or Escape (not Back), pop our pushed entry
      const state = history.state as { mapOpen?: boolean } | null;
      if (state?.mapOpen) {
        history.back();
      }
    };
  }, [onClose]);

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

  return (
    <div className="map-overlay" role="dialog" aria-modal="true" aria-label="Floor plan map">
      <div className="map-overlay-card" aria-live="polite">
        <h2 className="map-overlay-card-greeting">
          Welcome, {guest.firstName}! — Table {guest.tableNumber}
        </h2>
        {guest.description && (
          <p className="map-overlay-card-description">{guest.description}</p>
        )}
        {!hasValidPosition && (
          <p className="map-overlay-card-fallback">
            Table {guest.tableNumber} — please ask staff for directions
          </p>
        )}
      </div>

      <button
        type="button"
        className="map-close-button"
        onClick={onClose}
        aria-label="Close map"
        title="Close map (Esc)"
      >
        &times;
      </button>

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
    </div>
  );
}
