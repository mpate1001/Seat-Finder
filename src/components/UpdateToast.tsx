import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './UpdateToast.css';

export interface UpdateToastProps {
  /** When true, suppress rendering (e.g., MapView is open — per D-07). */
  suppressed?: boolean;
}

const AUTO_DISMISS_MS = 10_000;

export default function UpdateToast({ suppressed = false }: UpdateToastProps) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err: unknown) {
      // Non-fatal — app works without SW.
      console.error('[sw] register error', err);
    },
  });

  // Auto-dismiss after 10s if the user ignores it (D-05).
  useEffect(() => {
    if (!needRefresh) return;
    const t = window.setTimeout(() => setNeedRefresh(false), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [needRefresh, setNeedRefresh]);

  if (!needRefresh || suppressed) return null;

  return createPortal(
    <div className="update-toast" role="status" aria-live="polite">
      <span className="update-toast-text">New version available</span>
      <button
        type="button"
        className="update-toast-btn"
        onClick={() => updateServiceWorker(true)}
      >
        Tap to refresh
      </button>
    </div>,
    document.body,
  );
}
