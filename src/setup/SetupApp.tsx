import './SetupApp.css';

/**
 * SetupApp — the floor-plan admin shell (TOOL-03 scaffold).
 *
 * Mounted ONLY on `window.location.pathname === '/setup'` via the lazy
 * dynamic import inside `src/Root.tsx`. Zero side effects at module scope
 * and no useEffect in the component body — the shell is purely declarative
 * so StrictMode double-invoke cannot race any init work (05-RESEARCH Pitfall 3).
 *
 * OpenCV / Tesseract / any other heavy dep MUST NOT be imported here at
 * module scope. Those land in plans 05-02..05-04 behind further lazy-init
 * inside user-gesture handlers (D-05, D-10). Plan 05-07 greps the built
 * guest bundle to prove neither string leaks out of this boundary.
 *
 * D-04: Access is protected only by route obscurity. The subtitle below is
 * the visible reminder — DO NOT SHARE THIS URL.
 */
export default function SetupApp(): JSX.Element {
  return (
    <main className="setup-app">
      <div className="setup-card">
        <h1>Setup tool</h1>
        <p className="setup-subtitle">
          Floor-plan admin — route obscurity only, DO NOT share this URL.
        </p>

        <button
          type="button"
          className="setup-upload-button"
          disabled
          aria-disabled="true"
        >
          Upload floor plan
        </button>

        <p className="setup-help">
          Upload a floor-plan image (PNG / JPEG / WebP / AVIF). The detection +
          review workflow lights up in a later step.
        </p>
      </div>
    </main>
  );
}
