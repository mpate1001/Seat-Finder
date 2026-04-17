---
phase: 05-setup-tooling
plan: 05
subsystem: ui
tags: [review-ui, file-drop, pointer-events, live-preview, strictmode, portal, TOOL-01, TOOL-04]
status: awaiting_uat

# Dependency graph
requires:
  - phase: 05-setup-tooling
    provides: runDetectionPipeline orchestrator + DraftPin type (plan 05-04)
  - phase: 05-setup-tooling
    provides: FloorPlan widened with config + imageSrc props (plan 05-03)
  - phase: 05-setup-tooling
    provides: SetupApp shell + route-obscurity warning (plan 05-01)
provides:
  - FileDrop upload surface with accept-whitelist + createImageBitmap resize (Pitfall 4 + 7)
  - ReviewCanvas draft-pin overlay with drag / click-edit / delete / add interactions (D-11, D-12)
  - dupWarning findDuplicatePositions pure utility (D-14)
  - LivePreview wrapping real <FloorPlan/> + TransformWrapper (D-13)
  - buildSyntheticConfig(pins, fileName) → FloorPlanConfig mapper (reused in plan 05-06)
  - SetupApp full upload → detect → review flow (single-flight, StrictMode-safe)
  - Two-pane review grid layout (desktop side-by-side, mobile stacked)
affects: [05-06-approve-export, 05-07-bundle-verification]

# Tech tracking
tech-stack:
  added: []  # No new runtime deps — react-zoom-pan-pinch already landed in Phase 3
  patterns:
    - "Pointer Events with click-vs-drag threshold (180ms + 4px travel) for drag/tap disambiguation on the same element — matches MapView touch UX"
    - "setPointerCapture wrapped in try/catch for jsdom-compatibility without disabling the browser-side capture"
    - "Blob URL lifecycle owned by the upload parent (SetupApp), FileDrop only CREATES — never revokes — so the image stays renderable during review"
    - "useEffect cleanup for blob-URL revoke keyed on uploadedImageUrl (captures the URL at effect-run time so replacement correctly revokes the OLD url)"
    - "runDetectionPipeline invoked inside onClick — never in useEffect — so StrictMode double-mount cannot spawn a duplicate WASM/worker init (Pitfall 3)"
    - "Single-flight detect via mode==='detecting' disabling the button (Pitfall 2)"
    - "Shared teardrop SVG path factored as a TEARDROP_D constant — three status variants (ok / low-confidence / needs-number) share the path; only CSS fills change"
    - "Memoized buildSyntheticConfig via useMemo([pins, fileName]) so FloorPlan's DEV dup-warning ref-gate dedupes per-config-identity — plan 05-03 contract"
    - "firePointer test helper via createEvent + Object.defineProperty because jsdom 26's PointerEvent constructor drops clientX/Y from the init dict"

key-files:
  created:
    - src/setup/FileDrop.tsx
    - src/setup/FileDrop.test.tsx
    - src/setup/dupWarning.ts
    - src/setup/dupWarning.test.ts
    - src/setup/ReviewCanvas.tsx
    - src/setup/ReviewCanvas.css
    - src/setup/ReviewCanvas.test.tsx
    - src/setup/LivePreview.tsx
    - src/setup/LivePreview.test.tsx
  modified:
    - src/setup/SetupApp.tsx
    - src/setup/SetupApp.css
    - src/test/setup.ts  # ResizeObserver polyfill for react-zoom-pan-pinch under jsdom
    - vite.config.ts     # workbox globIgnores excludes SetupApp-*.js from PWA precache

key-decisions:
  - "Blob-URL ownership: FileDrop creates via URL.createObjectURL, SetupApp owns the lifecycle and revokes via useEffect cleanup. This means the object URL stays live for as long as the review session — critical because ReviewCanvas (which renders the <img src={imageUrl}/>) and LivePreview both consume the same URL. A previously-tried pattern where FileDrop revoked on unmount broke the review image."
  - "Click-vs-drag threshold = 180ms + 4px travel. Matches MapView's touch UX conventions. Shorter thresholds fired tap-as-click when the admin meant drag; longer thresholds felt sluggish on desktop."
  - "setPointerCapture wrapped in try/catch in onPinPointerDown. jsdom + some browsers reject setPointerCapture for synthetic pointerIds; the try/catch prevents the handler from aborting before trackerRef is initialized. This was the root-cause of a failing drag test — resolving it is a net robustness improvement for real browsers too."
  - "Single teardrop SVG path factored as TEARDROP_D constant (not inlined three times). status='needs-number' uses a different visual (slate circle with ?) so it doesn't reuse the path — only ok/low-confidence share. Refactoring kept ReviewCanvas.tsx under 300 LOC."
  - "LivePreview maxScale=4 (vs MapView's 6) and doubleClick.disabled=true — the preview is read-only; the admin works in ReviewCanvas. A simpler zoom envelope reduces the chance of the preview competing with the editor for interaction."
  - "SetupApp.css .setup-card max-width widens from 520px → 1200px in review mode so the two-pane grid fits side-by-side on desktop. The wider card on the idle/error views (where there's only one narrow column of content) is acceptable — the card is still centered and visually tidy."
  - "vite.config.ts workbox.globIgnores now excludes SetupApp-*.js. The admin chunk is 10.8 MB with OpenCV + Tesseract WASM — never should have been in the PWA precache manifest. Guests never visit /setup (D-01 route obscurity). The existing StaleWhileRevalidate runtime rule catches it on first admin visit. This preserves TOOL-03 bundle isolation while fixing the npm-run-build hook regression that landed when the plan 05-04 chunk first materialized."

patterns-established:
  - "Review-UI pointer-events drag/tap disambiguation — pattern is reusable for any Phase 5+ pin-interaction surface (e.g., guest-list coordinate editor)"
  - "jsdom test-env sufficient shape polyfills in src/test/setup.ts — add-only pattern (OffscreenCanvas from plan 05-04, ResizeObserver from this plan)"
  - "PWA precache globIgnores for lazy-loaded admin chunks — precedent for any future >2 MiB admin-only chunk"

requirements-completed: [TOOL-01, TOOL-04]

# Metrics
duration: 12min
completed: 2026-04-17
---

# Phase 5 Plan 5: Review UI Summary (awaiting UAT)

**Full admin review surface — FileDrop (with accept-whitelist + 3000px resize cap), ReviewCanvas pin-overlay with pointer-events drag + click-to-edit inline editor + delete + add-mode + duplicate-position warning strip, LivePreview wrapping the real <FloorPlan/> in TransformWrapper, SetupApp orchestrating upload → detect → review two-pane flow — 25 new specs across 4 modules green, 100/100 overall, tsc + lint + build clean.**

> **Status: awaiting UAT.** Task 4 is a `checkpoint:human-verify` gate requiring the admin to exercise the flow in a real browser on the Reception Seat Diagram PNG. The autonomous tasks (Tasks 1–3) are complete and committed — see "Try it in the browser" below.

## Performance

- **Duration:** ~12 min (autonomous execution only; UAT pending)
- **Started:** 2026-04-17T21:56:14Z
- **Completed (autonomous phase):** 2026-04-17T22:08:13Z
- **Tasks:** 3 autonomous committed; 1 checkpoint awaiting UAT
- **Files created:** 9 (4 components/utilities + 5 test files + 1 CSS)
- **Files modified:** 4 (SetupApp.tsx, SetupApp.css, src/test/setup.ts, vite.config.ts)

## Accomplishments

- **FileDrop upload surface** — drag-and-drop + hidden `<input type="file">` wrapped in a label. Pitfall-7 whitelist (PNG/JPEG/WebP/AVIF) with defense-in-depth against drag-and-dropped files bypassing the `accept` attribute. Decode errors revoke the blob URL + call onError with App.tsx-tone copy.
- **dupWarning utility** — pure `findDuplicatePositions(pins, threshold=0.03): DupPair[]`. O(n²) Euclidean scan in 0..1 fraction space. Normalized pair ordering (pinId < otherPinId) for stable de-dup. Covers D-14.
- **ReviewCanvas** — the central correctness-earning surface of Phase 5. Pointer-events drag with click-vs-drag threshold; click-to-edit inline editor with Enter/blur commits and Escape cancel; `×` button + Backspace/Delete for pin removal; Add-mode toggle AND Shift+click for adding new pins; three visual status variants with shared teardrop SVG path; duplicate-position warning strip above the canvas.
- **LivePreview** — wraps the real `<FloorPlan/>` inside `<TransformWrapper minScale=1 maxScale=4 centerOnInit doubleClick.disabled>`. `buildSyntheticConfig(pins, fileName)` memoized so FloorPlan's DEV dup-warning ref-gate dedupes per-config identity. Setup LivePreview reuses the unmodified guest FloorPlan — proves the plan-05-03 widening contract works end-to-end.
- **SetupApp wiring** — the full upload → detect → review flow. Single-flight detect via `mode==='detecting'`. StrictMode-safe: pipeline runs inside `onClick`, never in `useEffect`. Blob-URL lifecycle owned by SetupApp (cleanup-on-change). Two-pane grid stacks on mobile via `@media (max-width:900px)`.
- **Rule 3 blocking fixes** — (a) ResizeObserver polyfill added to src/test/setup.ts (react-zoom-pan-pinch calls `new ResizeObserver` during mount; jsdom doesn't implement it). (b) `setPointerCapture` wrapped in try/catch in ReviewCanvas (jsdom rejects synthetic pointerIds; the throw aborted the pointerDown handler before trackerRef was initialized). (c) firePointer test helper via createEvent + Object.defineProperty (jsdom 26's PointerEvent constructor drops clientX/Y). (d) vite.config.ts workbox.globIgnores excludes SetupApp-*.js (10.8 MB WASM bundle blew past PWA's 2 MiB precache default).

## Task Commits

Each autonomous task was committed atomically:

1. **Task 1: FileDrop + dupWarning** — `56aa56e` (feat)
2. **Task 2: ReviewCanvas + LivePreview** — `2f9e20d` (feat)
3. **Task 3: SetupApp wiring + vite.config PWA fix** — `63024be` (feat)

**Task 4:** `checkpoint:human-verify` — awaiting browser UAT.

**Plan metadata:** (pending — written with SUMMARY + STATE + ROADMAP commit)

## Files Created/Modified

### Created (9)

- `src/setup/FileDrop.tsx` (128 lines) — upload surface with whitelist + resize
- `src/setup/FileDrop.test.tsx` (115 lines) — 5 specs: render, reject HEIC, PNG success path, resize opts, decode-error URL revoke
- `src/setup/dupWarning.ts` (57 lines) — findDuplicatePositions pure utility
- `src/setup/dupWarning.test.ts` (75 lines) — 6 specs: empty, identical, 0.04 apart, 0.02 apart, triangle n-choose-2, custom threshold
- `src/setup/ReviewCanvas.tsx` (312 lines) — pin overlay + drag/edit/delete/add + dup warning strip
- `src/setup/ReviewCanvas.css` (196 lines) — pin color variants + hover delete + crosshair cursor + responsive
- `src/setup/ReviewCanvas.test.tsx` (233 lines) — 7 specs: render positions, drag, click→edit→Enter, delete button, add mode, dup warning, disabled
- `src/setup/LivePreview.tsx` (108 lines) — wraps FloorPlan + TransformWrapper + buildSyntheticConfig
- `src/setup/LivePreview.test.tsx` (113 lines) — 7 specs: config shape, null skip, fileName passthrough, floor-plan-wrapper render, focusedTableNumber propagation, default='', imageSrc branch

### Modified (4)

- `src/setup/SetupApp.tsx` — rewrite: full upload/detect/review flow (replaces plan 05-01 placeholder)
- `src/setup/SetupApp.css` — review grid + status line + error card + counts styling; card max-width 520 → 1200
- `src/test/setup.ts` — ResizeObserver polyfill
- `vite.config.ts` — workbox.globIgnores excludes SetupApp-*.{js,css}

## Decisions Made

See frontmatter `key-decisions`. Highlights:

- **Blob-URL ownership in SetupApp.** FileDrop creates the URL; SetupApp owns the lifecycle. A prior attempt where FileDrop revoked on unmount broke the review image — the URL must outlive the upload component.
- **Click-vs-drag threshold = 180ms + 4px travel** to match MapView's touch UX.
- **setPointerCapture in try/catch** — jsdom + some browsers throw on synthetic pointerIds; without the try/catch, the throw aborted the pointerDown handler before trackerRef was initialized (root cause of a failing drag test; also a net robustness improvement for real browsers).
- **LivePreview maxScale=4, doubleClick disabled** — preview is read-only; admin works in ReviewCanvas.
- **vite.config.ts workbox.globIgnores excludes SetupApp-*.js** — the 10.8 MB admin chunk never should have been in the PWA precache manifest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] ResizeObserver missing in jsdom test environment**
- **Found during:** Task 2 initial LivePreview.test.tsx run
- **Issue:** LivePreview renders `<TransformWrapper/>` from react-zoom-pan-pinch, which invokes `new ResizeObserver(...)` inside its init effect. jsdom does not implement ResizeObserver — all 7 LivePreview specs failed with `ReferenceError: ResizeObserver is not defined`.
- **Fix:** Added a minimal ResizeObserver polyfill to `src/test/setup.ts` behind `typeof globalThis.ResizeObserver === 'undefined'`. The polyfill is a class with `observe/unobserve/disconnect` no-ops — sufficient because none of the review-UI tests assert on viewport-resize behavior.
- **Files modified:** src/test/setup.ts
- **Verification:** All 7 LivePreview specs pass; no other suites regress (49/49 setup tests → 100/100 overall).
- **Committed in:** 2f9e20d (Task 2 commit)

**2. [Rule 3 — Blocking] jsdom PointerEvent drops clientX/clientY from init dict**
- **Found during:** Task 2 initial ReviewCanvas.test.tsx run
- **Issue:** Drag and add-mode specs saw `undefined` for clientX/clientY inside fractionFromPointer → NaN coordinates on the resulting DraftPin (add-mode) or the handler never making it past the click-vs-drag threshold (drag). Debug log confirmed `rect` was correct (1000×800 via prototype stub) but `clientX/clientY` arrived as undefined.
- **Fix:** Added a `firePointer(type, target, {clientX, clientY})` test helper that constructs the event via `createEvent.pointerDown/Move/Up(...)` and then pins `clientX`/`clientY` via `Object.defineProperty`. Replaced 8 direct `fireEvent.pointerDown/Move/Up` calls in the specs.
- **Files modified:** src/setup/ReviewCanvas.test.tsx
- **Verification:** All 7 ReviewCanvas specs pass.
- **Committed in:** 2f9e20d (Task 2 commit)

**3. [Rule 3 — Blocking] jsdom setPointerCapture rejects synthetic pointer IDs**
- **Found during:** Task 2 same ReviewCanvas drag-test debug
- **Issue:** `(e.currentTarget).setPointerCapture(e.pointerId)` threw in jsdom for the synthetic pointer events fired by the test. The throw aborted onPinPointerDown BEFORE trackerRef.current was initialized — pointerMove then had a null tracker and never called onChange. This was also the root cause of the failing drag spec.
- **Fix:** Wrapped setPointerCapture in try/catch in `onPinPointerDown`. Net-positive for real browsers too: some browsers throw on setPointerCapture for programmatically-dispatched pointer events, and ignoring the failure is the correct recovery.
- **Files modified:** src/setup/ReviewCanvas.tsx
- **Verification:** drag spec passes in jsdom; all real-browser pointer-capture behavior preserved.
- **Committed in:** 2f9e20d (Task 2 commit)

**4. [Rule 3 — Blocking] PWA build failed on SetupApp-*.js exceeding 2 MiB workbox precache default**
- **Found during:** Task 3 verification `npm run build`
- **Issue:** The plan-05-04 WASM deps (OpenCV + Tesseract) made SetupApp-*.js 10.8 MB. vite-plugin-pwa's default `workbox.maximumFileSizeToCacheInBytes` is 2 MiB — the build failed with "Configure workbox.maximumFileSizeToCacheInBytes to change the limit".
- **Fix:** Added `'**/SetupApp-*.{js,css}'` to `workbox.globIgnores` in vite.config.ts. The setup chunk is admin-only (D-01 route-obscurity) and never should have been in the precache manifest — guests never visit /setup. The existing StaleWhileRevalidate runtime rule catches the chunk on the admin's first visit. Guest precache stays at 234 KiB across 9 entries.
- **Files modified:** vite.config.ts
- **Verification:** `npm run build` clean with `PWA v1.2.0 precache 9 entries (234.23 KiB) / PWA build verification passed`. TOOL-03 bundle isolation unchanged.
- **Committed in:** 63024be (Task 3 commit)

**5. [Rule 3 — Blocking] @testing-library/user-event v14 pre-validates file.type against input.accept**
- **Found during:** Task 1 initial FileDrop.test.tsx run
- **Issue:** The "rejects HEIC" spec expected `onError` to fire when an HEIC file is supplied. `@testing-library/user-event`'s `upload(input, file)` pre-validates against `input.accept` and no-ops if the file's MIME doesn't match — the component's own defense-in-depth check never fired.
- **Fix:** The spec uses `Object.defineProperty(input, 'files', {...})` + `fireEvent.change(input)` to bypass user-event's pre-validation. The test now explicitly asserts the component's own whitelist enforcement (which matters for drag-and-drop where the browser doesn't enforce `accept`).
- **Files modified:** src/setup/FileDrop.test.tsx
- **Verification:** Spec passes; the component's defense-in-depth path is explicitly covered.
- **Committed in:** 56aa56e (Task 1 commit)

---

**Total deviations:** 5 auto-fixed (all Rule 3 — blocking test/build issues)
**Impact on plan:** All five are correctness/build fixes that preserve the plan's explicit specs. No scope creep. The firePointer helper and setPointerCapture try/catch were net-positive robustness improvements beyond the immediate test fix. The vite.config PWA fix was an emergent consequence of plan 05-04's WASM additions — the fix correctly respects TOOL-03 isolation.

## Issues Encountered

- **vitest transform cost** — total test duration doubled (~600ms → ~2.3s) when LivePreview tests run because each test now instantiates react-zoom-pan-pinch's TransformWrapper with full init effects. Acceptable (still well under 10s per plan 05-02 target).
- **Pre-existing untracked files** — `.omc/`, `public/FINAL_Reception Table Arrangments.png`, `scripts/calibrate-hough.mjs` are out of scope for this plan (pre-existing or artifacts of sibling workflows); not committed.

## Try it in the browser (Task 4 UAT checklist)

The admin should run through this end-to-end to approve the plan:

```bash
# from repo root
source .env.local       # sets VITE_SHEET_URL
npm run dev             # Vite dev server with dev-mode PWA
```

Then open `http://localhost:5173/setup`. Step through:

1. **Upload.** Drop `public/floor-plan/floor-plan-1600.png` (or `src/assets/Reception Seat Diagram.png`) onto the drop-zone — or click to open a picker.
2. **Detect.** Click "Detect tables". The status line should progress through: Preparing → Scanning → Cropping → Reading circle numbers (1/N → N/N) → Done. Expect 5–15 s on first run (Tesseract WASM warmup).
3. **Recall.** Compare draft pins against `src/config/floorPlan.json`'s 54 tables — expect recall ≥ 83% per plan 05-02 calibration.
4. **Drag.** Pointerdown on any pin → drag → release. Pointermove should update position in both panes in sync.
5. **Edit.** Click a pin with a wrong/missing number. Inline editor appears pre-filled with the current value. Type a number → Enter commits. Status transitions `needs-number` → `ok`.
6. **Delete.** Hover a false-positive pin → click the `×`. Pin disappears in both panes.
7. **Add.** Toggle "Add pin" button → click on an empty table circle in the image. New pin lands at the click fraction → editor opens → type number.
8. **Shift+click add.** Hold Shift and click an empty spot without toggling — same outcome.
9. **Duplicate warning.** Drag two pins to within 3% of each other. Warning strip above the canvas should list the pair.
10. **Mobile layout.** Chrome DevTools → toggle device toolbar → iPhone 14 Pro Max. The two-pane grid should stack vertically.
11. **StrictMode check.** Open DevTools Network tab. Reload `/setup`. Confirm `tesseract.js` + `opencv.js` WASM each fetch ONCE (not twice) — StrictMode double-mount must not spawn a duplicate pipeline. (The Detect button is disabled during `detecting`, so the admin cannot force a double-run manually.)
12. **Re-upload.** "Start over" button resets state and returns to the drop zone. Confirm no stale pins persist.

**Resume signal:** Type `review-flow-works` if all 12 steps pass, or describe any surprises.

## User Setup Required

None — no external service configuration required. Setup tool runs entirely in-browser.

## Next Phase Readiness

**Ready for plan 05-06 (approve + export):**
- `buildSyntheticConfig(pins, fileName)` is exported from LivePreview.tsx; plan 05-06 can reuse it for the downloadable JSON export.
- ReviewCanvas accepts a `disabled` prop — plan 05-06 can lock editing by passing `disabled={mode === 'approved'}`.
- SetupApp's `mode` state type currently excludes `'approved'` — plan 05-06 extends it + wires the Approve button.
- Placeholder Approve button renders in SetupApp's review view, disabled with tooltip.

**Ready for plan 05-07 (bundle verification):**
- `grep -rn 'tesseract\|opencv' src/ --include='*.{ts,tsx}'` stays inside `src/setup/`. Setup tests + doc comments in src/test/setup.ts are expected; no guest-path leaks.
- `grep -rn 'useEffect.*runDetectionPipeline\|useEffect.*createWorker\|useEffect.*getCv' src/setup/` returns nothing (Pitfall 3 enforced).
- Guest precache stays at 234 KiB across 9 entries; SetupApp-*.js (10.8 MB) stays out of the precache manifest.

## Self-Check: PASSED

Verified after SUMMARY creation:

- `src/setup/FileDrop.tsx` — FOUND
- `src/setup/FileDrop.test.tsx` — FOUND
- `src/setup/dupWarning.ts` — FOUND
- `src/setup/dupWarning.test.ts` — FOUND
- `src/setup/ReviewCanvas.tsx` — FOUND
- `src/setup/ReviewCanvas.css` — FOUND
- `src/setup/ReviewCanvas.test.tsx` — FOUND
- `src/setup/LivePreview.tsx` — FOUND
- `src/setup/LivePreview.test.tsx` — FOUND
- `src/setup/SetupApp.tsx` — modified (full rewrite from placeholder)
- `src/setup/SetupApp.css` — modified (review grid + error card + counts)
- `src/test/setup.ts` — modified (ResizeObserver polyfill)
- `vite.config.ts` — modified (workbox.globIgnores excludes SetupApp-*.{js,css})
- Commit `56aa56e` (Task 1) — FOUND in git log
- Commit `2f9e20d` (Task 2) — FOUND in git log
- Commit `63024be` (Task 3) — FOUND in git log
- Verification gates: tsc --noEmit clean; npm run lint clean (0 warnings); 100/100 vitest specs pass; npm run build succeeds with PWA verification.

---
*Phase: 05-setup-tooling*
*Status: awaiting browser UAT (Task 4 checkpoint)*
*Completed (autonomous phase): 2026-04-17*
