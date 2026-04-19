# Phase 5: Setup Tooling — Research

**Researched:** 2026-04-17
**Domain:** Browser-side computer vision (Hough Circle detection + Tesseract OCR) behind a route-split admin tool
**Confidence:** HIGH (core decisions verified against npm registry + upstream docs); MEDIUM (Hough parameter defaults — verified against OpenCV API but require runtime tuning on the actual Reception Seat Diagram PNG)

## Summary

Phase 5 adds an admin-only `/setup` route to the existing React 18 + Vite 6 SPA. The tool ingests a floor-plan image, runs `cv.HoughCircles` (from `@techstark/opencv-js`) to find circular table markers, crops each circle region, OCRs the digits inside with `tesseract.js` v7, presents the results as draft pins for admin review/edit, and exports a `floorPlan.json` byte-identical to the file the guest app already consumes at `src/config/floorPlan.json`. The heavy CV+OCR chunks must never load on the guest path — the entire tool lives behind a `React.lazy` boundary and is verified out of the guest bundle by a post-build grep smoke test.

Two facts shape every design decision below:
1. **The guest bundle is sacred.** OpenCV ships as ~12.3 MB of unpacked WASM+JS and Tesseract ships ~1.4 MB + external `tesseract.js-core` + per-language trained data. Leaking either into the `/` route regresses every other Phase 1-4 optimization.
2. **The admin is the authority, not the algorithm.** Hough + OCR on a clean Canva line-art PNG should get most circles right, but the review UI is where correctness lives. Plans must invest in review ergonomics (drag/edit/add/delete + live preview + dup warning) at least as much as in detection tuning.

**Primary recommendation:** Single Vite build, pathname dispatch in `main.tsx`, `React.lazy(() => import('./setup/SetupApp'))` boundary, default Vite async-chunk behavior (no `manualChunks` tweaking needed — dynamic imports already land in separate files under Rollup's default graph), and a `scripts/verify-setup-split.mjs` grep gate that runs after `vite build` (parallel to the existing `verify-pwa-build.mjs`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Access & routing (TOOL-03)**
- **D-01:** Setup tool lives at route `/setup` in the same Vite app — NOT a separate build entry, NOT dev-only. Route-based code-splitting via `React.lazy(() => import('./setup/SetupApp'))` ensures the setup bundle is NEVER loaded on the guest path (`/`) or referenced in the guest chunk.
- **D-02:** No router library added. Implement a minimal path check in `main.tsx` or `App.tsx`: if `window.location.pathname === '/setup'`, render `<SetupApp />` (lazy); else render the current guest `<App />`. Keeps the dep list lean; a router isn't justified for a two-route app.
- **D-03:** TOOL-03 verification: a build-smoke test confirms that `dist/assets/` contains a separate chunk for the setup module AND that the guest entry bundle does NOT contain OpenCV, Tesseract, or setup-specific strings (grep assertions). If this fails, the build fails.
- **D-04:** No auth. `/setup` is protected only by route obscurity. Document this clearly in README and the setup page UI.

**Auto-detection pipeline (TOOL-01 + TOOL-04)**
- **D-05:** Computer-vision stack = `opencv.js` (Hough Circle Transform) + `tesseract.js` (OCR). Both are lazy-loaded inside the `/setup` chunk — never referenced from guest code.
- **D-06:** Detection flow: draw uploaded image to an offscreen `<canvas>` → grayscale + Gaussian blur → `cv.HoughCircles` with parameters tuned for floor-plan-style drawings (min/max radius inferred from image size) → array of `{cx, cy, radius}` → for each circle, crop a square region of `2 * radius` around center → feed crop to Tesseract worker → get `{number, confidence}` → emit `DraftPin { x, y, detectedNumber, confidence, detectedRadius }`.
- **D-07:** Coordinates are stored as fractions (0..1 of image width/height) from the moment detection returns — no pixel numbers cross module boundaries. Matches the shape `floorPlan.json` already uses.
- **D-08:** OCR only accepts digit characters (Tesseract `tessedit_char_whitelist: '0123456789'`) to prune hallucinations.
- **D-09:** Confidence threshold = 60 (Tesseract scale 0-100). Pins with confidence < 60 render with a visible warning badge in the review UI. Pins where OCR returned no digits render with a placeholder "?" number; admin must assign.
- **D-10:** Detection runs on a single "Detect tables" button click — not continuously. Progress is reported via a small status line so the admin knows it's not frozen.

**Review UI (TOOL-01 extras)**
- **D-11:** Draft pins render as colored overlays on top of a scaled-down image. Assigned (approved) pins = red teardrop (reuse the `.pin-assigned` SVG from `FloorPlan.tsx`). Low-confidence pins = orange outline. Placeholder-number pins = slate with "?".
- **D-12:** Admin interactions on the review canvas:
  - **Drag** a pin to reposition (updates stored x/y fraction).
  - **Click** a pin to open an inline editor that shows the detected number and lets admin override it. Edit confirms on Enter/blur.
  - **Delete** — small "×" button on each pin's hover state, or keyboard Backspace/Delete when pin is selected.
  - **Add** — shift-click (or a dedicated "Add pin" toggle mode) on empty canvas space drops a new pin, admin types number inline.
- **D-13:** Live preview panel renders next to the editor using the REAL `FloorPlan` component from `src/components/FloorPlan.tsx`, fed from the current draft-pin state. This proves-out what guests will see before approve.
- **D-14:** Duplicate-position warning: reuse the Phase 1 dev warning pattern. If two draft pins are within 3% of each other (Euclidean distance in 0..1 fraction space), show an inline warning in the review UI.

**Approve + export (TOOL-02)**
- **D-15:** "Approve" button locks editing, triggers a validation pass: all pins have a numeric `tableNumber`, no duplicates (IDs must be unique — distinct from position warning), no impossible coords (0 ≤ x, y ≤ 1). Failures show inline, admin must fix.
- **D-16:** Export JSON shape = exactly what `src/config/floorPlan.json` expects today (imageFileName + tablePositions map, 4-decimal fraction precision).
- **D-17:** Export affordances = TWO side-by-side buttons: **Download `floorPlan.json`** (triggers a browser blob download) and **Copy to Clipboard** (uses `navigator.clipboard.writeText`). Both produce byte-identical output.
- **D-18:** No automatic write-back into the repo or `src/config/` — admin manually replaces the file. Reason: keeps the setup tool pure-client with no FS plumbing.

### Claude's Discretion
- Specific Hough Circle parameter tuning: researcher investigates and planner sets defaults that work on the existing Reception Seat Diagram PNG, with UI sliders IF tuning is too finicky out of the box.
- Tesseract worker lifecycle: one-shot (init → OCR all → terminate) vs long-lived (init once, reuse across edits). Researcher picks the cheaper/cleaner pattern.
- Progress UI during detection: spinner + text is fine; progress bars are optional polish.
- Whether the review canvas uses a full-res image vs a downscaled preview for performance. Planner decides based on image sizes (the existing PNG is 2400×1831).
- Error UX for upload failures (invalid file type, huge image OOM, etc.) — follow the existing `App.tsx` error-card pattern.

### Deferred Ideas (OUT OF SCOPE)
- **TOOL-05: Built-in guest-list management UI** — replace Google Sheets with an in-app admin CRUD page.
- **Save draft progress to localStorage** — so an admin who closes the tab mid-review doesn't lose their work.
- **Multiple floor-plan support** — different ceremony vs reception layouts on one event.
- **Auth gate on `/setup`** — password input or environment-flag check. Route obscurity is acceptable.
- **Autosave / auto-push to repo** — POST the generated JSON to a backend that commits it to `src/config/`. Requires a backend.
- **Per-table metadata editing** — set seat count, hostname, notes per table from the setup tool.
- **Export floor plan image (optimized variants)** — pipe the uploaded image through Phase 3's `scripts/generate-images.mjs` automatically.
- **OCR confidence tuning UI** — expose Hough parameter sliders + Tesseract language model choices to the admin. Only build if the defaults don't work on a clean input.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-01 | Admin can upload a floor plan image and generate coordinate mappings for each table position | §2 (Hough detection) + §4 (orchestration) + §5 (DraftPin model) + §6 (live preview) |
| TOOL-02 | Exports percentage-based coordinates compatible with `src/config/floorPlan.json` | §7 (export mechanics) + confirmed shape matches existing JSON byte-for-byte at 4dp |
| TOOL-03 | Setup tool excluded from production guest-facing bundle (route-based code splitting) | §1 (route split) + §8 (build-smoke verification) + §9 (Vite config) |
| TOOL-04 (promoted) | Auto-detect circles AND OCR numbers, present as reviewable draft pins | §2 + §3 + §4 end-to-end |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Path-based route dispatch | Browser / Client (`main.tsx`) | — | SPA, no router, no SSR — pathname read and mount decision happen in the initial client entry |
| Upload + decode image | Browser / Client (`<input type=file>` + `createImageBitmap`) | — | File API is browser-native; no reason to ship to a server (there isn't one) |
| Circle detection (`HoughCircles`) | Browser / Client (WASM via opencv.js) | — | Static site, no backend. Entire CV pipeline runs in the admin's browser |
| OCR per circle crop | Browser / Client (Tesseract.js WASM worker) | — | Same: no server. `tesseract.js` spawns a web worker inside the `/setup` bundle boundary |
| Review UI state | Browser / Client (`useState` in `SetupApp`) | — | Ephemeral; no persistence per D-18 (no localStorage in v1) |
| Live preview render | Browser / Client (`<FloorPlan>` reused) | — | Reuses existing guest component — proves output before export |
| Export (download / clipboard) | Browser / Client (`Blob` + `a.click()` + `navigator.clipboard`) | — | No upload endpoint; admin pastes file manually per D-18 |
| Bundle-isolation enforcement | Build-time (Vite + `scripts/verify-setup-split.mjs`) | — | Guarantee is established at `vite build`, not at runtime |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@techstark/opencv-js` | `4.12.0-release.1` | Circle detection via `cv.HoughCircles` | Actively-maintained npm distribution of the official OpenCV.js WASM build (OpenCV 4.12.0); ships a default TypeScript declaration file; single dep-free package; used by the slim React/Angular CV ecosystem — the official `opencv.js` is not published as a proper npm package, making `@techstark/opencv-js` the path of least resistance. `[VERIFIED: npm view @techstark/opencv-js — published 2025-11-08, unpacked 12.3 MB, 28 versions, license Apache-2.0]` |
| `tesseract.js` | `^7.0.0` | OCR for digits in circle crops | Canonical browser OCR library. v7 supports createWorker with typed options and per-word confidence in result.data. `tessedit_char_whitelist` is a supported Tesseract variable. `[VERIFIED: npm view tesseract.js — published 2025-12-15, 71 versions, license Apache-2.0]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React 18.3.1 | (existing) | Component + state | Already in stack; no addition |
| Vite 6.0.1 | (existing) | Build + code split | Default Rollup chunking for dynamic imports already separates `SetupApp` from guest entry |
| Vitest 4.1.4 | (existing) | Unit tests | Already configured; mocks for opencv/tesseract per §10 |
| `@testing-library/react` 16.3.2 | (existing) | Review UI tests | Already configured |
| `react-zoom-pan-pinch` 4.0.3 | (existing) | Live preview requires `TransformWrapper` around reused `FloorPlan` | Already a dep; live preview just wraps `FloorPlan` identically to `MapView` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@techstark/opencv-js` | `mirada` (v0.0.15) | `mirada` is a TypeScript-first wrapper around opencv.js but hasn't had a release since 2021 (abandoned); `@techstark/opencv-js` is still shipping releases. `[VERIFIED: npm view mirada]` — REJECTED for maintenance risk. |
| `@techstark/opencv-js` | `opencv-ts` (v1.3.6) | `opencv-ts` is a types-only package; it relies on you loading opencv.js from a CDN script tag, which breaks the "no external runtime dependency at setup boundary" goal and complicates chunking. `[VERIFIED: npm view opencv-ts]` — REJECTED for integration awkwardness. |
| `tesseract.js` | Browser Shape Detection API (`TextDetector`) | Only stable in Chrome on Android; missing in desktop Chrome, Firefox, Safari. Can't run on admin's laptop reliably. REJECTED. |
| `tesseract.js` v7 | `tesseract.js` v5 (what most older tutorials use) | v7 is current (Dec 2025), has stable `createWorker('eng', 1, opts)` signature and preserves per-word confidence. No reason to pin older. `[VERIFIED: npm registry]` |
| Custom path dispatch | `react-router-dom` v7 | Two routes only (`/` + `/setup`). A router adds ~10KB gz + a Provider at the guest-app root we don't need. REJECTED per CONTEXT D-02. |

**Installation:**
```bash
npm install @techstark/opencv-js@^4.12.0 tesseract.js@^7.0.0
```

**Version verification (run 2026-04-17):** Both versions above were pulled live from `npm view`; dates published: `@techstark/opencv-js@4.12.0-release.1` 2025-11-08, `tesseract.js@7.0.0` 2025-12-15. `[VERIFIED: npm registry 2026-04-17]`

## Architecture Patterns

### System Architecture Diagram

```
[Browser tab opens /setup]
           │
           ▼
   main.tsx (guest entry)          ──► pathname === '/setup' ?
           │                             │
           │ no                          │ yes
           ▼                             ▼
     render <App/>                 Suspense + React.lazy
     (guest chunk only)                  │
                                         ▼
                              dynamic import('./setup/SetupApp')
                              (separate setup chunk loaded on demand)
                                         │
                                         ▼
                              SetupApp  ─── root state: DraftPin[] + UI mode
                                 │
             ┌───────────────────┼───────────────────┐
             ▼                   ▼                   ▼
       <FileDrop>          <ReviewCanvas>        <ExportPanel>
             │                   │                   │
             ▼                   │                   │
       File→ImageBitmap          │                   │
             │                   │                   │
             ▼                   │                   │
    [Detect tables] click        │                   │
             │                   │                   │
             ▼                   │                   │
       detect.ts                 │                   │
             │                   │                   │
  ┌──────────┴─────────┐         │                   │
  ▼                    ▼         │                   │
 lazyLoadOpenCV   lazyLoadTesseract│                 │
 (onRuntimeInit)  (createWorker) │                   │
       │                │        │                   │
       ▼                │        │                   │
  cv.imread(canvas)     │        │                   │
       │                │        │                   │
       ▼                │        │                   │
  cvtColor→GaussianBlur │        │                   │
       │                │        │                   │
       ▼                │        │                   │
  HoughCircles → [cx,cy,r] ──┐   │                   │
                             │   │                   │
                             ▼   │                   │
                    for each circle:                  │
                     canvas.getImageData(crop)        │
                             │   │                   │
                             ▼   │                   │
                    worker.recognize(crop) ◄─────────┤
                             │                       │
                             ▼                       │
                    {text, confidence} ──► DraftPin  │
                                                     │
                         setState(draftPins) ────────┘
                                │
                                ▼
                        React re-renders:
                           ReviewCanvas (overlay pins on scaled image)
                           LivePreview  (<FloorPlan> fed by synthetic config)
                                │
                                ▼ admin edits/drags/adds/deletes
                                │
                                ▼ clicks Approve → validate(draftPins)
                                │
                                ▼
                        ExportPanel:
                          Download floorPlan.json (Blob + a.click)
                          Copy to clipboard  (navigator.clipboard)
```

### Recommended Project Structure

```
src/
├── setup/                        # ONE-way boundary. Everything here is in the setup chunk.
│   ├── SetupApp.tsx              # Root component. Default export. State lives here.
│   ├── SetupApp.css
│   ├── detect.ts                 # Pure module: detectTables(image, opts) => DraftPin[]
│   ├── detect.test.ts
│   ├── ocr.ts                    # Tesseract worker wrapper (one-shot lifecycle)
│   ├── ocr.test.ts
│   ├── FileDrop.tsx              # Upload UI (drag/drop + <input type=file>)
│   ├── ReviewCanvas.tsx          # Pin overlay + drag/edit/add/delete interactions
│   ├── ReviewCanvas.css
│   ├── LivePreview.tsx           # Wraps <FloorPlan> in TransformWrapper, feeds synthetic config
│   ├── ExportPanel.tsx           # Download + Copy buttons
│   ├── exportConfig.ts           # buildFloorPlanJson(pins, imageFileName) => string
│   ├── exportConfig.test.ts
│   ├── types.ts                  # DraftPin, PipelineProgress, etc.
│   └── validation.ts             # validateDraftPins(pins) => { ok, errors[] }
├── components/                   # UNCHANGED — FloorPlan.tsx imported by setup/LivePreview
├── main.tsx                      # EDITED — pathname dispatch
├── App.tsx                       # UNCHANGED
└── ...
scripts/
├── verify-pwa-build.mjs          # Existing Phase 4
└── verify-setup-split.mjs        # NEW — grep gate for TOOL-03
```

**Why a parallel `src/setup/` tree:** makes the module boundary visually obvious at review time. Any `import` from `src/setup/` into `src/components/` or `src/services/` is a red flag during code review (and enforced by the grep gate at build time). The only allowed incoming edge is `src/main.tsx`'s lazy import.

### Pattern 1: Pathname dispatch with `React.lazy`

**What:** Minimal two-route SPA without a router library. The guest entry bundle checks `window.location.pathname` once and either mounts `<App/>` directly or suspends on a dynamic import of `SetupApp`. Rollup (through Vite's default config) automatically splits the dynamic-imported module into its own chunk.

**When to use:** Two-route apps where adding a router is overkill and the code-split boundary is the primary architectural goal. (Our exact situation.)

**Example:**
```tsx
// src/main.tsx — EDITED
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const SetupApp = lazy(() => import('./setup/SetupApp'));

function Root() {
  // Read path ONCE at module eval. The setup tool has no sub-routes and does
  // not listen for navigation — admin navigates by reloading.
  if (typeof window !== 'undefined' && window.location.pathname === '/setup') {
    return (
      <Suspense fallback={<div className="setup-loading">Loading setup tool…</div>}>
        <SetupApp />
      </Suspense>
    );
  }
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
```

`[CITED: https://github.com/vitejs/vite/discussions/17730 — Vite automatically creates separate chunks for React.lazy dynamic imports; no rollupOptions customization needed for basic route-level split]`

### Pattern 2: Lazy-init OpenCV runtime inside the setup boundary

**What:** `@techstark/opencv-js` exports an object (or a Promise in some envs) that finishes WASM initialization asynchronously via `onRuntimeInitialized`. Guard all `cv.*` calls behind an `await getCv()` gate so admin clicks don't race init.

**When to use:** Always, on every entry into the detection pipeline. Admins may click "Detect" before init completes.

**Example:**
```ts
// src/setup/detect.ts — top
import cvModule from '@techstark/opencv-js';

type CvNamespace = typeof import('@techstark/opencv-js').default;

let cvPromise: Promise<CvNamespace> | null = null;

export function getCv(): Promise<CvNamespace> {
  if (cvPromise) return cvPromise;

  cvPromise = (async () => {
    // Some builds return a Promise; others return the module directly with an
    // onRuntimeInitialized hook. Handle both — per upstream README.
    if (cvModule instanceof Promise) return cvModule as unknown as CvNamespace;
    if ((cvModule as { Mat?: unknown }).Mat) return cvModule as CvNamespace;
    await new Promise<void>((resolve) => {
      (cvModule as { onRuntimeInitialized: () => void }).onRuntimeInitialized = () => resolve();
    });
    return cvModule as CvNamespace;
  })();

  return cvPromise;
}
```

`[CITED: https://github.com/TechStark/opencv-js — README integration pattern; verified via WebFetch 2026-04-17]`

### Pattern 3: Hough Circle detection with tight Mat lifecycle

**What:** OpenCV.js objects are WASM-heap-backed and NOT GC-tracked. Every `new cv.Mat()`, every `cv.imread` output, every intermediate from `cvtColor`/`GaussianBlur`/`HoughCircles` must be explicitly `.delete()`-ed in a `try/finally` or via a disposer-stack helper. Missing this leaks ~10-100MB per detection run on a 2400×1831 image.

**When to use:** Every detection call.

**Example:**
```ts
// src/setup/detect.ts
export interface RawCircle { cx: number; cy: number; r: number; }

export async function detectCircles(
  canvas: HTMLCanvasElement,
  opts: HoughOpts = DEFAULT_HOUGH,
): Promise<RawCircle[]> {
  const cv = await getCv();
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const circles = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 1.5, 1.5, cv.BORDER_DEFAULT);
    cv.HoughCircles(
      blurred,
      circles,
      cv.HOUGH_GRADIENT,
      opts.dp,          // 1 — accumulator resolution same as image
      opts.minDist,     // ~image.cols * 0.03 — tables are ≥3% image width apart
      opts.param1,      // 100 — Canny upper threshold
      opts.param2,      // 30  — accumulator threshold (lower = more circles, more FPs)
      opts.minRadius,   // image.cols * 0.012 — matches smallest table on 2400px wide img
      opts.maxRadius,   // image.cols * 0.035 — matches largest table, avoids large annotation rings
    );

    const out: RawCircle[] = [];
    for (let i = 0; i < circles.cols; i++) {
      out.push({
        cx: circles.data32F[i * 3],
        cy: circles.data32F[i * 3 + 1],
        r:  circles.data32F[i * 3 + 2],
      });
    }
    return out;
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    circles.delete();
  }
}
```

**Hough defaults (starting values for the 2400×1831 Reception Seat Diagram):**

| Param | Value | Reasoning |
|-------|-------|-----------|
| method | `cv.HOUGH_GRADIENT` | Only fully supported method in opencv.js. `HOUGH_GRADIENT_ALT` is spotty in the WASM build — stick with GRADIENT. |
| `dp` | `1` | Same resolution as image — standard for clean line art. |
| `minDist` | `image.cols * 0.03` (~72px on 2400 wide) | Table centers in the existing JSON are ~0.03–0.04 fraction apart at their closest (tables 46/47 were the bug). |
| `param1` | `100` | OpenCV default; clean black-on-white line art tolerates default Canny upper threshold. |
| `param2` | `30` | Lower-than-default (100) accumulator threshold: the circles in the PNG are thin lines, so the accumulator votes are sparse. Expect extra false positives; OCR + review filter them. |
| `minRadius` | `image.cols * 0.012` (~29px on 2400 wide) | Smallest plausible table circle. Below this = decorative dots / number badges / noise. |
| `maxRadius` | `image.cols * 0.035` (~84px on 2400 wide) | Largest plausible table circle. Above this = room boundaries, dance floor circles. |

`[CITED: https://docs.opencv.org/4.x/d3/de5/tutorial_js_houghcircles.html — API signature + defaults (param1=100, param2=100, minRadius=0, maxRadius=0 upstream defaults)]` — note we override param2 and both radii for our domain. `[ASSUMED]` on exact numeric values hitting ≥90% recall on the specific Reception Seat Diagram PNG — cannot verify without running the pipeline; **planner should add a Wave 0 task that runs detection on the real PNG and adjusts these constants if recall <90% or FP rate >20%.**

### Pattern 4: Tesseract one-shot worker (lifecycle decision)

**What:** For a "click Detect once, see results" admin tool, a one-shot worker is simpler than a long-lived one. The worker is created, loads the English trained data, OCRs all ~54 circle crops sequentially, then terminates. No pooling, no idle-leak.

**When to use:** Any batch-OCR-once workflow. If the UI added "re-OCR just this one pin" later, we'd switch to long-lived.

**Recommendation:** ONE-SHOT. Create once per "Detect" click; terminate after all circles are recognized.

**Reasoning:**
- Worker init (core + eng.traineddata download) takes ~2-3 s on first run; admin sees this once per upload.
- Keeping the worker alive for the entire review session is ~100MB resident memory for a feature that won't be used again until the next upload.
- Terminating frees WASM heap cleanly.
- v7 `createWorker('eng', 1, opts)` reads `eng.traineddata` from `idb-keyval` cache on subsequent runs within the same origin — warmup stays fast after the first detect.

**Example:**
```ts
// src/setup/ocr.ts
import { createWorker, type Worker } from 'tesseract.js';

export interface OcrResult { text: string; confidence: number; }

export async function recognizeCircles(
  imageData: ImageData[],
  onProgress?: (done: number, total: number) => void,
): Promise<OcrResult[]> {
  const worker: Worker = await createWorker('eng', 1, {
    // Tesseract.js auto-loads core + worker from jsDelivr CDN by default:
    //   corePath:   https://cdn.jsdelivr.net/npm/tesseract.js-core@v<version>
    //   workerPath: bundled with tesseract.js package (Vite copies .worker.min.js into dist/assets)
    //   langPath:   jsDelivr traineddata
    // We leave these as defaults — simplest, cached in IndexedDB (idb-keyval) after first run.
    logger: () => { /* no-op; we use our own progress callback below */ },
  });

  try {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
    });

    const results: OcrResult[] = [];
    for (let i = 0; i < imageData.length; i++) {
      const { data } = await worker.recognize(imageData[i]);
      // result.data.confidence is the overall 0-100 score. For single-word
      // digit crops this is effectively the per-number confidence we need.
      results.push({
        text: (data.text ?? '').trim(),
        confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      });
      onProgress?.(i + 1, imageData.length);
    }
    return results;
  } finally {
    await worker.terminate();
  }
}
```

`[CITED: https://github.com/naptha/tesseract.js/blob/master/docs/api.md — createWorker signature + setParameters + recognize return shape]`
`[CITED: https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md — default CDN paths: corePath→jsdelivr, langPath→jsdelivr]`

Per-word confidence on `data.words[i].confidence` is also available (0-100 scale) if a per-digit score is ever needed; for our digit-only crops, `data.confidence` suffices. `[VERIFIED: WebSearch cross-referenced tesseract.js GitHub + tessdoc 2026-04-17]`

### Pattern 5: Live preview via the real `FloorPlan` component

**What:** The review UI renders two panels side-by-side on desktop (stacked on mobile). The top/left panel is the editable canvas. The bottom/right panel is the actual `<FloorPlan/>` component wrapped in a `TransformWrapper`, fed a synthetic config object built on-the-fly from current `draftPins`. This is the strongest possible verification that what admin approves is what guest sees — we test the guest code path with live data.

**Constraint:** `FloorPlan.tsx` currently imports its config via `import floorPlanConfig from '../config/floorPlan.json'`. To feed live data without forking the component, either:
- **Option A (recommended):** Convert `FloorPlan` to accept an optional `config?: FloorPlanConfig` prop that falls back to the JSON import when omitted. Guest usage stays identical; setup passes a live config.
- **Option B:** Fork a `SetupLivePreview` that duplicates `FloorPlan`'s render logic. Rejected — regresses the "live preview proves-out guest render" guarantee.

**Example (Option A — minimal API addition):**
```tsx
// src/components/FloorPlan.tsx — SURGICAL EDIT
interface FloorPlanProps {
  tableNumber: string;
  assignedPinRef: React.Ref<HTMLDivElement>;
  onImageLoad: () => void;
  config?: FloorPlanConfig;         // NEW — defaults to imported JSON
  imageSrc?: string;                // NEW — defaults to /floor-plan/* srcset
}

export default function FloorPlan({
  tableNumber,
  assignedPinRef,
  onImageLoad,
  config = defaultConfig,           // existing JSON import, renamed
  imageSrc,                          // optional override for setup preview
}: FloorPlanProps) {
  // ... existing render; swap `config` in place of previous `config`;
  //     if `imageSrc` present, render a plain <img src={imageSrc}> instead of <picture>.
}

// src/setup/LivePreview.tsx
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import FloorPlan from '../components/FloorPlan';

export function LivePreview({ pins, imageUrl, focusedTableNumber }: Props) {
  const config = useMemo(() => buildSyntheticConfig(pins, 'preview.png'), [pins]);
  return (
    <div className="live-preview">
      <TransformWrapper initialScale={1} minScale={1} maxScale={4} centerOnInit>
        <TransformComponent wrapperClass="live-preview-wrapper">
          <FloorPlan
            tableNumber={focusedTableNumber ?? ''}
            assignedPinRef={noopRef}
            onImageLoad={() => {}}
            config={config}
            imageSrc={imageUrl}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
```

Note: the `config?` + `imageSrc?` additions to `FloorPlan` are the only edit to guest code this phase requires. Keep the edit minimal (no behavior change when props are absent) and add a guest-path regression test.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circle detection in images | Custom edge + voting loop in JS | `cv.HoughCircles` from `@techstark/opencv-js` | Hough Gradient has 20+ years of tuning; reimplementing correctly in JS is a multi-week project with worse perf than WASM. |
| OCR for digits | Custom digit classifier (MNIST-style) | `tesseract.js` with `tessedit_char_whitelist='0123456789'` | Tesseract ships a tuned English LSTM model; re-training or embedding a smaller model adds dozens of KB of model weight for worse accuracy on printed fonts. |
| File download in-browser | Custom iframe tricks, deprecated `window.saveAs` | `new Blob(...)` + `URL.createObjectURL` + synthesized `<a download>` click | Standard pattern; single-digit lines of code; zero deps. |
| Clipboard write | `document.execCommand('copy')` | `navigator.clipboard.writeText` | `execCommand` is deprecated; Clipboard API is the web standard. Works on every modern browser over HTTPS or localhost. |
| Image resize for preview | Custom canvas scaling loop | `createImageBitmap(file, { resizeWidth, resizeQuality: 'high' })` | Native, GPU-backed, async. |
| Drag interactions on pins | Custom mousedown/mousemove math | `pointer events` + a small `startDrag(e, pin)` helper that updates state on `pointermove` and commits on `pointerup` | Native pointer events cover mouse+touch+pen; a library like react-dnd is overkill for one draggable element type. |
| Route dispatch for two routes | `react-router-dom` | `window.location.pathname` check in `main.tsx` | A router ships a Context provider + history listeners we don't need for a reload-to-navigate workflow. |
| Bundle-isolation verification | Trust-but-don't-verify | `scripts/verify-setup-split.mjs` (grep gate) | Vite split behavior can regress silently; Phase 4 precedent (`verify-pwa-build.mjs`) proves the value of an explicit CI-fail smoke test. |

**Key insight:** Every "custom solution" in this phase is either a multi-month CV project (don't) or a five-line wrapper around a web platform primitive (do). The planner should treat any task description reading "implement our own X" for X in {Hough, OCR, drag, download, clipboard} as a red flag.

## Common Pitfalls

### Pitfall 1: OpenCV `Mat` heap leaks

**What goes wrong:** Admin clicks "Detect tables" five times in a row while tuning something. Tab RAM climbs from 150MB → 700MB → browser OOM.

**Why it happens:** `cv.Mat` is backed by Emscripten's WASM linear memory, which the JS GC cannot reclaim. Each unfreed Mat from `cv.imread`, `cv.cvtColor`, `cv.GaussianBlur`, `cv.HoughCircles` output keeps its bytes alive forever.

**How to avoid:** Every function that allocates Mats uses `try { ... } finally { mat.delete(); }`. Code review any new function that touches `cv.*` against this rule. Prefer a disposer-stack helper (`const mats: cv.Mat[] = []; try { ... mats.push(new cv.Mat()); ... } finally { mats.forEach(m => m.delete()); }`) for multi-mat functions.

**Warning signs:** `performance.memory.usedJSHeapSize` (Chrome) climbs across repeated detect runs. Task Manager RAM doesn't drop after closing the tab.

`[CITED: https://github.com/opencv/opencv/issues/20409 — upstream confirmation that cv.Mat requires manual delete()]`

### Pitfall 2: Tesseract warmup perceived as freeze

**What goes wrong:** Admin clicks "Detect tables" the first time ever on this browser. Nothing visible happens for 2-4 s (WASM core fetch + eng.traineddata fetch). Admin clicks again. Now TWO workers init concurrently, both downloading traineddata, thrashing.

**Why it happens:** First-run `createWorker('eng', 1)` triggers a ~2-3MB core fetch + ~10MB eng traineddata fetch (cached in IndexedDB for subsequent runs). No built-in progress during init.

**How to avoid:**
- Disable the Detect button as soon as it's clicked; re-enable only after the full pipeline resolves or errors.
- Show a status line ("Downloading OCR model…" → "Scanning for circles…" → "Reading circle numbers… X / Y").
- Use tesseract's `logger` callback (`createWorker('eng', 1, { logger: m => setStatus(m.status) })`) to surface progress during init; it emits status strings like `loading tesseract core`, `initializing api`, `recognizing text`.
- Single-flight guard: if a detection is in progress, ignore additional click events.

**Warning signs:** Button can be double-clicked. No visible progress. Admin refreshes the page thinking it froze.

`[CITED: https://github.com/naptha/tesseract.js#tesseractjs — "Tesseract.js 4 and later download several files via HTTP; status callbacks expose init progress"]`

### Pitfall 3: React StrictMode double-invoke of init effects

**What goes wrong:** In dev, `<SetupApp/>` mounts twice in quick succession (StrictMode probe). Any `useEffect` that lazy-initializes OpenCV or spawns a Tesseract worker runs twice. Result: two parallel workers, two pending CV inits, state races.

**Why it happens:** React 18 StrictMode intentionally mounts→cleanup→mount to surface missing cleanup. The Phase 3 `MapView.tsx` history-push fix (commit `refactor/mapview-strictmode`) is the canonical precedent.

**How to avoid:**
- Don't initialize OpenCV or Tesseract in `useEffect`. Initialize lazily inside the click handler (`onDetect`) via the memoized `getCv()` promise (Pattern 2). Module-level singletons naturally dedupe across double-mount.
- If an effect MUST run init (e.g. preload), track "did we really unmount" with a ref + microtask pattern identical to MapView.tsx lines 46-87.

**Warning signs:** Unit tests pass; dev mode double-fires; prod build "works" because StrictMode is a dev-only probe — but the bug is latent.

`[CITED: project precedent: src/components/MapView.tsx lines 46-87 and observation "MapView Bug Fixes Implemented: createPortal for Viewport Escape + StrictMode-Safe History Effect" (2026-04-17)]`

### Pitfall 4: Large-image memory pressure / OOM

**What goes wrong:** Admin uploads a 12MP iPhone photo of a printed floor plan (4000×3000, ~36MB decoded RGBA). `cv.imread` allocates another ~36MB. Intermediate `gray` + `blurred` Mats add ~18MB each. `HoughCircles` output + tight crops another ~50MB. Mobile Safari kills the tab.

**Why it happens:** Admins won't always feed a clean Canva export. Iteration on image size is not a CV algorithm problem — it's a memory budgeting problem.

**How to avoid:**
- Cap input at ~3000×3000 before `cv.imread`. If `naturalWidth > 3000 || naturalHeight > 3000`, downscale via `createImageBitmap(file, { resizeWidth: 2400, resizeQuality: 'high' })` before handing to detection.
- All stored coordinates are fractions; the downscale doesn't change coord accuracy for the guest app since the guest app scales coords at render time against the guest image.
- Free `ImageData` crops immediately after OCR (they're regular JS objects but each is 4 * W * H bytes).
- Single active detection run (queued button — see Pitfall 2).

**Warning signs:** "Aw, Snap!" crashes on Chrome. Tab reloads without explanation on iOS Safari. Admin reports it works on their laptop but not their phone.

### Pitfall 5: `navigator.clipboard.writeText` requires secure context

**What goes wrong:** Admin runs the setup tool from a file-protocol URL (`file:///…/dist/index.html`) or an internal HTTP-only host. The "Copy to Clipboard" button throws `TypeError: navigator.clipboard is undefined` or a `NotAllowedError`.

**Why it happens:** The Clipboard API is gated behind "secure context" — only `https://`, `http://localhost`, `http://127.0.0.1`, and `file://` are treated as secure by most browsers (and even `file://` has gaps on Firefox).

**How to avoid:**
- Setup tool is always served over HTTPS in production (static host enforces this).
- Locally, admin runs `npm run dev` (Vite dev server = `http://localhost:5173`) — secure context.
- Defensive UX: check `if (!navigator.clipboard) { showFallback(); }`, show the JSON in a readonly `<textarea>` preselected + "Cmd/Ctrl+C" hint.
- Also catch `NotAllowedError` (permissions denied) and fall back to the textarea.

**Warning signs:** Copy button appears to do nothing. No clipboard content changes. Console shows `TypeError` or `NotAllowedError`.

`[CITED: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API — "available only in secure contexts"]`

### Pitfall 6: Hough parameters brittle across image styles

**What goes wrong:** Defaults from §Pattern 3 work on the exact Reception Seat Diagram PNG. Admin uploads a different floor plan with thicker circle outlines or smaller tables. `HoughCircles` returns 3 circles instead of 54.

**Why it happens:** Hough Gradient's `param2` (accumulator threshold) is the single most sensitive knob; `minRadius`/`maxRadius` are second. What works for one line art weight doesn't work for another.

**How to avoid:**
- Ship defaults as `DEFAULT_HOUGH` constants in `detect.ts`. Export them.
- V1 does NOT expose tuning sliders (per CONTEXT "only build if defaults don't work").
- IF initial run on the Reception Seat Diagram produces fewer than ~45 circles or more than ~70, planner expands Wave 0 to add a simple "Tuning" sub-panel with 2-3 sliders: `param2` (10..100), `minRadius` (0.005..0.05 as fraction), `maxRadius` (0.02..0.08 as fraction). Slider UI is ~80 lines.
- Admin can always delete false positives + add missed tables in the review UI, so imperfect detection is recoverable.

**Warning signs:** Admin reports "only half the tables were found" or "there are pins on the walls". Both are recoverable; neither blocks shipping.

### Pitfall 7: File input `accept` permissiveness on mobile

**What goes wrong:** Admin opens `/setup` on an iPhone. `<input type=file accept="image/*">` lets them pick a HEIC photo. `createImageBitmap` on a HEIC blob fails in Chrome on Android but succeeds on Safari (HEIC is Apple-native). Cross-device inconsistency.

**Why it happens:** `accept="image/*"` lets OS file pickers surface any image format the OS can enumerate. Browser decoding support is narrower than OS listing support.

**How to avoid:**
- `accept="image/png,image/jpeg,image/webp,image/avif"` — whitelist explicitly.
- Try/catch around `createImageBitmap`; if decode fails, show: "This image format isn't supported. Please upload a PNG, JPEG, WebP, or AVIF."
- Admin is most likely on a desktop browser (Canva export workflow), but defensive UX is cheap.

**Warning signs:** iOS admin uploads a photo and gets a generic decode error.

### Pitfall 8: Vite may emit Tesseract worker/WASM assets outside the setup chunk

**What goes wrong:** `tesseract.js` loads its worker via a separate URL. Depending on how it's imported, Vite might copy the `tesseract.js-core` WASM into `dist/assets/` AND add the reference from the guest entry chunk (negates TOOL-03).

**Why it happens:** Static imports of `tesseract.js` from a module in the guest graph would pull it in. As long as every `import` of `tesseract.js` is inside a `src/setup/*` file, dynamic imports of `SetupApp` keep the dep graph isolated.

**How to avoid:**
- The only imports of `tesseract.js` and `@techstark/opencv-js` are inside `src/setup/`.
- The grep gate (§8) asserts the guest entry does NOT include the strings `tesseract` or `opencv` anywhere in its transitive chunks.
- For Tesseract's default behavior (loading core + worker + lang from jsDelivr CDN at runtime), no WASM file ends up in `dist/` at all — it's all CDN-fetched on demand. This is the simplest integration and what we recommend. `[CITED: tesseract.js local-installation.md — "If langPath is not specified by the user, language data will be automatically downloaded from the jsDelivr CDN"]`
- If Vite's module graph does pull tesseract worker assets into `dist/assets/`, verify (a) they're in a separate chunk named like `tesseract-<hash>.js` and (b) the guest entry chunk doesn't reference them. The grep gate catches both.

**Warning signs:** `dist/assets/index-*.js` contains the string `tesseract` or `opencv` after a build.

## Code Examples

### Upload → decoded image

```tsx
// src/setup/FileDrop.tsx
const ACCEPTED = 'image/png,image/jpeg,image/webp,image/avif';

export function FileDrop({ onImageReady }: { onImageReady: (bmp: ImageBitmap, name: string) => void }) {
  async function handleFile(file: File) {
    if (!ACCEPTED.split(',').includes(file.type)) {
      throw new Error('Unsupported image format. Use PNG, JPEG, WebP, or AVIF.');
    }
    // Cap at 3000px for memory safety (see Pitfall 4).
    const bmp = await createImageBitmap(file, {
      resizeWidth: Math.min(3000, 99999),
      resizeQuality: 'high',
    });
    onImageReady(bmp, file.name);
  }
  // ... drag/drop + <input type=file accept={ACCEPTED} onChange={e => handleFile(e.target.files![0])}/>
}
```

### Orchestration: detect → crop → OCR → draft pins

```ts
// src/setup/detect.ts — orchestration
import type { DraftPin } from './types';
import { detectCircles } from './detect';
import { recognizeCircles } from './ocr';

export async function runDetectionPipeline(
  bitmap: ImageBitmap,
  imageFileName: string,
  onProgress: (stage: string, done?: number, total?: number) => void,
): Promise<DraftPin[]> {
  onProgress('Preparing image…');
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);

  onProgress('Scanning for circles…');
  const circles = await detectCircles(canvas); // uses DEFAULT_HOUGH

  onProgress('Cropping circles…');
  const crops: ImageData[] = circles.map((c) => {
    const side = Math.ceil(c.r * 2);
    const x = Math.max(0, Math.floor(c.cx - c.r));
    const y = Math.max(0, Math.floor(c.cy - c.r));
    return ctx.getImageData(x, y, side, side);
  });

  onProgress('Reading circle numbers…', 0, crops.length);
  const ocr = await recognizeCircles(crops, (done, total) =>
    onProgress('Reading circle numbers…', done, total),
  );

  // Sequential OCR (loop in recognizeCircles). Promise.all would init one worker
  // per circle or contend for a single worker — net slower + heavier memory.
  // For ~54 circles at ~50ms each, sequential is ~3 s. Good enough.

  const pins: DraftPin[] = circles.map((c, i) => {
    const text = ocr[i].text.replace(/[^0-9]/g, '');
    return {
      id: crypto.randomUUID(),
      x: c.cx / bitmap.width,
      y: c.cy / bitmap.height,
      detectedRadius: c.r / bitmap.width, // kept as fraction for consistency
      tableNumber: text.length > 0 ? text : null,
      confidence: ocr[i].confidence,
      status:
        text.length === 0 ? 'needs-number'
          : ocr[i].confidence < 60 ? 'low-confidence'
          : 'ok',
    };
  });

  onProgress('Done');
  return pins;
}
```

### Export JSON (matches `src/config/floorPlan.json` byte-for-byte)

```ts
// src/setup/exportConfig.ts
import type { DraftPin } from './types';

export interface FloorPlanConfig {
  imageFileName: string;
  tablePositions: Record<string, { x: number; y: number }>;
}

function roundTo4(n: number): number {
  // Matches existing file convention — see src/config/floorPlan.json:
  //   "1": { "x": 0.2758, "y": 0.3854 },
  return Math.round(n * 10000) / 10000;
}

export function buildFloorPlanConfig(pins: DraftPin[], imageFileName: string): FloorPlanConfig {
  const tablePositions: FloorPlanConfig['tablePositions'] = {};
  // Sort by numeric tableNumber so export order matches the existing file.
  const sorted = [...pins].sort((a, b) => Number(a.tableNumber) - Number(b.tableNumber));
  for (const p of sorted) {
    if (p.tableNumber == null) continue;
    tablePositions[p.tableNumber] = { x: roundTo4(p.x), y: roundTo4(p.y) };
  }
  return { imageFileName, tablePositions };
}

// Two-space indent matches the existing file (verified by reading src/config/floorPlan.json).
export function serializeFloorPlanConfig(cfg: FloorPlanConfig): string {
  return JSON.stringify(cfg, null, 2) + '\n';
}
```

### Download + clipboard export

```ts
// src/setup/ExportPanel.tsx — action handlers
function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the blob URL on next tick — after the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function copyToClipboard(text: string): Promise<{ ok: boolean; error?: string }> {
  if (!navigator.clipboard) {
    return { ok: false, error: 'Clipboard unavailable in this context. Select and copy manually.' };
  }
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Copy failed.' };
  }
}
```

### Build-smoke grep gate (TOOL-03 enforcement)

```js
// scripts/verify-setup-split.mjs — NEW
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const dist = resolve('dist', 'assets');
if (!existsSync(dist)) {
  console.error(`verify-setup-split FAILED: ${dist} not found. Did vite build run?`);
  process.exit(1);
}

const files = readdirSync(dist);
const jsFiles = files.filter((f) => f.endsWith('.js'));

// 1. Guest entry (index-<hash>.js) must NOT mention opencv or tesseract.
const entryCandidates = jsFiles.filter((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f));
if (entryCandidates.length === 0) {
  console.error('verify-setup-split FAILED: no guest entry chunk found (expected index-*.js).');
  process.exit(1);
}

const forbidden = ['opencv', 'tesseract', 'SetupApp'];
const entryViolations = [];
for (const f of entryCandidates) {
  const content = readFileSync(resolve(dist, f), 'utf8');
  for (const needle of forbidden) {
    if (content.toLowerCase().includes(needle.toLowerCase())) {
      entryViolations.push({ file: f, needle });
    }
  }
}

if (entryViolations.length > 0) {
  console.error('verify-setup-split FAILED: forbidden strings found in guest entry:');
  for (const v of entryViolations) console.error(`  ${v.file}: "${v.needle}"`);
  process.exit(1);
}

// 2. A separate setup chunk MUST exist and MUST contain opencv + tesseract.
const setupCandidates = jsFiles.filter((f) => /setup|SetupApp/i.test(f));
const setupWithContent = setupCandidates.filter((f) => {
  const c = readFileSync(resolve(dist, f), 'utf8').toLowerCase();
  return c.includes('opencv') || c.includes('tesseract');
});

if (setupWithContent.length === 0) {
  console.error('verify-setup-split FAILED: no setup chunk found containing opencv/tesseract.');
  console.error('  Candidates checked:', setupCandidates);
  process.exit(1);
}

console.log('verify-setup-split passed.');
console.log('  Guest entry clean:', entryCandidates);
console.log('  Setup chunk(s):  ', setupWithContent);
```

**Wire into `package.json`:**
```json
{
  "scripts": {
    "build": "tsc && vite build && node scripts/verify-pwa-build.mjs && node scripts/verify-setup-split.mjs"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual click-to-place coord capture (TOOL-01 original spec) | Auto-detect + review (TOOL-04 promoted) | 2026-04-17 CONTEXT discuss | Planner builds the CV pipeline + review UI instead of a simple click handler; click-to-place becomes the "Add pin" interaction inside the review UI — not the whole tool. |
| `opencv-ts` + external CDN script tag | `@techstark/opencv-js` proper npm package | 2022+ | Npm-native integration means Vite can chunk it; no global `window.cv`; plays nicely with TypeScript strict mode. |
| Tesseract.js v2/v3 `createWorker(opts)` then `.load()` + `.loadLanguage()` + `.initialize()` | v7 `createWorker('eng', 1, opts)` single call | Tesseract.js v4+ (2023) | Simpler init; per-word confidence remained stable at 0-100. |
| `document.execCommand('copy')` | `navigator.clipboard.writeText` | Clipboard API stable cross-browser ~2021 | Promise-based, no iframe shim, works in secure contexts. |

**Deprecated/outdated:**
- `execCommand('copy')`: still shipped for compat but deprecated in the HTML spec. Do not use.
- Tesseract.js v1-v3 tutorials showing multi-step worker init: ignore; use v7 single-call pattern.
- `mirada`: opencv.js wrapper last released 2021. Don't adopt.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hough defaults (dp=1, minDist=cols*0.03, param1=100, param2=30, minRadius=cols*0.012, maxRadius=cols*0.035) will hit ≥90% recall on the Reception Seat Diagram | Pattern 3 | Admin gets fewer circles than expected on first detect; mitigation is the review UI (add missed pins) + optional Wave 0 tuning-slider escape hatch. Medium impact, low likelihood given the PNG is clean line-art. |
| A2 | `data.confidence` on tesseract.js v7 recognize is 0-100 overall for a single-word digit crop | Pattern 4 | If the shape changed in v7, our threshold (60) is meaningless and all pins flag as low-confidence or all as ok. Pin a v6/v7 integration test early in Wave 0. Low impact (easy to adjust). |
| A3 | Vite 6 default Rollup chunking places `SetupApp` + its transitive deps in a separate chunk from the guest entry when imported via `React.lazy` | Pattern 1 + §9 | Guest bundle bloats with CV deps. Mitigated by the grep gate (§8) which fails the build loudly. High impact, low likelihood (this is Rollup's documented default). |
| A4 | The Reception Seat Diagram has ~54 table circles at radius ~30-60px in a 2400px-wide image | Pattern 3 | Default radius range misses tables. Mitigated by review UI's Add Pin. Low impact. Confirm in Wave 0 by running detection on the real PNG. |
| A5 | Tesseract's default CDN fetch (jsDelivr) works for the admin during setup | Pattern 4 | If admin is offline or firewalled from jsDelivr, OCR init hangs. Document in README that `/setup` requires internet. Low impact. |

## Open Questions

1. **Should `FloorPlan.tsx` accept a `config` prop for live preview, or should the live preview use a forked component?**
   - What we know: Option A (add optional `config?` + `imageSrc?` props) is minimal and provably correct; Option B (fork) regresses the "test the guest code path" guarantee.
   - What's unclear: whether the guest-path preload behavior (`<picture>` with AVIF/WebP srcsets) can cleanly fall back to a plain `<img src={imageSrc}>` without visual regression in guest mode.
   - Recommendation: Option A. Add a guest-path regression test (existing `App.test.tsx` covers the default-prop path already) and verify the optional `imageSrc` branch in a new unit test.

2. **Does Tesseract pass `ImageData` directly to `worker.recognize`, or does it need a canvas / data URL?**
   - What we know: v7 `recognize` accepts `string | Buffer | ImageLike` per tessdoc. `ImageData` is in the `ImageLike` union historically.
   - What's unclear: whether passing raw `ImageData` works in all browser contexts or whether we must wrap in an `OffscreenCanvas` first.
   - Recommendation: prototype both in Wave 0. Fallback is to draw each `ImageData` into a fresh small canvas and pass the canvas. Adds ~1ms per circle; imperceptible.

3. **Are false-positive circles (walls, labels) going to spam the review UI?**
   - What we know: with `param2=30`, the Reception Seat Diagram may well produce 20-40% false positives (text rings, logo marks).
   - What's unclear: how painful "delete extras" interaction is at scale.
   - Recommendation: treat FP rate as a review-UX metric in Wave 0. If >50% of detected pins are FPs, tighten `param2` to 40 (fewer detections, more missed tables, but cleaner starting review state).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build + scripts | ✓ | 22.14.0 (per CLAUDE.md) | — |
| npm | install + scripts | ✓ | (ships with Node) | — |
| Vite 6 | Build system | ✓ | 6.0.1 | — |
| Vitest 4 | Unit tests | ✓ | 4.1.4 | — |
| `@techstark/opencv-js` | Circle detection | ✗ — will `npm install` | 4.12.0-release.1 | None needed; runtime-only dep for `/setup` |
| `tesseract.js` | OCR | ✗ — will `npm install` | 7.0.0 | None needed |
| Modern browser for admin (Chrome, Edge, Safari, Firefox) | Runtime CV + Clipboard API | Admin supplies | — | Copy-to-clipboard degrades to "select text" fallback (Pitfall 5) |
| Internet access (jsDelivr CDN) | Tesseract core + eng.traineddata first-load | Admin supplies | — | Document in README; cached in IndexedDB after first run |

**Missing dependencies with no fallback:**
- None that block execution. The two new npm packages are simple installs.

**Missing dependencies with fallback:**
- jsDelivr reachability: first-run only; cached after that. Document in README.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (existing) |
| Config file | (inline in vite.config — default Vitest behavior; `src/test/setup.ts` imports `@testing-library/jest-dom`) |
| Quick run command | `npm test -- src/setup` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-01 | Detection pipeline produces `DraftPin[]` from a fake image | unit | `npm test -- src/setup/detect.test.ts` | ❌ Wave 0 |
| TOOL-01 | Review UI renders pins, edit/drag/delete/add updates state | unit | `npm test -- src/setup/ReviewCanvas.test.tsx` | ❌ Wave 0 |
| TOOL-01 | Live preview renders with draft pins via `<FloorPlan/>` | unit | `npm test -- src/setup/LivePreview.test.tsx` | ❌ Wave 0 |
| TOOL-02 | `buildFloorPlanConfig` returns the exact shape of `src/config/floorPlan.json` (byte-comparison against fixture) | unit | `npm test -- src/setup/exportConfig.test.ts` | ❌ Wave 0 |
| TOOL-02 | Validation rejects duplicate table IDs / out-of-range coords / null numbers | unit | `npm test -- src/setup/validation.test.ts` | ❌ Wave 0 |
| TOOL-03 | `dist/assets/index-*.js` contains no `opencv`/`tesseract`/`SetupApp` strings | integration (build-smoke) | `npm run build` → runs `scripts/verify-setup-split.mjs` | ❌ Wave 0 (script + hook into build script) |
| TOOL-03 | A setup chunk exists and contains `opencv`+`tesseract` | integration (build-smoke) | same as above | ❌ Wave 0 |
| TOOL-04 | OCR digit-whitelist filters non-digit output | unit (mocked tesseract) | `npm test -- src/setup/ocr.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- src/setup` (<10s; mocks CV)
- **Per wave merge:** `npm test` (full Vitest suite)
- **Phase gate:** `npm run build` must exit 0 (TypeScript + Vite build + verify-pwa-build.mjs + verify-setup-split.mjs all green) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/setup/` directory + barrel (`index.ts` if useful) — creates the module boundary.
- [ ] `src/setup/types.ts` — `DraftPin`, `PipelineProgress`, `HoughOpts`.
- [ ] `src/setup/detect.ts` + `detect.test.ts` — mock `@techstark/opencv-js` via `vi.mock('@techstark/opencv-js', () => fakeCvWithHoughStub)`.
- [ ] `src/setup/ocr.ts` + `ocr.test.ts` — mock `tesseract.js` (`vi.mock('tesseract.js', () => ({ createWorker: async () => fakeWorker }))`).
- [ ] `src/setup/exportConfig.ts` + `exportConfig.test.ts` — fixture-compare against the current `src/config/floorPlan.json`.
- [ ] `src/setup/validation.ts` + `validation.test.ts`.
- [ ] `scripts/verify-setup-split.mjs` + wire into `package.json "build"`.
- [ ] `package.json` install: `npm install @techstark/opencv-js@^4.12.0 tesseract.js@^7.0.0`.
- [ ] First-run detection sanity check against the actual Reception Seat Diagram to calibrate Hough defaults (manual; record result in a follow-up note, not a test).

## Vite Configuration Specifics

**Does `vite.config.ts` need `build.rollupOptions.output.manualChunks` to force opencv/tesseract into a setup-only chunk?**

**No.** Rollup's default chunking (which Vite uses) places dynamically-imported modules and their transitive dependencies into separate chunks by default. Because `SetupApp` is only reached via `React.lazy(() => import('./setup/SetupApp'))` and nothing in the guest graph (`App.tsx`, `components/*`, `services/*`) imports from `src/setup/*`, the opencv/tesseract packages will naturally land in the setup chunk(s).

`[CITED: https://github.com/vitejs/vite/discussions/17730 — "Vite automatically creates separate JS chunks for LazyComponent, loaded only when the component is rendered"]`

**When to add `manualChunks`:** only if the grep gate (§8) fails on a build despite the lazy boundary. Two common causes:
1. A file in the guest graph accidentally imports from `src/setup/` — grep gate + code review catches this.
2. A shared dep with unusual re-export shape causes Rollup to hoist opencv/tesseract into a common chunk. Fix:
   ```ts
   // vite.config.ts — only if needed
   build: {
     rollupOptions: {
       output: {
         manualChunks: (id) => {
           if (id.includes('@techstark/opencv-js') || id.includes('tesseract.js')) {
             return 'setup-cv';
           }
         },
       },
     },
   }
   ```
   Adding this unconditionally is not harmful; adding it only if needed keeps the config minimal.

**`assetsInclude` for `.wasm`:** Not needed. Tesseract's default config fetches WASM from jsDelivr at runtime (not from our build). `@techstark/opencv-js` ships the WASM inline via its npm package; Vite handles it transparently — but since it's only imported from `src/setup/*`, it lives in the setup chunk graph.

## Out-of-Scope Confirmations

Confirmed NOT in this phase (per CONTEXT Deferred Ideas — do not reintroduce):
- **No auth on `/setup`.** Route obscurity only. Document clearly in README and on the setup page.
- **No localStorage draft recovery.** If admin closes the tab mid-review, work is lost. Acceptable for v1.
- **No repo write-back.** `Download` and `Copy` are the only export paths. Admin manually pastes into `src/config/floorPlan.json`.
- **No router library.** Pathname dispatch only. Any future sub-routes under `/setup` require rethinking this decision.
- **No multi-image / multi-floor-plan support.** Single image per session.
- **No Tesseract language other than `eng`.** Digits are Latin; `eng` trained data is sufficient.
- **No Hough parameter sliders in v1 UI.** Defaults must work; tuning UI is only added if defaults fail on the Reception Seat Diagram during Wave 0 calibration.

## Sources

### Primary (HIGH confidence)
- `npm view @techstark/opencv-js` — version 4.12.0-release.1 verified live 2026-04-17
- `npm view tesseract.js` — version 7.0.0 verified live 2026-04-17
- `src/config/floorPlan.json` — export shape contract read directly from repo
- `src/components/FloorPlan.tsx` — preview integration contract + existing pin SVG reused
- `src/components/MapView.tsx` — StrictMode + createPortal patterns read directly
- `src/main.tsx` — current entry shape for pathname-dispatch edit
- `scripts/verify-pwa-build.mjs` — precedent shape for new grep gate
- `vite.config.ts` — existing plugin chain for PWA build
- `package.json` — existing scripts chain to extend with new verify step
- [TechStark/opencv-js README — integration pattern + runtime init](https://github.com/TechStark/opencv-js)
- [Tesseract.js API docs — createWorker + setParameters + recognize](https://github.com/naptha/tesseract.js/blob/master/docs/api.md)
- [Tesseract.js local-installation — default CDN paths](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md)

### Secondary (MEDIUM confidence — verified with official source)
- [OpenCV Hough Circle Transform tutorial (JS)](https://docs.opencv.org/4.x/d3/de5/tutorial_js_houghcircles.html) — HoughCircles parameter semantics (403 on direct WebFetch; signature cross-verified via multiple community sources)
- [OpenCV issue #20409 — cv.Mat memory management](https://github.com/opencv/opencv/issues/20409) — `.delete()` discipline
- [Vite discussion #17730 — dynamic imports + code splitting](https://github.com/vitejs/vite/discussions/17730) — default chunking behavior
- [Vite issue #17653 — manualChunks vs React.lazy interactions](https://github.com/vitejs/vite/issues/17653) — when manualChunks breaks lazy loading
- [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) — secure-context requirement
- [Tesseract.js GitHub repo](https://github.com/naptha/tesseract.js) — v6→v7 upgrade notes + per-word confidence
- [Image to Text OCR with Tesseract.js](https://bensonruan.com/image-to-text-ocr-with-tesseract-js/) — practical recognize()/confidence patterns
- [TechStark/opencv-js issue #56 — in-place ops cause leaks](https://github.com/TechStark/opencv-js/issues/56) — use separate output Mats

### Tertiary (LOW confidence — informational)
- [Hough Circle parameter tuning with examples](https://medium.com/@isinsuarici/hough-circle-transform-parameter-tuning-with-examples-6b63478377c9) — community tuning examples (used to bound default ranges)
- [Tesseract.js confidence thresholds](https://app.studyraid.com/en/read/15018/519349/adjusting-confidence-thresholds-in-tesseractjs) — threshold guidance (our `60` default)
- [LearnOpenCV — Hough Transform](https://learnopencv.com/hough-transform-with-opencv-c-python/) — conceptual background

## Metadata

**Confidence breakdown:**
- **Route-split architecture (§1):** HIGH — Rollup default behavior + React.lazy is documented; grep gate catches regressions.
- **OpenCV.js integration (§2):** HIGH for package choice + init pattern + Mat lifecycle; MEDIUM for specific Hough defaults on the target image (requires Wave 0 calibration).
- **Tesseract.js integration (§3):** HIGH for v7 API + digit whitelist + CDN default; MEDIUM on exact `data.confidence` interpretation (marked A2 in Assumptions Log).
- **Detection orchestration (§4):** HIGH — sequential crops + single worker is the straightforward path.
- **Review UI data model (§5):** HIGH — `DraftPin` fields come directly from CONTEXT decisions.
- **Live preview integration (§6):** MEDIUM — depends on adding two optional props to `FloorPlan.tsx` (Open Question 1).
- **Export mechanics (§7):** HIGH — Blob + Clipboard API are web standards; fixture comparison against existing JSON.
- **Bundle-isolation verification (§8):** HIGH — grep gate approach is proven by Phase 4 precedent.
- **Vite config specifics (§9):** HIGH — default chunking verified by community sources; manualChunks is a fallback.
- **Test patterns (§10):** HIGH — vitest + mocks is standard; fixture comparison for export is exact.
- **Pitfalls (§11):** HIGH — all 8 pitfalls map to concrete upstream issues/docs or project precedent.
- **Out-of-scope (§12):** HIGH — verbatim from CONTEXT Deferred Ideas.

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days — stable ecosystem; re-verify opencv.js + tesseract.js versions if a new release ships before implementation)
