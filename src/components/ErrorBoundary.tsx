import { Component, type ErrorInfo, type ReactNode } from 'react';
import './ErrorBoundary.css';

/**
 * Top-level React Error Boundary protecting the live event from blank-screen
 * failures. Without this, any uncaught render-tree throw — a CSV parsing edge
 * case, a missing image variant, a Sheets API hiccup that survives the
 * service layer — would unmount the entire React tree and leave the guest
 * staring at a blank #root div with no recourse.
 *
 * What it provides:
 *  1. A friendly fallback card with reload + "ask staff" copy, styled to
 *     match the rest of the app's error surfaces.
 *  2. console.error of the actual error + componentStack for live devtools
 *     debugging.
 *  3. localStorage persistence of the last error (timestamped, capped at
 *     ~10 KB) so the admin can post-mortem on their phone after the event
 *     without needing devtools open during check-in.
 *
 * Mounted ONCE in src/main.tsx wrapping <Root />. A nested boundary inside
 * App.tsx (e.g. around <MapView />) would let search keep working when the
 * map crashes — defer that until we have evidence it's needed; the current
 * scope catches everything.
 *
 * NOTE: must be a class component. React Error Boundaries require
 * `getDerivedStateFromError` and `componentDidCatch`, which have no
 * functional-component equivalent (would need react-error-boundary as a dep,
 * not worth ~2 KB for one component).
 */

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** localStorage key for the last caught error. Read it from devtools or a
 *  custom admin page after an incident — never reach for it in production
 *  guest code paths. */
export const ERROR_BOUNDARY_STORAGE_KEY = 'seatfinder.lastError';

/** Cap the persisted stack/componentStack at 10 KB each so a runaway error
 *  payload can never blow past localStorage's ~5 MB browser-wide limit and
 *  evict the guest list cache. */
const STACK_TRUNCATE_BYTES = 10 * 1024;

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console first — live devtools is the primary debugging channel.
    console.error('[ErrorBoundary] caught render error', error, info);
    // Persist a compact JSON envelope for after-the-fact inspection. Wrapped
    // in try/catch so localStorage quota / private-mode throws don't cascade
    // into a SECOND error (which would loop us right back into here).
    try {
      const payload = JSON.stringify({
        ts: new Date().toISOString(),
        message: error.message,
        stack: error.stack?.slice(0, STACK_TRUNCATE_BYTES),
        componentStack: info.componentStack?.slice(0, STACK_TRUNCATE_BYTES),
      });
      localStorage.setItem(ERROR_BOUNDARY_STORAGE_KEY, payload);
    } catch {
      /* localStorage write failure is non-fatal — console log is enough. */
    }
  }

  /**
   * Hard reload via the URL location so the entire JS bundle re-evaluates.
   * `setState({ hasError: false })` would re-mount the same broken tree and
   * almost certainly throw again; reload gets the user a fresh chance.
   */
  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="error-boundary-container" role="alert">
        <div className="error-boundary-card">
          <h1 className="error-boundary-headline">Something went wrong</h1>
          <p className="error-boundary-body">
            We hit an unexpected error. Please reload the page — if it keeps
            happening, ask a staff member for directions to your table.
          </p>
          <button
            type="button"
            className="error-boundary-button"
            onClick={this.handleReload}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
