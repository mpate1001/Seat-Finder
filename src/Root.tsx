import { lazy, Suspense } from 'react';
import App from './App';

// The SINGLE allowed edge from the guest graph into the setup graph (D-01).
// Any static `import X from './setup/...'` elsewhere in the guest bundle
// defeats code-splitting and would pull OpenCV + Tesseract into the guest
// chunk. Plan 05-07 enforces this invariant with a grep over `dist/assets/`.
const SetupApp = lazy(() => import('./setup/SetupApp'));

/**
 * Root dispatcher: pathname-based route split between the guest `<App />` and
 * the lazy `<SetupApp />` shell.
 *
 * D-02: `window.location.pathname` is read ONCE at render time — no listener,
 * no useEffect, no popstate subscription. Navigation between the two surfaces
 * is reload-based. This keeps the dispatcher side-effect-free and trivially
 * compatible with React StrictMode's double-invoke.
 *
 * Extracted from src/main.tsx so tests can mount <Root /> directly without
 * triggering `createRoot(document.getElementById('root')!)` at module load —
 * jsdom can't cleanly host a real #root element across suites.
 */
export default function Root(): JSX.Element {
  const pathname = window.location.pathname;

  if (pathname === '/setup') {
    return (
      <Suspense
        fallback={<div className="setup-loading">Loading setup tool...</div>}
      >
        <SetupApp />
      </Suspense>
    );
  }

  return <App />;
}
