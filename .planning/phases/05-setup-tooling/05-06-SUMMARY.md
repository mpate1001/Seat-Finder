---
phase: 05-setup-tooling
plan: 06
subsystem: ui
tags: [approve, validation, export, download, clipboard, json-shape, byte-equivalence, TOOL-01, TOOL-02]

# Dependency graph
requires:
  - phase: 05-setup-tooling
    provides: FloorPlanConfig widened contract (plan 05-03) + DraftPin type (plan 05-02) + SetupApp review shell (plan 05-05)
provides:
  - validateDraftPins approval gate (D-15) — 4 failure kinds with per-pin error list
  - buildFloorPlanConfig + serializeFloorPlanConfig byte-equivalent JSON exporter (D-16)
  - ExportPanel: Download + Copy to Clipboard side-by-side with non-secure-context textarea fallback (D-17, Pitfall 5)
  - SetupApp 'approved' mode — locks ReviewCanvas, mounts ExportPanel, clears validationErrors on pin change
  - D-18 admin reminder copy wired into the export UI
affects: [05-07-bundle-verification]

# Tech tracking
tech-stack:
  added: []  # No new runtime deps — pure platform APIs (Blob, URL.createObjectURL, navigator.clipboard, document.execCommand via textarea select)
  patterns:
    - "CUSTOM JSON serializer via string concat — JSON.stringify(cfg, null, 2) emits {x,y} on separate lines and would break byte-equivalence; toFixed(4) preserves trailing-zero formatting (e.g. '0.2770' not '0.277')"
    - "Byte-equivalence test reads src/config/floorPlan.json as ground-truth, reverses entries into DraftPin[] (forces the sort to be exercised), asserts rebuilt === groundTruth with a line-level diff on failure"
    - "Clipboard fallback pattern: feature-detect navigator.clipboard → try/catch writeText → on any failure reveal a <textarea readOnly> with auto-select so the admin can Cmd/Ctrl+C (Pitfall 5)"
    - "Blob download: Blob + URL.createObjectURL + synthesized <a download> + click + setTimeout(revoke, 0)"
    - "Validation banner auto-clear: useEffect([draftPins]) resets validationErrors so fixing issues dismisses the banner without a second Approve click"
    - "Mode transition discipline: ReviewCanvas receives disabled={mode==='approved'}; LivePreview stays rendered through the transition so the admin can visually QA while downloading (D-13 carry-through)"
    - "Status transition on admin edit: ReviewCanvas commitEdit sets status='ok' whenever the admin supplies a number — admin-vouched beats OCR confidence (unchanged from plan 05-05, reused here for approval-gate invariants)"

key-files:
  created:
    - src/setup/validation.ts
    - src/setup/validation.test.ts
    - src/setup/exportConfig.ts
    - src/setup/exportConfig.test.ts
    - src/setup/ExportPanel.tsx
    - src/setup/ExportPanel.css
    - src/setup/ExportPanel.test.tsx
  modified:
    - src/setup/SetupApp.tsx
    - src/setup/SetupApp.css

key-decisions:
  - "Serializer uses toFixed(4) on x/y, not raw JSON numeric interpolation — the committed floorPlan.json preserves trailing zeros on every coordinate (e.g. '0.2770') and the initial byte-equivalence test caught the drift on the first run. Switching to toFixed(4) resolved it; the plan explicitly anticipated this adjustment ('if drift appears, adjust roundTo4 to a fixed-precision string strategy')."
  - "Duplicate-id error emits ONE error per offending pin (not just one per collision) so the UI can highlight every pin in the collision group — aligns with the D-15 wording 'for EACH duplicate pin'."
  - "Boundary coordinates x=0, x=1, y=0, y=1 accepted as in-range (<= 1, not < 1) — matches the semantic of 'fraction of image width/height' where 1.0 is the far edge."
  - "Validation error-list includes an inline 'Edit pin' button that selects + scrollIntoView's the offending pin — the D-15 spec calls this out explicitly and it materially improves UX when there are 3+ errors in a 54-pin layout."
  - "Clipboard fallback textarea is readOnly + auto-selected on mount — an admin pasting into a separate file benefits from an already-highlighted text block. A controlled value={json} plus readOnly keeps React 18 strict happy and avoids the 'defaultValue swallows prop updates' footgun."
  - "LivePreview stays rendered in 'approved' mode alongside ExportPanel (D-13 carry-through) — preview value does not disappear the moment the admin approves; useful for a last-second visual QA while the download is being saved."
  - "Approve button disabled when draftPins.length === 0 — prevents a no-op approve that would export an empty tablePositions and silently ship a broken floorPlan.json. Tooltip explains why."

patterns-established:
  - "Byte-equivalence fixture pattern: read ground-truth file, reverse into DraftPin[], rebuild via the production pipeline, assert strict equality with actionable diff. Reusable for any future plan that produces a text artifact with a committed ground-truth."
  - "Clipboard-with-fallback React pattern: feature-detect + try/catch + setState-showFallback + auto-select textarea on mount. Reusable for any 'Copy this text' UI that must work on file:// / LAN http://."
  - "Validation-banner-with-auto-clear React pattern: useState(errors) + useEffect([formState], () => setErrors([])). Prevents stale error copy once the admin starts fixing issues."

requirements-completed: [TOOL-01, TOOL-02]

# Metrics
duration: 5min
completed: 2026-04-17
---

# Phase 5 Plan 6: Approve + Export Summary

**Validation gate (4 failure kinds), custom byte-equivalent JSON serializer (toFixed(4) preserves trailing zeros so the rebuilt file is character-for-character identical to the committed floorPlan.json), Download + Copy-to-Clipboard UI with non-secure-context textarea fallback, and SetupApp wiring that locks ReviewCanvas + mounts ExportPanel on Approve — 126/126 vitest green, tsc + lint clean, npm run build passes with PWA verification.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-17T22:22:00Z
- **Completed:** 2026-04-17T22:27:01Z
- **Tasks:** 3
- **Files created:** 7 (validation.{ts,test.ts}, exportConfig.{ts,test.ts}, ExportPanel.{tsx,css,test.tsx})
- **Files modified:** 2 (SetupApp.tsx, SetupApp.css)

## Accomplishments

- **validateDraftPins (D-15)** — 4 failure kinds (`missing-number`, `not-a-number`, `out-of-range`, `duplicate-id`). Whitespace-only table numbers flagged as `missing-number`. `not-a-number` gates anything beyond ASCII digits (catches `'abc'`, `'1.5'`, `'-1'`, `'1e2'`, `'1 2'`). `out-of-range` covers both x and y outside 0..1 (boundary-inclusive). `duplicate-id` emits one error PER offending pin so the UI can highlight every member of the collision group. 10 specs cover each kind + compound failures.
- **buildFloorPlanConfig (D-16)** — sorts pins by numeric `tableNumber` ascending, rounds x/y to 4 decimals via `Math.round(n * 10000) / 10000`, and skips null-tableNumber pins defensively. Does not mutate the input array.
- **serializeFloorPlanConfig (D-16)** — custom string concat that reproduces the committed `src/config/floorPlan.json` byte-for-byte. Uses `toFixed(4)` to preserve trailing zeros (the plan explicitly anticipated this adjustment; the byte-equivalence spec caught the initial drift on the first run).
- **Byte-equivalence proof (TOOL-02 contract)** — `exportConfig.test.ts` reads `src/config/floorPlan.json` via `node:fs`, reverses every entry into a `DraftPin[]` (so the sort in `buildFloorPlanConfig` is actually exercised), rebuilds the serialized string, and asserts strict equality with a line-level diff on failure. Passes against the real 54-entry file committed to the repo.
- **ExportPanel (D-17, D-18, Pitfall 5)** — two side-by-side buttons with no visual hierarchy per D-17. Download uses `Blob` + `URL.createObjectURL` + synthesized `<a download>` + `setTimeout(revoke, 0)`. Copy uses `navigator.clipboard.writeText` with a feature-detect + try/catch; on any failure a `<textarea readOnly>` fallback renders and auto-selects on mount so the admin can `Cmd/Ctrl+C`. 'Copied' toast clears after 2s with a StrictMode-safe timer cleanup. D-18 reminder paragraph quotes the plan — no auto-commit to the repo.
- **SetupApp approval wiring** — `mode` widened with `'approved'`. `handleApprove` runs `validateDraftPins`; on failure stores errors and stays in review, on success sets `mode='approved'`. Validation errors render as an inline banner above the canvas with one line per error and an `Edit pin` button that selects + `scrollIntoView`'s the offending pin. `useEffect([draftPins])` auto-clears the error banner so fixing an issue dismisses the warning without a second Approve click. In `'approved'` mode `ReviewCanvas` receives `disabled={true}` (all interactions locked) and `ExportPanel` replaces the Approve/Start-over row. LivePreview stays rendered through the transition (D-13 carry-through). Back-to-edit returns `mode='review'`.

## Task Commits

Each task was committed atomically:

1. **Task 1: validation + exportConfig + byte-equivalence test** — `2f6fe10` (feat)
2. **Task 2: ExportPanel + CSS + test** — `32eebcd` (feat)
3. **Task 3: SetupApp Approve wiring + validation banner + CSS** — `ca320ee` (feat)

**Plan metadata:** (pending — will commit with SUMMARY + STATE + ROADMAP + REQUIREMENTS)

## Files Created/Modified

### Created (7)

- `src/setup/validation.ts` (102 lines) — validateDraftPins pure function
- `src/setup/validation.test.ts` (117 lines) — 10 specs: ok case + 4 failure kinds + compound
- `src/setup/exportConfig.ts` (115 lines) — buildFloorPlanConfig + serializeFloorPlanConfig
- `src/setup/exportConfig.test.ts` (174 lines) — 10 specs: roundTo4, sort, rounding, skip-null, byte-equivalence
- `src/setup/ExportPanel.tsx` (194 lines) — Download + Copy UI with clipboard fallback
- `src/setup/ExportPanel.css` (154 lines) — two-button layout + fallback textarea + responsive
- `src/setup/ExportPanel.test.tsx` (174 lines) — 6 specs: render, download, copy happy path, no-clipboard, clipboard-reject, back

### Modified (2)

- `src/setup/SetupApp.tsx` (355 lines) — +'approved' mode, Approve handler, validation banner, ExportPanel render, Back-to-edit
- `src/setup/SetupApp.css` (398 lines) — +.setup-validation-errors banner with kind-tag + edit-pin link

## Decisions Made

See frontmatter `key-decisions`. The notable one:

**Serializer uses `toFixed(4)`, not raw numeric interpolation.** The initial byte-equivalence test failed on line 8 (`"5": { "x": 0.2770, "y": 0.4926 }` expected, `0.277` actual). Every coordinate in the committed `src/config/floorPlan.json` uses exactly 4 decimal places (trailing zeros preserved). Switching from template-literal interpolation (`${pos.x}`) to `fmt(pos.x)` where `fmt = n => n.toFixed(4)` resolved it. The plan explicitly anticipated this in §action: "if drift appears, adjust roundTo4 to a fixed-precision string strategy" — so this is a planned adjustment, not a workaround.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Trailing-zero drift broke byte-equivalence on first run**
- **Found during:** Task 1 (first byte-equivalence run)
- **Issue:** The ground-truth `src/config/floorPlan.json` preserves trailing zeros on every coordinate (`"0.2770"`, not `"0.277"`). Template-literal interpolation of a number drops trailing zeros, so the rebuilt string diverged at line 8.
- **Fix:** Changed the per-entry format helper from `${pos.x}` to `n.toFixed(4)`. Updated the "single-line-per-entry format" unit spec to expect `0.1000`/`0.2000` accordingly. Added a dedicated spec asserting trailing-zero preservation.
- **Files modified:** src/setup/exportConfig.ts, src/setup/exportConfig.test.ts
- **Verification:** Byte-equivalence spec passes against the real 2229-byte floorPlan.json; total 10 exportConfig specs green.
- **Committed in:** 2f6fe10 (Task 1 commit — the adjustment was made before the first commit landed)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** The plan explicitly anticipated this adjustment ("if drift appears, adjust roundTo4 to a fixed-precision string strategy"). No scope creep — implementation matched the plan's contingency branch.

## Issues Encountered

- **`npm run build` requires VITE_SHEET_URL** — this is the plan-04-01 env-var gate, not a regression. Sourcing `.env.local` before `npm run build` satisfies the guard. Expected operating procedure per .env.example.
- **Pre-existing untracked files** — `.omc/`, `public/FINAL_Reception Table Arrangments.png`, `scripts/calibrate-hough.mjs` are pre-existing and out of scope for this plan (also noted in plan 05-05 summary). Not committed.

## User Setup Required

None — no external service configuration required. All changes are client-side.

## Try it in the browser

```bash
source .env.local
npm run dev
```

Then open `http://localhost:5173/setup`:
1. Upload a floor plan image (or use `public/floor-plan/floor-plan-1600.png`).
2. Click **Detect tables**.
3. Review/correct pins.
4. Click **Approve + export**.
   - If any pin has a missing/invalid number OR out-of-range coord OR duplicate number, the error banner appears with one line per issue. Click **Edit pin** on a line → that pin is selected and scrolled into view.
5. Once all pins are valid, Approve flips to the **approved** mode — canvas goes locked, `ExportPanel` appears.
6. Click **Download floorPlan.json** → browser saves the file. Open it; it should be byte-identical to `src/config/floorPlan.json` if you detected against the Reception Seat Diagram.
7. Click **Copy to Clipboard** (on localhost/secure) → 'Copied' toast appears.
8. In DevTools, run `delete navigator.clipboard` → click Copy again → the textarea fallback appears pre-selected.
9. Click **Back to edit** → canvas re-enables.

## Next Phase Readiness

**Ready for plan 05-07 (bundle verification):**
- `src/setup/exportConfig.ts` + `src/setup/validation.ts` are pure modules with no runtime dependency on OpenCV / Tesseract.
- `ExportPanel` uses only platform APIs (`Blob`, `URL`, `navigator.clipboard`, `document`). No new runtime deps in `package.json`.
- Guest precache stays at **234.23 KiB across 9 entries** (unchanged from plan 05-05 build verification). Setup chunk now 10.82 MB (was 10.83 MB — minor — the new logic is dwarfed by WASM deps).
- `grep -rn 'tesseract\|opencv' src/ --include='*.{ts,tsx}'` still contained entirely within `src/setup/`.

**Phase 5 completion after 05-07:**
- TOOL-01 satisfied: admin can upload → detect → review → approve → export.
- TOOL-02 satisfied: byte-equivalence spec proves the exported JSON is identical in format to the existing floorPlan.json; admin paste produces a consumed-by-guest-code-unchanged file.
- TOOL-03 needs the 05-07 verification — but the current build already shows SetupApp.js landing in its own chunk and guest precache excluding it.

## Self-Check: PASSED

Verified after SUMMARY creation:

- `src/setup/validation.ts` — FOUND (102 lines)
- `src/setup/validation.test.ts` — FOUND (117 lines)
- `src/setup/exportConfig.ts` — FOUND (115 lines)
- `src/setup/exportConfig.test.ts` — FOUND (174 lines)
- `src/setup/ExportPanel.tsx` — FOUND (194 lines)
- `src/setup/ExportPanel.css` — FOUND (154 lines)
- `src/setup/ExportPanel.test.tsx` — FOUND (174 lines)
- `src/setup/SetupApp.tsx` — modified (355 lines)
- `src/setup/SetupApp.css` — modified (398 lines)
- Commit `2f6fe10` (Task 1) — FOUND in git log
- Commit `32eebcd` (Task 2) — FOUND in git log
- Commit `ca320ee` (Task 3) — FOUND in git log
- Verification gates: tsc --noEmit clean; npx eslint clean (0 warnings); 126/126 vitest specs pass (all 20 test files); `npm run build` succeeds with PWA v1.2.0 precache verification passed (guest precache 234.23 KiB across 9 entries).

---
*Phase: 05-setup-tooling*
*Completed: 2026-04-17*
