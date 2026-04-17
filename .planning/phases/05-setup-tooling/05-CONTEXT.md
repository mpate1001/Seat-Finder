# Phase 5: Setup Tooling — Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Discuss mode:** Interactive (4 questions). User expanded scope to include computer-vision auto-detection + OCR with a review/approve workflow. Bumps TOOL-04 (deferred v1.1 idea) into Phase 5 scope.

<domain>
## Phase Boundary

Ship the three locked requirements from REQUIREMENTS.md, PLUS the user-added auto-detect + review workflow:

- **TOOL-01** — Admin can upload a floor plan image and generate coordinate mappings for each table position.
- **TOOL-02** — Exports percentage-based coordinates compatible with `src/config/floorPlan.json`.
- **TOOL-03** — Setup tool is excluded from the production guest-facing bundle (route-based code splitting; the setup chunk loads only on `/setup`).
- **TOOL-04 (promoted from v1.1 backlog)** — Auto-detect table circles AND their printed numbers via browser computer vision, present results as draft pins for admin review, allow edit/drag/delete/add, then approve → export.

**Workflow the admin runs:**

1. Navigate to `/setup` in the browser.
2. Upload a floor plan image (drag-drop or file picker).
3. System runs Hough Circle Transform to find round table shapes.
4. System runs OCR (Tesseract.js) on each detected circle to read its number.
5. Draft pins render as overlays on the image with `{x, y, detectedNumber, confidence}`. Low-confidence pins are visually flagged.
6. Admin reviews: drag pins to reposition, click to edit detected numbers, delete false positives, click empty spots to add missed tables.
7. Admin clicks "Approve" — locks editing.
8. System shows two export affordances: **Download `floorPlan.json`** button and **Copy to Clipboard** button. Both output the exact shape the app's `src/config/floorPlan.json` uses.
9. Admin drops the file (or pastes) into the app; the app's existing `FloorPlan` component consumes it unchanged.

**Not in scope** (stays in v1.1+ backlog):
- Multi-image / multi-floor-plan support
- Guest-list management UI (TOOL-05)
- Saving partial progress across sessions (localStorage draft recovery — maybe a future polish)
- Auth / password gate on `/setup` (relies on route obscurity for v1)
- Automatic upload of the generated JSON to the repo (admin still pastes manually)

</domain>

<decisions>
## Implementation Decisions

### Access & routing (TOOL-03)
- **D-01:** Setup tool lives at route `/setup` in the same Vite app — NOT a separate build entry, NOT dev-only. Route-based code-splitting via `React.lazy(() => import('./setup/SetupApp'))` ensures the setup bundle is NEVER loaded on the guest path (`/`) or referenced in the guest chunk.
- **D-02:** No router library added. Implement a minimal path check in `main.tsx` or `App.tsx`: if `window.location.pathname === '/setup'`, render `<SetupApp />` (lazy); else render the current guest `<App />`. Keeps the dep list lean; a router isn't justified for a two-route app.
- **D-03:** TOOL-03 verification: a build-smoke test confirms that `dist/assets/` contains a separate chunk for the setup module AND that the guest entry bundle does NOT contain OpenCV, Tesseract, or setup-specific strings (grep assertions). If this fails, the build fails.
- **D-04:** No auth. `/setup` is protected only by route obscurity. Document this clearly in README and the setup page UI.

### Auto-detection pipeline (TOOL-01 + TOOL-04)
- **D-05:** Computer-vision stack = `opencv.js` (Hough Circle Transform) + `tesseract.js` (OCR). Both are lazy-loaded inside the `/setup` chunk — never referenced from guest code.
- **D-06:** Detection flow: draw uploaded image to an offscreen `<canvas>` → grayscale + Gaussian blur → `cv.HoughCircles` with parameters tuned for floor-plan-style drawings (min/max radius inferred from image size) → array of `{cx, cy, radius}` → for each circle, crop a square region of `2 * radius` around center → feed crop to Tesseract worker → get `{number, confidence}` → emit `DraftPin { x, y, detectedNumber, confidence, detectedRadius }`.
- **D-07:** Coordinates are stored as fractions (0..1 of image width/height) from the moment detection returns — no pixel numbers cross module boundaries. Matches the shape `floorPlan.json` already uses.
- **D-08:** OCR only accepts digit characters (Tesseract `tessedit_char_whitelist: '0123456789'`) to prune hallucinations.
- **D-09:** Confidence threshold = 60 (Tesseract scale 0-100). Pins with confidence < 60 render with a visible warning badge in the review UI. Pins where OCR returned no digits render with a placeholder "?" number; admin must assign.
- **D-10:** Detection runs on a single "Detect tables" button click — not continuously. Progress is reported via a small status line so the admin knows it's not frozen.

### Review UI (TOOL-01 extras)
- **D-11:** Draft pins render as colored overlays on top of a scaled-down image. Assigned (approved) pins = red teardrop (reuse the `.pin-assigned` SVG from `FloorPlan.tsx`). Low-confidence pins = orange outline. Placeholder-number pins = slate with "?".
- **D-12:** Admin interactions on the review canvas:
  - **Drag** a pin to reposition (updates stored x/y fraction).
  - **Click** a pin to open an inline editor that shows the detected number and lets admin override it. Edit confirms on Enter/blur.
  - **Delete** — small "×" button on each pin's hover state, or keyboard Backspace/Delete when pin is selected.
  - **Add** — shift-click (or a dedicated "Add pin" toggle mode) on empty canvas space drops a new pin, admin types number inline.
- **D-13:** Live preview panel renders next to the editor using the REAL `FloorPlan` component from `src/components/FloorPlan.tsx`, fed from the current draft-pin state. This proves-out what guests will see before approve.
- **D-14:** Duplicate-position warning: reuse the Phase 1 dev warning pattern. If two draft pins are within 3% of each other (Euclidean distance in 0..1 fraction space), show an inline warning in the review UI.

### Approve + export (TOOL-02)
- **D-15:** "Approve" button locks editing, triggers a validation pass: all pins have a numeric `tableNumber`, no duplicates (IDs must be unique — distinct from position warning), no impossible coords (0 ≤ x, y ≤ 1). Failures show inline, admin must fix.
- **D-16:** Export JSON shape = exactly what `src/config/floorPlan.json` expects today:
  ```json
  {
    "imageFileName": "<admin-provided or inferred>",
    "tablePositions": {
      "1": { "x": 0.2758, "y": 0.3854 },
      ...
    }
  }
  ```
  Coordinate precision: 4 decimal places (matches the existing file's convention).
- **D-17:** Export affordances = TWO side-by-side buttons: **Download `floorPlan.json`** (triggers a browser blob download) and **Copy to Clipboard** (uses `navigator.clipboard.writeText`). Both produce byte-identical output.
- **D-18:** No automatic write-back into the repo or `src/config/` — admin manually replaces the file. Reason: keeps the setup tool pure-client with no FS plumbing.

### Claude's Discretion
- Specific Hough Circle parameter tuning: researcher investigates and planner sets defaults that work on the existing Reception Seat Diagram PNG, with UI sliders IF tuning is too finicky out of the box.
- Tesseract worker lifecycle: one-shot (init → OCR all → terminate) vs long-lived (init once, reuse across edits). Researcher picks the cheaper/cleaner pattern.
- Progress UI during detection: spinner + text is fine; progress bars are optional polish.
- Whether the review canvas uses a full-res image vs a downscaled preview for performance. Planner decides based on image sizes (the existing PNG is 2400×1831).
- Error UX for upload failures (invalid file type, huge image OOM, etc.) — follow the existing `App.tsx` error-card pattern.

</decisions>

<specifics>
## Specific Ideas

- **Bundle discipline**: the single biggest risk is letting OpenCV/Tesseract leak into the guest bundle. Verify with a grep on `dist/assets/index-*.js` that neither string appears. Fail the build if they do.
- **Mental model**: the admin is someone technical-adjacent (likely the same developer maintaining this repo). Defaults should be opinionated enough to "just work" on a clean floor-plan image. Tuning knobs are polish, not v1.
- **Detection isn't guaranteed**: for the current Reception Seat Diagram PNG (clean line-art circles with printed numbers), Hough + OCR should work well. For messier diagrams (photos, hand-drawn), the admin will do more manual correction. Document this expectation in the setup UI.
- **Review-first framing**: the UI should lead with "We found N tables — review and approve" rather than presenting detection as done. Makes the admin the authority, not the algorithm.

</specifics>

<canonical_refs>
## Canonical References

### Phase scope + requirements
- `.planning/REQUIREMENTS.md` — TOOL-01, TOOL-02, TOOL-03 exact wording + TOOL-04 promoted from v1.1.
- `.planning/ROADMAP.md` — Phase 5 success criteria.
- `.planning/PROJECT.md` — React/Vite/TS stack constraints, static hosting, 1-2 month timeline.

### Existing code the setup tool must produce-for and not break
- `src/config/floorPlan.json` — the exact shape the export must match.
- `src/components/FloorPlan.tsx` — the live preview panel reuses this component directly; its props interface is the contract.
- `src/components/FloorPlan.css` — red teardrop pin styles reused in the review UI.
- `src/main.tsx` — route dispatch entry point for D-02.
- `src/App.tsx` — guest root; remains unchanged by this phase except that `main.tsx` may now conditionally mount it.
- `vite.config.ts` — code-splitting behavior; verify setup chunk stays separate.

### Phase 3/4 patterns to reuse
- `src/components/MapView.tsx` portal pattern — if the review UI ever needs a modal that escapes a backdrop-filter ancestor, use `createPortal(..., document.body)`.
- `src/main.tsx` StrictMode — any effects in SetupApp must survive double-invoke (Phase 3 regression guard).
- `scripts/generate-images.mjs` + `scripts/generate-pwa-icons.mjs` — precedent shape for any build-time script, if needed.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FloorPlan` component — rendered directly in the live-preview panel, no wrapper needed.
- Phase 3's percentage-coord system — the setup tool stores and exports in the identical shape. Zero transform needed at export time.
- Phase 4's `.env.example` convention — if OpenCV / Tesseract ever need CDN URL overrides, use the same pattern.
- Phase 3 red teardrop SVG path — reuse as the "approved pin" visual in the review UI.

### Established Patterns
- `function` declarations for components; default exports; PascalCase `.tsx` files; kebab-case CSS classes with component prefix.
- Named exports for services in `src/services/`. Setup-specific services live in a new `src/setup/` directory (parallel tree) to make the code-split boundary visually obvious.
- Error handling: error-card UI with Retry button — reuse copy/tone.
- `useState` for local state; no global store library; state lifted to the `SetupApp` root.

### Integration Points
- `src/main.tsx` dispatches root based on pathname.
- Setup route directory: `src/setup/` — new module; contains `SetupApp.tsx`, `detect.ts`, `review.tsx`, export utilities, CSS, tests.
- OpenCV.js + Tesseract.js are ONLY imported from files under `src/setup/`. Never from `src/components/`, `src/services/`, `src/App.tsx`, or `src/main.tsx` (main.tsx's lazy `import('./setup/SetupApp')` is the one allowed boundary).
- `vite.config.ts` may need `build.rollupOptions.output.manualChunks` to guarantee OpenCV + Tesseract land in a setup-only chunk — researcher confirms.

</code_context>

<deferred>
## Deferred Ideas

Captured for the v1.1 / future-reusable backlog:

- **TOOL-05: Built-in guest-list management UI** — replace Google Sheets with an in-app admin CRUD page. Explicitly out of Phase 5 scope.
- **Save draft progress to localStorage** — so an admin who closes the tab mid-review doesn't lose their work. Polish, not v1.
- **Multiple floor-plan support** — different ceremony vs reception layouts on one event. Out of v1.
- **Auth gate on `/setup`** — password input or environment-flag check. Route obscurity is acceptable for the single-event use case; revisit if this tool is published in any public-facing way.
- **Autosave / auto-push to repo** — POST the generated JSON to a backend that commits it to `src/config/`. Requires a backend. Deferred.
- **Per-table metadata editing** — set seat count, hostname, notes per table from the setup tool. Out of v1 scope.
- **Export floor plan image (optimized variants)** — pipe the uploaded image through Phase 3's `scripts/generate-images.mjs` automatically. Deferred.
- **OCR confidence tuning UI** — expose Hough parameter sliders + Tesseract language model choices to the admin. Only build if the defaults don't work on a clean input.

</deferred>

---

*Phase: 05-setup-tooling*
*Authored: 2026-04-17 after 4-question discuss session (user expanded scope to include TOOL-04 CV auto-detection with review/approve workflow)*
