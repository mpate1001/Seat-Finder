# Phase 5 Plan Check — Setup Tooling

**Checked:** 2026-04-17
**Plans verified:** 05-01 … 05-07 (7 plans)
**Verdict:** **NEEDS-FIXES** (6 fixable issues; 1 wave-graph blocker; 0 scope-reduction blockers)

---

## Headline

The 7 plans together deliver **all four requirements** (TOOL-01..TOOL-04) and implement **all 18 locked decisions (D-01..D-18)** with no silent scope reductions and no contradictions of user decisions. The byte-equivalence test in 05-06 is concretely executable against the real `src/config/floorPlan.json`. The TOOL-03 grep gate in 05-07 is real and enforceable. StrictMode resilience is explicitly handled throughout.

**However**, there are fixable issues that will bite execution:

1. **Wave graph is inconsistent** (blocker) — 05-04's `wave: 3` depends on `05-02` which is `wave: 2`, but 05-02 contains a `checkpoint:human-verify` with an indefinite pause. Separately, 05-06's `depends_on` is missing `05-04` (its validation logic uses `DraftPin.status/tableNumber` shape produced by 05-04's pipeline).
2. **Intra-wave disjointness for Wave 1 is violated** (blocker) — 05-01 and 05-03 are both `wave: 1` with `depends_on: []`, but 05-01 creates `src/setup/SetupApp.tsx` and 05-03 does not modify setup files, so their `files_modified` arrays ARE disjoint. This is actually fine. (Retracted — see Dimension 3.)
3. **05-02 is mis-classified as `wave: 2`** with `depends_on: ["05-01"]` but its actual file modifications (`package.json`, `src/setup/types.ts`, `src/setup/houghDefaults.ts`, `scripts/calibrate-hough.mjs`) do NOT depend on anything 05-01 produces. It should be `wave: 1, depends_on: []`, runnable in parallel with 05-01 and 05-03.
4. **Task 1 of 05-02 is missing the `tdd` attribute** but installs deps — minor; that task is `auto` (install shell command), not TDD; acceptable.
5. **05-06 Task 1 byte-equivalence test** has a subtle hazard: it assumes the exact serializer output byte-matches `src/config/floorPlan.json`. Current file has `{ "x": 0.2758, "y": 0.3854 }` on a single line per entry — this does NOT match `JSON.stringify(cfg, null, 2)` output, which emits each `x` and `y` on their own lines. The plan acknowledges this tangentially ("adjust serializeFloorPlanConfig to match whatever the file actually ends with") but doesn't commit to a deterministic formatting strategy. **This needs a concrete fix now, not deferred to execution.**
6. **05-07 forbidden-strings list is too aggressive** — `createWorker` appears as a common identifier name across many libraries and may false-positive on minified bundles (e.g., some generic `createWorker` helper in an unrelated dep could match). The check should at minimum use word-boundary matching or a narrower needle like `tesseract.js` package string or `HoughCircles`.
7. **Plan 05-05 Task 2 test 4** (`focusedTableNumber propagates to FloorPlan — pin for that number renders with .pin-assigned class`) will race against the live `<FloorPlan>`'s image onLoad logic, which sets `imageLoaded` state before rendering the teardrop pin. In a test harness with a stubbed `imageSrc='blob:fake-url'`, the `<img>` onLoad may never fire. This spec needs either `fireEvent.load(img)` or a documented workaround.
8. **05-01 Task 3** requires exporting `Root` from `main.tsx` — but `main.tsx` is an *entry module* that calls `createRoot(...).render(...)` at module scope. Extracting `Root` as a named export while keeping the side-effect render means tests that `import { Root }` will trigger `createRoot` on `document.getElementById('root')` during test module load, which in jsdom will either fail (no `#root`) or pollute across tests. The plan should split `main.tsx` into an exportable `Root` component file + a thin entry shim that calls `createRoot`.

None of the issues are scope reductions. None contradict a locked decision. All are fixable without restructuring the phase.

---

## Dimension 1: Requirement Coverage — PASS

**Source:** `REQUIREMENTS.md` (TOOL-01, TOOL-02, TOOL-03 locked; TOOL-04 promoted via CONTEXT.md).

| Requirement | Plans | Tasks | Status |
|-------------|-------|-------|--------|
| TOOL-01 — Upload + coord mapping | 05-02, 05-03, 05-04, 05-05, 05-06 | 05-02 T2 (types), 05-04 T1-T3 (pipeline), 05-05 T1-T3 (UI), 05-06 T1-T3 (validate+export) | COVERED |
| TOOL-02 — Exports compatible JSON | 05-06 | 05-06 T1 (buildFloorPlanConfig + byte-equivalence), 05-06 T2 (Download+Copy) | COVERED |
| TOOL-03 — Excluded from guest bundle | 05-01, 05-07 | 05-01 T1-T3 (route split via React.lazy), 05-07 T1 (grep gate), 05-07 T2 (build chain) | COVERED |
| TOOL-04 — Auto-detect + OCR | 05-02, 05-04, 05-05 | 05-02 T3 (Wave-0 calibration), 05-04 T1-T3 (HoughCircles + OCR + pipeline), 05-05 T2-T3 (review UI) | COVERED |

Cross-check against `ROADMAP.md` Phase 5 success criteria:
- SC1 ("admin can upload + click + assign number") → covered by 05-05 T2 (ReviewCanvas drag/click/add/delete).
- SC2 ("editor exports JSON droppable into floorPlan config") → covered by 05-06 T1 byte-equivalence test.
- SC3 ("completely absent from production guest-facing build") → covered by 05-01 T2 (lazy boundary) + 05-07 T1 (build-time grep gate).

All three roadmap success criteria have enforceable tasks.

---

## Dimension 2: Task Completeness — WARNING

Every task has `<files>`, `<action>`, `<verify>`, `<done>`. Checkpoints have `<how-to-verify>` and `<resume-signal>`.

**Issue 2a (warning):** `05-02 Task 3` (`calibrate-hough.mjs`) uses `<verify><automated>node scripts/calibrate-hough.mjs</automated></verify>`, but the script is explicitly described as "informational, exit 0 always." An automated verify that always passes is not a verification — it's a smoke run. Consider:
- Change verify to assert the calibration file was written: `test -f .planning/phases/05-setup-tooling/05-02-calibration.md`
- OR surface a failing exit code when recall < 45/54 so the Task 4 checkpoint is the only remaining gate.

**Issue 2b (warning):** `05-05 Task 1` behavior section mentions `src/setup/FileDrop.tsx` will "reject if type not in the accept whitelist" but the `<done>` block of Task 1 does not enumerate this as a completion criterion. Low risk — the test spec covers it. Acceptable.

**Issue 2c (warning):** `05-07 Task 3` verify is `test -f .planning/phases/05-setup-tooling/05-UAT.md` — this only checks existence, not content. Acceptable for a human-authored checklist, but the plan should also verify `grep -c '^## ' 05-UAT.md` ≥ 5 to ensure all required sections (Environment, Build gate, Guest-path regression, Setup flow, Approve+export, Bundle isolation, Requirements traceability) were written.

No blockers in this dimension.

---

## Dimension 3: Dependency Correctness — NEEDS-FIXES

**Plan wave/dep graph as declared:**

| Plan | Wave | depends_on | Files touched |
|------|------|------------|---------------|
| 05-01 | 1 | [] | `src/main.tsx`, `src/setup/SetupApp.{tsx,css}`, `src/setup/index.ts`, `src/main.test.tsx` |
| 05-02 | 2 | ["05-01"] | `package.json`, `package-lock.json`, `src/setup/types.ts`, `src/setup/houghDefaults.ts`, `scripts/calibrate-hough.mjs`, `.planning/.../05-02-calibration.md` |
| 05-03 | 1 | [] | `src/components/FloorPlan.tsx`, `src/components/FloorPlan.test.tsx` |
| 05-04 | 3 | ["05-01", "05-02"] | `src/setup/detect.ts`, `detect.test.ts`, `ocr.ts`, `ocr.test.ts`, `pipeline.ts`, `pipeline.test.ts` |
| 05-05 | 4 | ["05-01", "05-03", "05-04"] | `src/setup/SetupApp.tsx`, `SetupApp.css`, `FileDrop.{tsx,test}`, `ReviewCanvas.{tsx,css,test}`, `LivePreview.{tsx,test}`, `dupWarning.ts` |
| 05-06 | 5 | ["05-03", "05-05"] | `src/setup/validation.{ts,test}`, `exportConfig.{ts,test}`, `ExportPanel.{tsx,css,test}`, `src/setup/SetupApp.tsx` |
| 05-07 | 6 | ["05-01","05-02","05-03","05-04","05-05","05-06"] | `scripts/verify-setup-split.mjs`, `package.json`, `README.md`, `CLAUDE.md`, `05-UAT.md` |

**Issue 3a (blocker):** 05-02 declares `depends_on: ["05-01"]` and `wave: 2`, but NOTHING in 05-02 actually depends on 05-01 outputs. 05-02 writes to `package.json`, `src/setup/types.ts`, `src/setup/houghDefaults.ts`, and a calibration script. None reference `SetupApp.tsx` or `main.tsx`.
**Fix:** Change 05-02 frontmatter to `wave: 1, depends_on: []`. This unlocks parallel execution in Wave 1: `{05-01, 05-02, 05-03}`.

**Issue 3b (blocker):** 05-06 declares `depends_on: ["05-03", "05-05"]` but omits **05-04**. 05-06's validation and exportConfig modules import the `DraftPin` type (from `src/setup/types.ts`, written by 05-02) and are fed runtime pins produced by the pipeline (from 05-04). 05-06 Task 3 also edits `SetupApp.tsx`, which is extensively modified by 05-05 — so 05-05 IS correctly listed, but the path goes through 05-04. Strictly, 05-06's type-level deps are `{05-02 (types), 05-03 (FloorPlanConfig), 05-05 (SetupApp surface)}`. But since 05-05 transitively depends on 05-04, this is *structurally* fine at the dependency-graph level — the wave number (5) is correct.
**Recommended fix:** Add `05-02` and `05-04` explicitly to `05-06.depends_on` for completeness, OR document that the transitive chain is intentional. Not strictly a blocker if the wave dispatcher only consults wave numbers, but confusing.

**Issue 3c (warning):** 05-05 `depends_on` is `["05-01", "05-03", "05-04"]` but 05-05 Task 1 imports `DraftPin` from `src/setup/types.ts` (written by 05-02). Add `"05-02"` to `05-05.depends_on`. Same situation as 3b — transitively fine via 05-04, explicitly incomplete.

**Issue 3d (resolved):** Wave 1 currently has {05-01, 05-03} with disjoint file sets (`src/main.tsx` + `src/setup/*` vs `src/components/FloorPlan.tsx`). Adding 05-02 to Wave 1 per fix 3a keeps disjointness (`package.json` + `src/setup/types.ts` + `src/setup/houghDefaults.ts` + `scripts/calibrate-hough.mjs` all unique). **No file-conflict blocker.**

**Issue 3e (warning):** 05-02 Task 4 is a `checkpoint:human-verify` with `<resume-signal>calibration-accepted</resume-signal>`. If 05-02 lives in Wave 1 (per fix 3a), this checkpoint will pause the entire wave pipeline. Acceptable behavior (the checkpoint exists for a reason), but flag: the orchestrator must honor `autonomous: false` and not dispatch Wave 2 until this checkpoint is signalled.

No cycles. No forward references. Wave ordering (after fixes) is valid: `Wave 1 {01,02,03} → Wave 3 {04} → Wave 4 {05} → Wave 5 {06} → Wave 6 {07}`. (There is no "Wave 2" — numbering is sparse, which is fine.)

---

## Dimension 4: Key Links Planned — PASS

Every must_haves.key_links entry has a corresponding `<action>` that implements the wiring:

| Plan | Key Link | Wired By |
|------|----------|----------|
| 05-01 | main.tsx → SetupApp (React.lazy) | Task 2 `<action>` explicitly writes `lazy(() => import('./setup/SetupApp'))` |
| 05-03 | FloorPlan → FloorPlanConfig (export) | Task 1 `<action>` promotes local interface to `export interface` |
| 05-04 | pipeline.ts → detect.ts + ocr.ts | Task 3 `<action>` imports both and orchestrates |
| 05-05 | SetupApp → runDetectionPipeline | Task 3 `<action>` calls `await runDetectionPipeline(...)` in onClick handler |
| 05-05 | LivePreview → FloorPlan + FloorPlanConfig | Task 2 `<action>` imports both via `../components/FloorPlan` |
| 05-06 | exportConfig → FloorPlanConfig | Task 1 `<action>` imports type from `../components/FloorPlan` |
| 05-06 | ExportPanel → navigator.clipboard | Task 2 `<action>` implements feature-detected call + fallback |
| 05-07 | package.json build → verify-setup-split.mjs | Task 2 `<action>` extends build chain |

All key_link patterns can be regex-verified post-execution. No "artifact-without-wiring" gaps.

---

## Dimension 5: Scope Sanity — WARNING

| Plan | Tasks | Files modified | Verdict |
|------|-------|----------------|---------|
| 05-01 | 3 | 5 | GOOD |
| 05-02 | 4 (incl. 1 checkpoint) | 6 | GOOD (checkpoint is not an implementation task) |
| 05-03 | 2 | 2 | GOOD |
| 05-04 | 3 | 6 (all `src/setup/*.ts`) | BORDERLINE — the plan itself admits "this sits on the boundary of the 2-3 task budget" |
| 05-05 | 4 (incl. 1 checkpoint) | 10 | **WARNING** — largest plan; 3 implementation tasks spanning FileDrop, dupWarning, ReviewCanvas, LivePreview, SetupApp rewiring |
| 05-06 | 3 | 8 | BORDERLINE |
| 05-07 | 4 (incl. 1 checkpoint) | 5 | GOOD |

**Issue 5a (warning):** `05-05` has 10 files with 3 implementation tasks (22 test specs called out across FileDrop/dupWarning/ReviewCanvas/LivePreview/SetupApp). The plan itself rationalizes this as intentional, and Tasks 1 and 2 do logically group small modules + big component. No action required, but flag to the executor: if context gets tight, Task 3 (SetupApp wiring) is the natural split point.

**Issue 5b (info):** `05-04` groups three modules into one plan because they are tightly coupled. Acceptable — the plan's rationale is sound.

---

## Dimension 6: Verification Derivation — PASS

All `must_haves.truths` are user-observable or structurally-enforceable:
- "admin can drag a pin" (observable)
- "buildFloorPlanConfig rounds x/y to 4 decimal places" (enforceable by test)
- "guest entry chunk does not contain 'opencv'" (enforceable by grep gate)

**No implementation-focused truths** (e.g., no "JWT library installed" equivalents).

All `artifacts.min_lines` values are reasonable for the claimed content:
- `ReviewCanvas.tsx` min_lines: 180 — matches the drag+edit+add+delete complexity
- `exportConfig.test.ts` min_lines: 45 — matches 5 specs including a byte-equivalence fixture
- `verify-setup-split.mjs` min_lines: 50 — matches the grep gate shape in RESEARCH.md §Code Examples

---

## Dimension 7: Context Compliance — PASS (with 1 watch item)

**Locked decision coverage (D-01..D-18):**

| Decision | Plan(s) | Implementation |
|----------|---------|----------------|
| D-01 lazy boundary | 05-01 T2 | `lazy(() => import('./setup/SetupApp'))` |
| D-02 no router, pathname dispatch | 05-01 T2 | inline `window.location.pathname === '/setup'` check |
| D-03 build-smoke grep test | 05-07 T1 | `scripts/verify-setup-split.mjs` |
| D-04 no auth, warning copy | 05-01 T1 | subtitle "route obscurity only, DO NOT share this URL" + 05-07 T2 README |
| D-05 opencv + tesseract lazy | 05-02 T1 (install), 05-04 (use inside src/setup only) |
| D-06 detection flow | 05-04 T3 `runDetectionPipeline` |
| D-07 coords as fractions | 05-04 T3 builds DraftPin with x/y/r divided by bitmap dims |
| D-08 digit whitelist | 05-04 T2 `setParameters({ tessedit_char_whitelist: '0123456789' })` |
| D-09 confidence threshold 60 | 05-04 T3 status derivation (`ocr.confidence < 60`) |
| D-10 detect on button click | 05-05 T3 `onDetect` handler, NOT useEffect |
| D-11 pin color variants | 05-05 T2 ReviewCanvas status classes (red/orange/slate-?) |
| D-12 drag/click/delete/add | 05-05 T2 `<behavior>` enumerates all four |
| D-13 live preview via real FloorPlan | 05-05 T2 LivePreview wraps `<FloorPlan config={...} imageSrc={...} />` |
| D-14 dup warning ≤3% | 05-05 T1 `findDuplicatePositions(pins, 0.03)` |
| D-15 approve validation | 05-06 T1 validateDraftPins + T3 onApprove |
| D-16 JSON shape + 4dp | 05-06 T1 buildFloorPlanConfig + roundTo4 |
| D-17 Download + Copy side-by-side | 05-06 T2 ExportPanel |
| D-18 no write-back, manual paste | 05-06 T2 reminder paragraph quoting D-18 |

**100% decision coverage. No contradictions.**

**Deferred ideas NOT present in plans (good):**
- TOOL-05 (guest-list UI) — absent ✓
- localStorage draft recovery — absent ✓
- multi-image support — absent ✓
- auth gate on /setup — absent ✓
- autosave / auto-push to repo — absent ✓
- per-table metadata editing — absent ✓
- OCR confidence tuning UI — absent ✓ (05-02 defers slider UI to "only if defaults fail")

**Watch item:** 05-02 Task 4's decision tree mentions adjusting `param2` to 20 or 45 — both of which are outside the value range RESEARCH.md tested. If calibration demands these values, 05-02 SUMMARY must flag it. Not a scope change, just runtime tuning.

---

## Dimension 7b: Scope Reduction Detection — PASS

Scanned all 7 plans for: `"v1"`, `"v2"`, `"simplified"`, `"static for now"`, `"hardcoded"`, `"placeholder"`, `"basic version"`, `"minimal"`, `"stub"`, `"not wired"`, `"too complex"`, `"would take"`.

Matches found:
- 05-01 T1 "A disabled-looking `<button className='setup-upload-button'>Upload floor plan</button>` **placeholder** (no onClick yet)" — This is explicit scope handoff to 05-05; the button is re-wired in 05-05 T3. Not a reduction.
- 05-01 `<interfaces>` "Upload button is a visible **placeholder**; click handler becomes `onFile(file)` wired by plan 05-05" — Same. Not a reduction.
- 05-04 T2 note "defaults are fine ... A future plan can thread the richer status upstream if needed" — The richer Tesseract init-status is Claude's discretion per CONTEXT (not a locked D-XX); absence is a valid discretion call, not a reduction.
- 05-05 T3 "Approve button ... `disabled` in this plan — plan 05-06 wires it" — Scope handoff, not reduction.
- 05-07 `<behavior>` "Plan is autonomous=false because it contains a checkpoint" — not a scope term.

**No silent scope reductions found.** Every "placeholder" has an explicit wire-up location in a later plan. Every deferred polish is covered by Claude's Discretion, not a locked decision.

---

## Dimension 7c: Architectural Tier Compliance — PASS

RESEARCH.md provides an Architectural Responsibility Map. All plan tasks assign work to the correct tier:

| Capability | Map says | Plans assign to |
|------------|----------|-----------------|
| Route dispatch | Browser/Client (`main.tsx`) | 05-01 T2 ✓ |
| Image decode | Browser/Client | 05-05 T1 (FileDrop) ✓ |
| Circle detection | Browser/Client WASM | 05-04 T1 (detect.ts) ✓ |
| OCR | Browser/Client Worker | 05-04 T2 (ocr.ts) ✓ |
| Review UI state | Browser/Client useState | 05-05 T3 (SetupApp) ✓ |
| Live preview | Browser/Client (`<FloorPlan>` reused) | 05-05 T2 (LivePreview) ✓ |
| Export | Browser/Client Blob/clipboard | 05-06 T2 (ExportPanel) ✓ |
| Bundle isolation | Build-time (Vite + script) | 05-07 T1 (verify-setup-split.mjs) ✓ |

**No tier mismatches.** (Aside: 05-02's `calibrate-hough.mjs` runs in Node for calibration, which is a tool-time tier not listed in the map. RESEARCH.md §Wave 0 Gaps explicitly calls out this manual calibration. Not a tier violation.)

---

## Dimension 8: Nyquist Compliance — PASS (with 1 tight spot)

**Check 8e — VALIDATION.md existence:** No dedicated `05-VALIDATION.md` exists, but RESEARCH.md has a full `## Validation Architecture` section (lines 900-940) covering:
- Test Framework (Vitest 4.1.4)
- Phase Requirements → Test Map
- Sampling Rate
- Wave 0 Gaps

This satisfies the Nyquist gate in the absence of a split-out VALIDATION.md.

**Check 8a — Automated verify presence:** Every non-checkpoint task has an `<automated>` verify block. Sampled:
- 05-01 T1: `npx tsc --noEmit && npm run lint -- src/setup` ✓
- 05-01 T2: `npx tsc --noEmit && npm run lint` ✓
- 05-04 T1: `npm test -- src/setup/detect.test` ✓
- 05-06 T1: `npm test -- src/setup/validation src/setup/exportConfig` ✓
- 05-07 T1: `npm run build` ✓

**Check 8b — Feedback latency:**
- `npx tsc --noEmit` ~5-15s
- `npm run lint -- src/setup` ~2-5s
- `npm test -- <path>` ~5-15s per
- `npm run build` ~30-60s (slowest; acceptable for build-gate verify in 05-07)

No watch-mode flags. No >30s delays in unit-level verifies. All green.

**Check 8c — Sampling continuity:** In each plan, every implementation task has automated verification. No "3 consecutive without" windows.

**Check 8d — Wave 0 completeness:** No `<automated>MISSING</automated>` references. Wave 0 gaps enumerated in RESEARCH.md are covered by 05-02 (types+defaults+calibration) and 05-04 (detect/ocr/pipeline). Correctly addressed.

**Tight spot (warning):** The **byte-equivalence test** in 05-06 T1 spec 5 is the only runtime contract for TOOL-02. If formatting diverges from `src/config/floorPlan.json`, the ENTIRE TOOL-02 requirement fails. The plan must pin the serializer formatting before execution (see Issue 5 below).

**Overall Nyquist status: PASS** with the byte-equivalence caveat captured as Issue 5.

---

## Dimension 9: Cross-Plan Data Contracts — PASS

Shared data entities and their cross-plan transformations:

| Entity | Producer | Consumer | Transform | Compatible? |
|--------|----------|----------|-----------|-------------|
| `DraftPin` | 05-04 T3 pipeline | 05-05 review, 05-06 validate + export | Read-only shape in validators; mutable x/y via drag | ✓ same shape throughout |
| `FloorPlanConfig` | 05-03 (export), 05-06 T1 (build) | 05-05 LivePreview, 05-06 ExportPanel | identity consumption | ✓ |
| Uploaded file → ImageBitmap | 05-05 T1 FileDrop | 05-05 T3 SetupApp → 05-04 pipeline | `createImageBitmap(file, { resizeWidth: 3000 })` once in FileDrop, AGAIN `createImageBitmap(bitmap, { resizeWidth: 3000 })` inside `runDetectionPipeline` if >3000 | **Double-resize is a no-op** for already-≤3000 bitmaps (the pipeline check is `>3000`), so there's no re-decode loss. ✓ |
| Object URL (blob:) | 05-05 T1 FileDrop creates | 05-05 T3 SetupApp passes to ReviewCanvas + LivePreview | `URL.revokeObjectURL` on URL change in SetupApp's useEffect cleanup | ✓ no premature revoke; LivePreview only reads until next upload |

**No incompatible transforms on shared data.** No plan strips data another plan needs.

---

## Dimension 10: CLAUDE.md Compliance — PASS (with 1 tiny nit)

Project conventions enforced by plans:
- **`function` declarations, not arrows** — 05-01 T1 explicitly says "default-exported function component named SetupApp" ✓
- **PascalCase `.tsx`, kebab-case CSS, component-prefixed class names** — 05-01 CSS uses `.setup-`, 05-05 uses `.review-*`, 05-06 uses `.export-panel-*` ✓
- **camelCase functions + event handlers prefixed `handle`** — 05-05 uses `onImageReady`, `onDetect`, `onApprove` (callback prop prefix `on` per convention; internal handlers are arrow expressions passed inline, which is idiomatic React and matches existing `App.tsx`) ✓
- **No CSS modules / Tailwind** — plans use plain CSS files co-located ✓
- **ESLint: max-warnings 0, strict TS** — every plan runs `npm run lint` and `npx tsc --noEmit` in verify ✓
- **Shared types in `src/types.ts` OR `src/setup/types.ts` for setup-specific** — 05-02 correctly places setup types in `src/setup/types.ts` (parallel tree pattern per CLAUDE.md) ✓
- **Error-card pattern from App.tsx reused** — 05-05 FileDrop, SetupApp both reference this pattern ✓
- **GSD workflow enforcement** — plans are themselves GSD plans; not a direct compliance concern.

**Nit (info):** CLAUDE.md says "Default exports for all React components." 05-05 T2 `ReviewCanvas.tsx` default-exports via `export default function ReviewCanvas(props)` — compliant. LivePreview default-exports — compliant. `buildSyntheticConfig` is a named export from LivePreview.tsx (not a component) — compliant. No issues.

---

## Dimension 11: Research Resolution — PASS

RESEARCH.md has `## Open Questions` at line 864 *without* the `(RESOLVED)` suffix. Let me check question-by-question:

1. "Should FloorPlan.tsx accept a `config` prop for live preview" — **Recommendation: Option A** is given. Implemented by 05-03.
2. "Does Tesseract pass `ImageData` directly" — **Recommendation: prototype both in Wave 0** and fallback path documented. 05-04 T3 feeds `ImageData[]` directly; if it fails during Wave 0 execution, the fallback (draw into OffscreenCanvas) is pre-documented.
3. "False-positive circles spam the review UI" — **Recommendation: FP rate is a Wave 0 metric.** 05-02 Task 4 decision tree explicitly tunes `param2` based on FP count.

Each question has an inline recommendation that later plans implement. The section heading should be marked `(RESOLVED)` per GSD convention, but all three questions ARE resolved in substance.

**Issue 11a (warning):** Update RESEARCH.md line 864 from `## Open Questions` to `## Open Questions (RESOLVED)` for workflow-gate cleanliness. Non-blocking; content is correct.

---

## Dimension 12: Pattern Compliance — SKIPPED

No `05-PATTERNS.md` file found in `.planning/phases/05-setup-tooling/`. Phase did not generate one. Dimension skipped per spec.

(Recommendation: since Phase 5 introduces a new `src/setup/` boundary with novel patterns, a brief PATTERNS.md could help the executor — but this is optional and not a blocker.)

---

## Critical Issues — Concrete Fixes

### Issue 1 (BLOCKER): 05-02 wave/depends_on mis-assignment

**File:** `.planning/phases/05-setup-tooling/05-02-PLAN.md` frontmatter

**Current:**
```yaml
wave: 2
depends_on: ["05-01"]
```

**Fix to:**
```yaml
wave: 1
depends_on: []
```

**Rationale:** 05-02 touches `package.json`, `src/setup/types.ts`, `src/setup/houghDefaults.ts`, `scripts/calibrate-hough.mjs`, `.planning/phases/05-setup-tooling/05-02-calibration.md`. None of these are produced by 05-01. Parallel execution with 05-01 and 05-03 is safe (disjoint file sets). The downstream wave numbers need no change — 05-04 and beyond still get their prerequisites.

### Issue 2 (BLOCKER): 05-06 serializer byte-equivalence strategy

**File:** `.planning/phases/05-setup-tooling/05-06-PLAN.md` Task 1 behavior

**Problem:** `src/config/floorPlan.json` has each table entry on a single line:
```json
"1": { "x": 0.2758, "y": 0.3854 },
```
but `JSON.stringify(cfg, null, 2)` emits:
```json
"1": {
  "x": 0.2758,
  "y": 0.3854
},
```
These are NOT byte-equivalent. The plan hand-waves this with "adjust serializeFloorPlanConfig to match whatever the file actually ends with" but does not commit to a strategy.

**Fix (pick one, document in plan):**

**Option A — Match existing file format (custom serializer):**
```ts
export function serializeFloorPlanConfig(cfg: FloorPlanConfig): string {
  const entries = Object.entries(cfg.tablePositions)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([id, pos]) => `    "${id}": { "x": ${pos.x}, "y": ${pos.y} }`)
    .join(',\n');
  return `{\n  "imageFileName": ${JSON.stringify(cfg.imageFileName)},\n  "tablePositions": {\n${entries}\n  }\n}\n`;
}
```

**Option B — Reformat the ground truth file to canonical JSON.stringify output:**
Run `node -e "const fs=require('fs');const c=require('./src/config/floorPlan.json');fs.writeFileSync('./src/config/floorPlan.json',JSON.stringify(c,null,2)+'\n');"` once, commit the reformatted file, then byte-equivalence is trivially achieved by `JSON.stringify(cfg, null, 2) + '\n'`.

**Recommendation:** Option A preserves git blame on the existing file and is clearly documented. Update `05-06-PLAN.md` Task 1 `<action>` block to specify Option A's custom serializer explicitly, and add a note: "The existing file format is single-line-per-entry; JSON.stringify(null, 2) does NOT match. Use the custom concatenation above."

### Issue 3 (BLOCKER): 05-01 Task 3 — main.tsx export of Root

**File:** `.planning/phases/05-setup-tooling/05-01-PLAN.md` Task 2 + Task 3

**Problem:** Task 3 `<action>` says "Import the Root component — this requires exporting Root from src/main.tsx (if it isn't already exported as a named export alongside the default mount, add a named `export function Root`)." But `main.tsx` calls `createRoot(document.getElementById('root')!).render(...)` at module scope. Importing `Root` from a test file will trigger `createRoot` against jsdom's body, which:
1. Either crashes (no `#root` div in test env), or
2. Pollutes module state across tests.

**Fix:** Split into two files in Task 2:

```tsx
// src/Root.tsx — NEW pure component
export function Root() {
  if (typeof window !== 'undefined' && window.location.pathname === '/setup') {
    return (
      <Suspense fallback={<div className="setup-loading">Loading setup tool…</div>}>
        <SetupApp />
      </Suspense>
    );
  }
  return <App />;
}

// src/main.tsx — thin entry shim
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Root } from './Root';

createRoot(document.getElementById('root')!).render(
  <StrictMode><Root /></StrictMode>,
);
```

Then Task 3 tests `src/Root.tsx` directly without triggering `createRoot`. Update `files_modified` in 05-01 frontmatter accordingly (add `src/Root.tsx`, test file becomes `src/Root.test.tsx`).

### Issue 4 (WARNING): 05-07 grep gate false-positive risk

**File:** `.planning/phases/05-setup-tooling/05-07-PLAN.md` Task 1

**Current forbidden list:** `['opencv', 'tesseract', 'SetupApp', 'HoughCircles', 'createWorker', 'DraftPin']`

**Problem:** `createWorker` is a generic identifier. Vite minification may rename it, but if some other dep (e.g., a workerpool library) ships an un-renamed `createWorker` helper that ends up in the guest bundle, this grep produces a false positive.

**Fix:** Narrow to strings that are *unambiguously* from the setup graph:
```js
const forbidden = [
  'opencv',               // @techstark/opencv-js package string
  'tesseract',            // tesseract.js package string
  'HoughCircles',         // cv API — appears as literal in minified bundles
  'tessedit_char_whitelist', // our exact literal string for OCR config
  'DraftPin',             // setup-only type name
  'runDetectionPipeline', // setup-only function name
];
```

Drop `SetupApp` (may appear as a minified string literal in the lazy import map anyway — causes false positive in the chunk-map itself). Drop `createWorker` (too generic). Add `tessedit_char_whitelist` (present only in ocr.ts) and `runDetectionPipeline` (present only in pipeline.ts).

Also: use case-sensitive matching for the code-identifier strings (`HoughCircles`, `DraftPin`, `runDetectionPipeline`, `tessedit_char_whitelist`) and case-insensitive for the package strings (`opencv`, `tesseract`).

### Issue 5 (WARNING): 05-05 Task 2 test 4 race condition

**File:** `.planning/phases/05-setup-tooling/05-05-PLAN.md` Task 2 `<behavior>` test 4

**Problem:** "focusedTableNumber propagates to FloorPlan — pin for that number renders with .pin-assigned class" will fail in jsdom unless `<img>` onLoad fires, because FloorPlan only renders the `.pin-assigned` div after `imageLoaded` state is set.

**Fix:** Update test 4 behavior to:
```ts
test 4: fireEvent.load(getByRole('img')); // force onLoad
await waitFor(() => expect(...).toHaveClass('pin-assigned'));
```

Document this in the test's `<action>` block.

### Issue 6 (WARNING): 05-02 Task 3 verify is vacuous

**File:** `.planning/phases/05-setup-tooling/05-02-PLAN.md` Task 3 verify

**Current:** `node scripts/calibrate-hough.mjs` (script always exits 0)

**Fix:** Change to:
```xml
<verify>
  <automated>node scripts/calibrate-hough.mjs && test -f .planning/phases/05-setup-tooling/05-02-calibration.md</automated>
</verify>
```

This at least confirms the script produced its artifact.

### Issue 7 (WARNING): explicit deps in 05-05 / 05-06

**Files:** 05-05, 05-06 frontmatter

**Fix:** Add missing transitive deps explicitly for clarity:
- 05-05 `depends_on`: `["05-01", "05-02", "05-03", "05-04"]` (add `05-02`)
- 05-06 `depends_on`: `["05-02", "05-03", "05-04", "05-05"]` (add `05-02`, `05-04`)

Wave numbers stay the same.

---

## Verdict

**NEEDS-FIXES** — 3 blockers, 4 warnings, 0 scope-reduction blockers.

The phase is fundamentally sound: requirements fully covered, all 18 decisions implemented, no contradictions, no silent scope reductions, StrictMode discipline preserved, byte-equivalence test concretely runnable, grep gate real. The fixes above are surgical plan-frontmatter and plan-action edits — no structural rework needed.

**After fixes:** Re-verify (quick pass) and move to `/gsd-execute-phase 05`.

**Recommended order of fixes:**
1. Apply Issue 1 (05-02 wave reassignment) — unblocks Wave 1 parallelism.
2. Apply Issue 2 (05-06 serializer commitment) — prevents wasted execution attempt.
3. Apply Issue 3 (split main.tsx → Root.tsx + entry shim) — prevents Task 3 jsdom failure.
4. Apply Issues 4, 5, 6, 7 — hygiene improvements, can be batched.

Estimated plan-revision scope: small (frontmatter edits + 3 behavior clarifications). No re-research required.

---

## Summary Table

| Dimension | Status | Notes |
|-----------|--------|-------|
| 1. Requirement Coverage | PASS | All 4 TOOL requirements covered with named tasks |
| 2. Task Completeness | WARNING | 2 verify blocks could be tightened; no blockers |
| 3. Dependency Correctness | **NEEDS-FIXES** | 05-02 wave mis-assigned; 05-05/06 deps incomplete |
| 4. Key Links Planned | PASS | All artifact-wiring explicit in actions |
| 5. Scope Sanity | WARNING | 05-05 is large but justified |
| 6. Verification Derivation | PASS | Truths are user-observable or testable |
| 7. Context Compliance | PASS | 18/18 decisions, 0 deferred ideas present |
| 7b. Scope Reduction | PASS | No silent reductions |
| 7c. Architectural Tier | PASS | All tasks in correct tier |
| 8. Nyquist Compliance | PASS | Automated verify per task; latency OK |
| 9. Cross-Plan Contracts | PASS | DraftPin + FloorPlanConfig flow clean |
| 10. CLAUDE.md Compliance | PASS | All project conventions respected |
| 11. Research Resolution | WARNING | Open Questions resolved in substance; header needs (RESOLVED) suffix |
| 12. Pattern Compliance | SKIPPED | No PATTERNS.md |

**Final verdict: NEEDS-FIXES**
