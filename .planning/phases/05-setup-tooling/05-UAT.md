# Phase 5: Setup Tooling — User Acceptance Test (UAT)

**Gate:** Every PASS/FAIL check in this document must be confirmed before Phase 5 is marked complete. Any FAIL → file as a gap for `/gsd-plan-phase 05 --gaps` in a follow-up plan.

**Automated coverage already verifying:**

- TOOL-01: `src/setup/detect.test.ts`, `pipeline.test.ts`, `ReviewCanvas.test.tsx`, `LivePreview.test.tsx` (vitest — 126/126 green as of 05-06)
- TOOL-02: `src/setup/exportConfig.test.ts` byte-equivalence spec against real `src/config/floorPlan.json`
- TOOL-02: `src/setup/validation.test.ts` covers all 4 validation failure kinds
- TOOL-03: `scripts/verify-setup-split.mjs` chained into `npm run build` — grep gate on guest entry + positive CV-chunk assertion
- TOOL-04: `src/setup/pipeline.test.ts` orchestrates detection pipeline with mocked OpenCV + Tesseract workers

This UAT covers the BROWSER behaviors and the real-image detection-accuracy check that cannot be exercised in vitest or a static build script.

---

## Prerequisites

- [ ] Node.js 22+, npm working (`node --version` ≥ 22)
- [ ] Working tree is clean (or only this UAT markup is dirty): `git status --short`
- [ ] Current branch is at the tip of Phase 5 plans (`main` after phase merge, or `dev` during execution)
- [ ] `npm install` succeeded after plan 05-02 added `@techstark/opencv-js` and `tesseract.js`
- [ ] `.env.local` has `VITE_SHEET_URL` set (required by the plan-04-01 build guard)

---

## Build gate — TOOL-03

### 1a. Full build chain passes
- [ ] Run `npm run build`
- [ ] Final output includes all four steps in order:
  - `tsc` exits clean
  - `vite build` emits `dist/` with `dist/assets/SetupApp-*.js` and `dist/assets/index-*.js`
  - `PWA build verification passed.`
  - `verify-setup-split passed.` followed by clean guest entry + setup chunk + CV chunk verified
- [ ] If any step fails → STOP the UAT, open the error, fix, rerun

### 1b. Grep-level confirmation (manual double-check)
- [ ] `grep -l 'opencv\|tesseract' dist/assets/index-*.js` prints NOTHING
- [ ] `grep -l 'opencv\|tesseract' dist/assets/SetupApp-*.js` prints at least one file
- [ ] → PASS confirms TOOL-03: guest entry is clean AND setup chunk has CV deps

---

## Guest-path regression — no Phase 5 side effects

### 2a. Guest flow still works end-to-end
- [ ] `npm run preview` (or deploy `dist/` to any HTTPS host)
- [ ] Visit `/` (NOT `/setup`)
- [ ] DevTools → Network → clear → hard reload. Confirm the initial chunks loaded are `index-*.js`, `index-*.css`, and floor-plan image variants. No `SetupApp-*.js` is fetched on the guest path.
- [ ] Type a real guest's name in the search box → dropdown appears
- [ ] Select a guest → `MapView` opens, pin animates to the correct table
- [ ] DevTools console shows NO errors or warnings about missing modules, failed dynamic imports, or duplicate FloorPlan configs
- [ ] Close and reopen the map with a different guest → pin re-animates to the new table
- [ ] → PASS if the guest experience is indistinguishable from pre-Phase-5

---

## Setup flow — TOOL-01 + TOOL-04 on the real Reception Seat Diagram

Run on **desktop Chrome** first (easier DevTools access), then repeat the abbreviated smoke on **iPhone Safari** (step 3m).

### 3a. Route + obscurity warning
1. [ ] Visit `/setup`
2. [ ] The D-04 obscurity warning is visible at the top of the page ("No authentication — do not share this URL…")
3. [ ] DevTools Network tab confirms `SetupApp-*.js` loaded lazily (not in the initial guest bundle)

### 3b. Upload
4. [ ] Drag-drop `public/FINAL_Reception Table Arrangments.png` (or `src/assets/Reception Seat Diagram.png`) onto the drop-zone — OR click to open a native file picker
5. [ ] The image appears in the review pane; the "Detect tables" button is enabled

### 3c. Detect
6. [ ] Click "Detect tables"
7. [ ] Status line progresses through: `Preparing…` → `Scanning circles…` → `Cropping…` → `Reading circle numbers (N/M)…` → `Done.`
8. [ ] First run may take 5–15 s while Tesseract's `eng.traineddata` downloads from jsDelivr (Pitfall 4 assumption A5). Subsequent runs are cached in IndexedDB.
9. [ ] No console errors; the Detect button stays disabled during the run (single-flight)

### 3d. Detection recall on the real floor plan (deferred from plan 05-02 calibration)
10. [ ] Draft pins overlay the uploaded image
11. [ ] Count matched pins against the 54 ground-truth tables in `src/config/floorPlan.json`:
       - **Recall target:** ≥ 45/54 (≥ 83%) per plan 05-02 calibration report
       - If recall < 83%, the admin can: (a) adjust `param2` down in `src/setup/houghDefaults.ts` and rebuild (fewer voting threshold → more circles + more false positives), (b) tighten `minRadius`/`maxRadius`, OR (c) just add missed tables manually in step 3f
12. [ ] False-positive rate: (detected − matched) / detected — record the number. Acceptable if admin can delete FPs quickly in step 3g (typically < 10%).
13. [ ] Low-confidence pins visibly flagged (orange outline); placeholder pins (OCR returned no digits) render as slate with "?"

### 3e. Drag
14. [ ] Pointer-down on any pin → drag → release. Pin follows the cursor smoothly.
15. [ ] The `LivePreview` panel (showing the real `<FloorPlan/>`) updates in sync — the dragged pin moves to the matching position in the preview.

### 3f. Click-to-edit
16. [ ] Click a pin with an obviously wrong number (or a "?" placeholder). An inline editor appears pre-filled with the current value.
17. [ ] Type a correct number → press Enter. The pin's visual status flips from `needs-number`/`low-confidence` to `ok` (red teardrop).
18. [ ] Escape cancels without committing.

### 3g. Delete
19. [ ] Hover a false-positive pin → the "×" button appears on hover. Click it → pin disappears from BOTH the canvas AND the live preview.
20. [ ] Alternative: select a pin (click) → press Backspace or Delete → pin disappears.

### 3h. Add
21. [ ] Toggle the "Add pin" button. Click on a missed table circle in the image. A new pin lands at the click fraction and the inline editor opens.
22. [ ] Type the correct number → Enter commits. The pin renders with `ok` status.
23. [ ] Alternative: hold Shift and click an empty spot without toggling — same outcome.

### 3i. Duplicate-position warning
24. [ ] Drag two pins to within 3% of each other (in 0..1 fraction space). A warning strip appears above the canvas listing the offending pair.
25. [ ] Dragging them back apart dismisses the warning.

### 3j. Re-upload / start over
26. [ ] Click "Start over". State resets to the upload step, all pins cleared, image removed from the canvas. No stale pins persist.

### 3k. StrictMode double-mount check
27. [ ] Open DevTools Network tab. Reload `/setup`.
28. [ ] Confirm `opencv.js` and `tesseract.js` each fetch ONCE (not twice). StrictMode must not spawn a duplicate pipeline — the `runDetectionPipeline` call is inside `onClick`, never in `useEffect`.

### 3l. Mobile layout
29. [ ] In Chrome DevTools toggle device toolbar → iPhone 14 Pro Max. The two-pane (canvas + live preview) grid stacks vertically. Pins still draggable with touch.

### 3m. iPhone Safari smoke
30. [ ] Open `https://<preview-url>/setup` on a real iPhone (or `ngrok http 4173` from `npm run preview`).
31. [ ] Upload works (photo library picker).
32. [ ] Detect runs to completion. Status line readable.
33. [ ] At least 3 pin interactions work with touch: drag, tap-to-edit, delete via ×.
34. [ ] No Safari console errors (check via macOS Safari → Develop → [iPhone]).

→ **PASS** when all 34 interactions complete without surprises.

---

## Approve + export — TOOL-02

### 4a. Validation gate
35. [ ] Intentionally leave one pin with `tableNumber=null` (or delete the number via click-to-edit + Enter on blank)
36. [ ] Click "Approve + export"
37. [ ] The error banner above the canvas lists the offender as `missing-number` (or `not-a-number`) with an `Edit pin` link
38. [ ] Click `Edit pin` → the offending pin is selected and scrolled into view
39. [ ] Fix the number → the banner auto-clears (useEffect dependency on `draftPins`)
40. [ ] Introduce a duplicate table number (edit two pins to have the same number) → Approve again → banner lists BOTH pins as `duplicate-id`
41. [ ] Fix the duplicate → Approve again → mode transitions to `approved`

### 4b. Approved mode
42. [ ] `ReviewCanvas` is disabled: no drag, no click-to-edit, no Add-pin toggle, no delete
43. [ ] `LivePreview` still renders (D-13 carry-through — admin can visually QA during download)
44. [ ] `ExportPanel` appears with Download + Copy buttons side-by-side (no visual hierarchy per D-17)
45. [ ] The D-18 reminder copy is visible ("No automatic write-back — you'll paste this manually into `src/config/floorPlan.json`")

### 4c. Download + byte-diff
46. [ ] Click "Download floorPlan.json" → browser saves the file
47. [ ] Open the downloaded file in a text editor. Confirm:
      - Top-level shape: `{ "imageFileName": "…", "tablePositions": { "1": { "x": 0.XXXX, "y": 0.XXXX }, … } }`
      - Coordinates use 4 decimal places with trailing zeros preserved (e.g. `0.2770`, not `0.277`)
      - Entries sorted by numeric `tableNumber` ascending
48. [ ] `diff downloaded-file.json src/config/floorPlan.json` — if you uploaded the Reception diagram AND all 54 tables are present in the approved set AND no pin positions were manually changed, the files should be **byte-identical** (modulo any intentional corrections you made). Any remaining diffs = admin-authored improvements; document them in SUMMARY.

### 4d. Copy to Clipboard
49. [ ] Click "Copy to Clipboard" → "Copied" toast appears briefly and auto-dismisses after ~2 s
50. [ ] Open a new text editor tab, paste → content matches the downloaded JSON
51. [ ] Non-secure-context fallback: in DevTools Console run `delete navigator.clipboard` → click Copy again → the `<textarea readOnly>` fallback renders with the JSON pre-selected. Cmd+C copies it.

### 4e. Back to edit
52. [ ] Click "Back to edit" → `ReviewCanvas` re-enables (drag/edit/delete/add all work again). The `LivePreview` continues to render live. Re-approve flow works unchanged.

→ **PASS** when Download + Copy + textarea fallback + Back-to-edit all work.

---

## Requirements traceability

Final sign-off — every line must check before Phase 5 is marked complete in `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` (handled by the `/gsd-execute-phase` orchestrator, not this UAT).

- [ ] **TOOL-01** — Admin uploaded a floor plan, reviewed draft pins, and produced a coordinate mapping (sections 3a–3j)
- [ ] **TOOL-02** — Exported JSON matches `src/config/floorPlan.json` shape byte-for-byte; Download + Copy both work (section 4c/4d)
- [ ] **TOOL-03** — Guest entry chunk is grep-clean; setup chunk exists with CV deps; verified by `npm run build` (sections 1a/1b)
- [ ] **TOOL-04** — OpenCV + Tesseract produced draft pins on the real Reception diagram at ≥ 83% recall (section 3d)

---

## Sign-off

| Section | Verified by | Date |
|---------|-------------|------|
| Build gate (1a–1b) | | |
| Guest regression (2a) | | |
| Setup flow (3a–3m) | | |
| Approve + export (4a–4e) | | |

Once every row is signed off, mark Phase 5 complete in `.planning/STATE.md` and proceed to `/gsd-verify-work` + `/gsd-complete-phase`.

## Blocking items

Minimum to clear the phase gate:

1. **1a (build chain)** — All four chained build steps exit 0 with `verify-setup-split passed.`
2. **2a (guest regression)** — No side-effects on the guest path; no SetupApp chunk fetch
3. **3d (detection recall)** — ≥ 83% recall on the real Reception diagram (or admin tuned `houghDefaults.ts` and re-hit the threshold)
4. **3f/3g/3h (review interactions)** — Edit, delete, add all work with touch on iPhone Safari (section 3m)
5. **4c (byte-diff)** — Downloaded JSON is structurally identical to `src/config/floorPlan.json` (any diffs are admin-authored improvements, not format drift)

Nice-to-have (recommended but non-blocking): 3i duplicate warning, 3j start-over, 3k StrictMode check, 4d clipboard fallback.

**Resume signal for the checkpoint:** Type `phase-5-accepted` when all blocking items pass, or describe outstanding gaps for `/gsd-plan-phase 05 --gaps`.
