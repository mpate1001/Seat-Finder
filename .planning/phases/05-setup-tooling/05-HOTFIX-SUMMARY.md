# Phase 5 Hotfix — Detection pipeline hang + UX polish

**Session:** 2026-04-18 afternoon through evening
**Commits:** `7dcc253` → `7d83509` → `d6d657a` → `733c0ca` → `6c09f26` on `dev`
**Status:** Code-complete. Pending admin UAT (`05-UAT.md`).

---

## What broke

After Plan 07 landed all seven Phase 5 plans with 126 vitest specs green, the admin clicked **Detect tables** in `/setup` and the UI froze on "Scanning for circles…" — eventually tripping Chrome's Page Unresponsive watchdog. Three preceding param-tuning rounds (`bc23627` → `a4e0844` → `3f96916`) had tightened `param2` 30 → 50 → 80, narrowed the radius range, and dropped `MAX_DIMENSION` 3000 → 1200 → 800 → 600 in pursuit of "make Hough fast enough for the main thread." None of them found circles; all of them still hung.

## What was actually wrong

Two bugs stacked, each hiding behind the other's symptoms:

### Bug 1 — Synchronous WASM Hough on the main thread

`cv.HoughCircles` is a blocking WASM call. Even after the tuning reductions, a ~12 ms call on a 600×458 canvas isn't the problem — what blocked the thread was the preceding **10.8 MB of OpenCV JS evaluation at SetupApp mount time**. Vite pulled `@techstark/opencv-js` into the SetupApp chunk because `detect.ts` had `export { getCv } from './detect.core'` — a convenience re-export with zero production consumers. When the admin opened `/setup`, the browser parsed 10 MB of Emscripten bootstrap on the main thread during chunk load, *then* the user clicked Detect and Hough ran inside what should have been a worker but wasn't because:

### Bug 2 — Emscripten thenable absorption

`@techstark/opencv-js` ships its Module object as the default export. That Module has a `.then` method (`MODULARIZE=1` convention, so `await ModuleFactory()` resolves when the runtime is ready). Our `getCv()` was an `async` IIFE that, after onRuntimeInitialized fired, did `return mod`. The Promise resolution protocol saw `.then` on `mod`, classified it as a thenable, and re-awaited it. But `Module.then` only calls its callback the first time — once runtime init has fired, subsequent `.then(cb)` never invokes `cb`. Result: the outer `await getCv()` hung forever. Console logs proved the inner promise resolved and the IIFE ran to completion; the `await` in `detectCirclesFromImageData` never unblocked.

Both bugs produced the same visible symptom ("Scanning for circles…" stuck). Three full diagnostic cycles (including a macrotask-yield red herring) before spotting bug 2.

## Fixes

### `7dcc253` fix(setup): offload Hough detection to Web Worker + restore 05-02 calibration

- Split `detect.ts` into three modules:
  - `detect.core.ts` — `getCv()` + `detectCirclesFromImageData()`, worker-agnostic, pure algorithm
  - `detect.worker.ts` — module worker wrapping core, transferable ImageData protocol
  - `detect.ts` — main-thread dispatcher, memoized Worker, public `detectCircles(canvas)` signature preserved so `pipeline.ts` needs zero edits
- **Thenable strip**: `Object.defineProperty(mod, 'then', { value: undefined, configurable: true })` inside `getCv` before returning. Idempotent, safe, load-bearing.
- **Re-export removed** from `detect.ts` — cuts OpenCV out of the SetupApp main-thread chunk. SetupApp chunk: 10.8 MB → 36 KB.
- Hough calibration restored to 05-02 values now that compute constraint is gone: `param2=30`, radii 0.012/0.035 × w, min-dist 0.03 × w.
- `MAX_DIMENSION` raised back to 1200 for better recall (worker handles ~50 ms Hough at that resolution).
- Tests split: `detect.core.test.ts` (pure algorithm, 7 retargeted specs) + `detect.test.ts` (9 new worker-dispatch specs with Worker stub covering memoization, id correlation, error propagation, concurrent requests).

### `7d83509` feat(setup): upscale 3× + binarize + PSM 8 for OCR accuracy

First post-worker UAT returned Hough circles correctly (~63 tables detected) but OCR was weak — 2 of 63 pins passed the 60-confidence OK gate; most returned `?` or garbage like "427" for table 42. Three preprocessing steps inside `ocr.ts`:

- **3× upscale** via canvas `drawImage` high-quality resampling. 60-90 px crops → 180-270 px — Tesseract's trained glyph-size sweet spot.
- **Grayscale + binary threshold** at luminance 160 (Rec. 601). Kills chair-icon fans around each circle.
- **PSM 8** (`tessedit_pageseg_mode: '8'`) — single-word mode, skips layout re-segmentation.

OffscreenCanvas polyfill in `src/test/setup.ts` extended with `drawImage`, `getImageData`, `imageSmoothingEnabled`/`Quality`.

### `d6d657a` fix(setup): review + preview canvases fit their panes instead of viewport

Two admin-tool CSS regressions surfaced once detection worked end-to-end:

- **LivePreview** embedded the real guest `<FloorPlan/>`, whose CSS set `min-width: 100vw; min-height: 100dvh` for the guest path — blew out the side-by-side review column horizontally. Scoped override under `.live-preview-root` resets mins and sizes to the pane.
- **ReviewCanvas** had `max-height: 60vh + overflow: auto`; pins at the bottom edge (doorway `?` placeholders) plus their × delete buttons were clipped below the scroll fold. Restructured to track the image's aspect-ratio via an inline style (`aspectRatio: ${imageNaturalWidth} / ${imageNaturalHeight}`), clamped with `max-width: 100%` + `max-height: 85vh`; image uses `object-fit: contain`. Pin %-coords stay aligned at every viewport size.

### `733c0ca` chore(build): extend setup-split gate + PWA precache exclusion for worker

- `verify-setup-split.mjs` regex broadened to `/setup|SetupApp|detect\.worker/i` so either the SetupApp chunk or the new worker chunk can satisfy the positive CV-chunk assertion.
- `vite.config.ts` `workbox.globIgnores` adds `**/detect.worker-*.js` alongside the existing SetupApp exclusion — the 10.8 MB worker chunk stays out of PWA precache.

### `6c09f26` tune(setup): drop OK confidence threshold 60 → 40

Tesseract confidence scores systematically run lower on binarized line-art than on raw photography. The 60 cutoff buried ~70% of correctly-read pins in low-confidence during first post-polish UAT. Dropped `LOW_CONFIDENCE_THRESHOLD` to 40 in `pipeline.ts` — reads < 40 (genuinely ambiguous glyphs) still flag for review; the rest promote to OK.

---

## End-state verification

- `npm run test`: 135 / 135 green (was 126; +7 for detect.core split, +9 for worker dispatch, −7 removed from old detect.test.ts = net +9)
- `npm run build`: tsc clean, vite emits correct chunk split, `verify-pwa-build` + `verify-setup-split` both pass
- `npm run lint`: max-warnings 0 clean
- Chunk sizes:
  - Guest entry: 220 KB (unchanged from pre-Phase-5)
  - SetupApp: 36 KB (was 10.8 MB pre-fix)
  - detect.worker: 10.8 MB (admin-only, excluded from PWA precache)
- End-to-end Hough + OCR pipeline on admin upload of `public/FINAL_Reception Table Arrangments.png` (3000×2289): ~163 ms detection + per-crop OCR

---

## Open UAT items

`05-UAT.md` checklist was never ticked through — the session was dominated by diagnosing the hang, not running through the full device matrix. Remaining items are device/environment coverage only; code is ready:

- 1a/1b build gate — should pass on first try (verified in-session)
- 2a guest regression — no reason to believe broken; quick sanity check
- 3-6 setup flow against real admin upload — this is where the new preprocessing/threshold tuning gets its real verdict
- 7 byte-equivalence export — no changes touched export logic
- 8 offline / PWA precache behavior — worker chunk explicitly excluded, confirm no 404s

---

## Memories captured

- `memory/phase5_detection_hang.md` — project-type memory replacing the stale "Hough too slow" note with the actual two-bug diagnosis.
- `memory/emscripten_thenable_trap.md` — feedback-type memory capturing the thenable-absorption trap for any future Emscripten work (`ffmpeg.wasm`, `libvips-wasm`, other OpenCV forks all have the same `.then`).
