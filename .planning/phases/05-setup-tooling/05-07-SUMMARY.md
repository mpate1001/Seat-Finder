---
phase: 05-setup-tooling
plan: 07
subsystem: tooling
tags: [bundle-isolation, grep-gate, ci, uat, docs, TOOL-03]
status: awaiting_uat

# Dependency graph
requires:
  - phase: 05-setup-tooling
    provides: SetupApp bundled into its own /setup chunk (plan 05-01)
  - phase: 05-setup-tooling
    provides: runDetectionPipeline + DraftPin setup-only symbols (plan 05-04)
  - phase: 05-setup-tooling
    provides: Approve + byte-equivalent export (plan 05-06)
  - phase: 04-performance-offline
    provides: scripts/verify-pwa-build.mjs precedent + npm run build chain (plan 04-06)
provides:
  - scripts/verify-setup-split.mjs — grep gate + positive CV-chunk assertion
  - npm run build chain: tsc → vite build → verify-pwa-build → verify-setup-split
  - README ## Setup tool section (obscurity warning + workflow + TOOL-03 guarantee)
  - CLAUDE.md Setup tool module boundary rule (enforced at build time)
  - .planning/phases/05-setup-tooling/05-UAT.md admin-runnable checklist
affects: [phase-5-verification, phase-5-completion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Node ESM build-gate script mirrors scripts/verify-pwa-build.mjs (imports from fs + path, resolve + readFileSync, exit-code discipline 0/1)"
    - "Case-insensitive grep on 6 forbidden tokens in dist/assets/index-*.js; Vite minifies identifiers but string literals from lazy-imported module specifiers and package metadata survive — catches both opencv/tesseract leaks and setup-only symbol leaks"
    - "Two-sided assertion: forbidden-list (negative) + positive CV-chunk (positive) — guards against the tree-shaken-to-nothing regression where a weakened negative check would falsely pass"
    - "Narrow forbidden-token list: package names (opencv, tesseract) + literal config key (tessedit_char_whitelist) + setup-only symbols (runDetectionPipeline, DraftPin) + API identifier (HoughCircles). Deliberately drops createWorker (too generic) and SetupApp (minifier-renamed)"

key-files:
  created:
    - scripts/verify-setup-split.mjs
    - .planning/phases/05-setup-tooling/05-UAT.md
  modified:
    - package.json
    - README.md
    - CLAUDE.md

key-decisions:
  - "Forbidden-token list intentionally NARROW: dropped 'createWorker' (false-positive risk across unrelated deps) and 'SetupApp' (minifier may rename the component). Kept opencv + tesseract (package-metadata strings survive minification), HoughCircles (OpenCV API identifier), tessedit_char_whitelist (Tesseract config string literal), runDetectionPipeline + DraftPin (setup-only symbols). This matches the plan's explicit <behavior> list."
  - "Positive CV-chunk assertion is non-negotiable: a forbidden-list-only gate would silently pass if the lazy import were accidentally tree-shaken into nothing. The script confirms at least one file matching /setup|SetupApp/i exists in dist/assets/ AND contains opencv or tesseract. Matches RESEARCH §Code Examples §Build-smoke grep gate precedent."
  - "Case-insensitive matching via content.toLowerCase().includes(needle.toLowerCase()): Vite minifies identifiers but won't rewrite package name strings in chunk metadata or lazily-imported module specifiers; case-insensitive catches any capitalization drift."
  - "README 'Setup tool' section inserted between PWA behavior and Google Sheets Setup — adjacent to the existing deployment/runtime docs so admins reading about deployment find it naturally. Tone matches the existing PWA section; kept concise (~60 lines)."
  - "CLAUDE.md boundary rule wrapped in GSD:phase-5-boundary-start/end markers so the section is preserved across CLAUDE.md regenerations (Phase 4 established this convention with GSD:stack-start/end, GSD:conventions-start/end, etc.). Inserted immediately after the architecture block where future Claude instances will look for module-boundary rules."
  - "UAT checklist is 200 lines: prerequisites, build-gate, guest-regression, setup-flow (34 interaction checks across upload/detect/review/edit/delete/add/dup-warn/mobile/iPhone-Safari), approve+export (byte-diff + clipboard fallback), requirements traceability table, blocking-items summary, resume-signal. Includes the deferred plan-05-02 Hough-calibration recall check (≥83% against 54 tables) as a dedicated step."

requirements-completed: [TOOL-03]

# Metrics
duration: 6min
completed: 2026-04-18
---

# Phase 5 Plan 7: Bundle-Isolation Gate + Docs + UAT Summary (awaiting UAT)

**TOOL-03 enforced at build time via `scripts/verify-setup-split.mjs` (grep gate + positive CV-chunk assertion chained after `verify-pwa-build.mjs`); `## Setup tool` section added to README; `Setup tool module boundary` rule added to CLAUDE.md; `.planning/phases/05-setup-tooling/05-UAT.md` admin checklist committed — 200 lines covering all TOOL-01..TOOL-04 acceptance criteria including the deferred 05-02 Hough-calibration recall check. Tasks 1–3 autonomous + committed; Task 4 is a `checkpoint:human-verify` gate awaiting admin run through `05-UAT.md` on the real Reception Seat Diagram.**

> **Status: awaiting UAT.** Task 4 is a `checkpoint:human-verify` gate requiring the admin to exercise the flow end-to-end in a real browser and mark up `05-UAT.md` with outcomes. The autonomous tasks (Tasks 1–3) are complete, committed, and all verification gates are green.

## Performance

- **Duration:** ~6 min (autonomous execution only; UAT pending)
- **Started:** 2026-04-18T18:23:02Z
- **Completed (autonomous phase):** 2026-04-18T18:29:00Z (approx)
- **Tasks:** 3 autonomous committed; 1 checkpoint awaiting UAT
- **Files created:** 2 (scripts/verify-setup-split.mjs, .planning/phases/05-setup-tooling/05-UAT.md)
- **Files modified:** 3 (package.json, README.md, CLAUDE.md)

## Accomplishments

### Task 1 — `scripts/verify-setup-split.mjs` grep gate (commit `a949d3f`)

- Node ESM script mirroring `verify-pwa-build.mjs` shape: `import { existsSync, readdirSync, readFileSync } from 'fs'; import { resolve } from 'path';` + exit-code discipline (0 = clean, 1 = violation).
- **Fail-fast on missing build output.** `resolve('dist', 'assets')` check — exits 1 with "Did `vite build` run?" if the directory is absent.
- **Entry-chunk identification.** `jsFiles.filter(f => /^index-[A-Za-z0-9_-]+\.js$/.test(f))` — exits 1 if zero candidates.
- **6-token forbidden list** (case-insensitive): `opencv`, `tesseract`, `HoughCircles`, `tessedit_char_whitelist`, `runDetectionPipeline`, `DraftPin`. Rationale documented inline in the script (RESEARCH §Pitfall 8 + §Code Examples + plan <behavior>).
- **Positive CV-chunk assertion.** `jsFiles.filter(f => /setup|SetupApp/i.test(f))` — at least one must contain `opencv` OR `tesseract` (case-insensitive). Catches the tree-shaken-to-nothing regression.
- **Pretty error output** on violation: lists `{file}: matched "{needle}"` per offender + explanatory copy pointing at `src/main.tsx`'s `lazy(() => import('./setup/SetupApp'))` as the one allowed boundary crossing.
- **Success output** lists clean entry chunk(s), setup chunk(s), and the specific CV-verified chunk filename.
- **Package.json build chain updated:** `"tsc && vite build && node scripts/verify-pwa-build.mjs && node scripts/verify-setup-split.mjs"` — verify-setup-split runs AFTER verify-pwa-build as the final gate.
- **Verified against real `dist/`:** clean entry = `index-Dq_jT_7E.js`, CV chunk = `SetupApp-C5EJhpYz.js` (10.8 MB WASM bundle). Guest precache unchanged at 234.23 KiB.
- **Negative-path verified manually** in three `/tmp/` sandboxes: (a) forbidden string present in entry → exit 1 with per-offender list; (b) setup chunk exists but contains no CV deps → exit 1 with "no setup chunk found containing opencv or tesseract"; (c) `dist/assets/` missing → exit 1 with "Did `vite build` run?". All three negative paths emit actionable error messages.

### Task 2 — README + CLAUDE docs (commit `d75d97c`)

- **README.md** gains a new `## Setup tool` section (70 lines) inserted between `## PWA behavior` and `### Google Sheets Setup`:
  - D-04 obscurity warning in a dedicated blockquote ("No authentication — do not share the URL with guests")
  - 5-step workflow: Upload → Detect → Review → Approve → Export
  - Requirements: modern browser + internet on first run (Tesseract fetches `eng.traineddata` from jsDelivr, cached in IndexedDB afterward — Pitfall 4 assumption A5)
  - Secure-context note for clipboard (`https://` or `localhost`), with the textarea-fallback mention
  - **TOOL-03 bundle-isolation guarantee** section: explains the `lazy(() => import('./setup/SetupApp'))` edge as the sole allowed boundary crossing, and `scripts/verify-setup-split.mjs` as the build-time enforcer
  - Local dev instructions (`npm run dev` + `http://localhost:5173/setup`)
  - Known v1 limits deferred to v1.1 (no auth, no localStorage draft recovery, single-image, no repo write-back)
- **CLAUDE.md** gains a new `## Setup tool module boundary (Phase 5)` section (48 lines) wrapped in `<!-- GSD:phase-5-boundary-start -->` / `<!-- GSD:phase-5-boundary-end -->` markers (Phase 4 convention for sections that must survive CLAUDE.md regeneration). Inserted immediately after the architecture block:
  - **The rule:** `@techstark/opencv-js` and `tesseract.js` may ONLY be imported from files under `src/setup/`
  - **The one allowed boundary crossing:** `src/main.tsx`'s `lazy(() => import('./setup/SetupApp'))`
  - **How the rule is enforced:** `scripts/verify-setup-split.mjs` grep gate details + positive CV-chunk assertion
  - **Why:** TOOL-03 keeps the guest bundle at ~224 KB (gzip ~73 KB); the ~11 MB setup chunk stays isolated
  - **When adding new setup-tool code:** put it under `src/setup/`; do NOT import from `src/setup/` in guest-path code (not even type-only imports, since the grep gate matches token presence)

### Task 3 — `05-UAT.md` admin checklist (commit `eb2dfb4`)

- 200-line numbered PASS/FAIL checklist at `.planning/phases/05-setup-tooling/05-UAT.md`:
  - **Prerequisites** (Node 22+, clean git, `npm install`, `.env.local` with `VITE_SHEET_URL`)
  - **Build gate (TOOL-03)** — full chain (tsc + vite + verify-pwa-build + verify-setup-split) + manual `grep -l` double-check on `dist/assets/`
  - **Guest-path regression** — `npm run preview` + visit `/` + verify no `SetupApp-*.js` fetched on guest path + MapView animation intact
  - **Setup flow (TOOL-01 + TOOL-04)** — 34 interaction checks across upload, detect, **detection-accuracy recall on the real Reception Seat Diagram (deferred from plan 05-02: ≥45/54 tables = ≥83% recall, with calibration adjustment path via `src/setup/houghDefaults.ts` param2/minRadius/maxRadius)**, drag, click-to-edit, delete, add (both Add-mode toggle and Shift+click), duplicate-position warning, re-upload, StrictMode double-mount check, mobile layout, iPhone Safari smoke
  - **Approve + export (TOOL-02)** — validation gate (all 4 failure kinds), approved-mode lock, Download + byte-diff against committed `src/config/floorPlan.json`, Copy-to-Clipboard + non-secure-context textarea fallback, Back-to-edit round-trip
  - **Requirements traceability table** — TOOL-01..TOOL-04 line items tied to specific UAT sections
  - **Sign-off table** + **Blocking items summary** (5 minimum-to-clear + nice-to-have list)
  - **Resume signal:** `phase-5-accepted`

## Task Commits

Each autonomous task was committed atomically:

1. **Task 1: verify-setup-split.mjs + package.json chain** — `a949d3f` (feat)
2. **Task 2: README ## Setup tool + CLAUDE setup boundary** — `d75d97c` (docs)
3. **Task 3: 05-UAT.md admin checklist** — `eb2dfb4` (docs)

**Task 4:** `checkpoint:human-verify` — awaiting admin UAT run on real Reception Seat Diagram.

**Plan metadata:** (pending — will commit with SUMMARY + STATE + ROADMAP + REQUIREMENTS update)

## Files Created/Modified

### Created (2)

- `scripts/verify-setup-split.mjs` (124 lines) — TOOL-03 build-gate grep + positive CV-chunk assertion
- `.planning/phases/05-setup-tooling/05-UAT.md` (200 lines) — admin UAT checklist

### Modified (3)

- `package.json` — `build` script now chains `node scripts/verify-setup-split.mjs` after `verify-pwa-build.mjs`
- `README.md` (+70 lines) — `## Setup tool` section
- `CLAUDE.md` (+48 lines) — `## Setup tool module boundary (Phase 5)` section, wrapped in GSD:phase-5-boundary markers

## Verification Gates (autonomous phase)

- `npx tsc --noEmit`: exit 0 (clean)
- `npm run lint`: exit 0 (0 warnings, `--max-warnings 0`)
- `npm run test`: **126/126 passed across 20 test files** (2.96s)
- `npm run build`: exit 0 — all FOUR chained steps pass in order:
  - tsc clean
  - vite build (dist/assets/index-Dq_jT_7E.js 224 KB gzip 73 KB guest entry; SetupApp-C5EJhpYz.js 10.8 MB setup chunk)
  - `PWA build verification passed.` (9 precache entries, 234.23 KiB)
  - `verify-setup-split passed.` (clean guest entry, setup chunk verified with CV deps)

## Decisions Made

See frontmatter `key-decisions`. Highlights:

- **Forbidden list is narrow, not broad.** Dropped `createWorker` (too generic — unrelated deps export this) and `SetupApp` (minifier may rename the component). Kept package-name strings + API identifier + Tesseract config literal + two setup-only symbols. Matches the plan's <behavior> exactly.
- **Positive CV-chunk assertion is mandatory.** A forbidden-list-only gate would silently pass on a tree-shaken-to-nothing regression. The script asserts at least one setup chunk exists AND contains opencv or tesseract.
- **CLAUDE.md boundary section uses GSD markers.** Wrapped in `<!-- GSD:phase-5-boundary-start -->` / `<!-- GSD:phase-5-boundary-end -->` matching the Phase 4 convention so the section survives any future CLAUDE.md regeneration.
- **UAT includes the deferred plan-05-02 Hough-calibration recall check.** Plan 05-02 calibration was deferred to in-browser UAT because Node-side WASM calibration deadlocked at 15+ minutes. The UAT now has a dedicated step 3d asking the admin to count matches against the 54 ground-truth tables with a target of ≥83% recall and a tuning-knob path via `src/setup/houghDefaults.ts`.

## Deviations from Plan

### Auto-fixed Issues

**None.** The plan executed exactly as written. All three autonomous tasks landed with no bugs, no missing functionality, no blocking issues.

Negative-path testing of `verify-setup-split.mjs` was done in `/tmp/` sandboxes rather than committed as unit tests — the script is a build-gate that only ever runs against `dist/`, and the sandboxed tests cover all three exit-1 branches plus the exit-0 positive path against the real dist output. A vitest-compatible unit test would require abstracting the script behind a function, which is scope creep for a 120-line build gate.

## Issues Encountered

- **`npm run build` requires `VITE_SHEET_URL`** — this is the plan-04-01 env-var gate, not a regression. Sourcing `.env.local` (`export $(grep -v '^#' .env.local | xargs)`) before `npm run build` satisfies the guard. Expected operating procedure per `.env.example`.
- **Pre-existing untracked files** — `.omc/`, `public/FINAL_Reception Table Arrangments.png`, `scripts/calibrate-hough.mjs` are pre-existing out-of-scope artifacts (noted in plans 05-05 and 05-06 summaries); not committed. `FINAL_Reception Table Arrangments.png` is referenced in the UAT as the real-image calibration input — admin can drop it into `/setup` during UAT.

## User Setup Required

None — the grep gate runs automatically on `npm run build`. Admin must run `05-UAT.md` top-to-bottom in a real browser for Task 4 UAT acceptance. `.env.local` with `VITE_SHEET_URL` is already required from plan 04-01.

## How to Run the UAT (Task 4)

```bash
# Build (prove the gate works)
export $(grep -v '^#' .env.local | xargs) && npm run build
# Final line should be:
#   verify-setup-split passed.
#     Clean guest entry chunk(s): ["index-<hash>.js"]
#     Setup chunk(s): ["SetupApp-<hash>.js"]
#     CV chunk verified: SetupApp-<hash>.js

# Preview for guest-regression + setup flow
npm run preview
# Then open http://localhost:4173 (or LAN IP over HTTPS for iPhone)
```

Then walk through `.planning/phases/05-setup-tooling/05-UAT.md` section by section, marking PASS/FAIL on each numbered check. Resume signal: `phase-5-accepted` when all blocking items pass.

## Known Stubs

None. All three autonomous tasks produced complete, production-ready artifacts. No placeholder text, no hardcoded empty arrays, no deferred wiring.

## Threat Flags

None. This plan introduces no new network endpoints, auth paths, file access patterns, or schema changes. The grep gate is a read-only build-time check on `dist/assets/`; the README/CLAUDE docs are prose; the UAT is a checklist. Bundle-isolation enforcement is a defensive posture that REDUCES trust-boundary surface (keeps OpenCV + Tesseract off the guest path).

## TDD Gate Compliance

N/A — this plan is `type: execute`, not `type: tdd`. The grep gate is a build-time integration check; abstracting it for unit testing would invert the dependency (the script operates on `dist/` which only exists after `vite build`).

## Next Phase Readiness

**Ready for Phase 5 completion (after Task 4 UAT):**

- TOOL-01 acceptance: covered by UAT sections 3a–3j (upload + detect + review interactions)
- TOOL-02 acceptance: covered by UAT section 4c (byte-diff against `src/config/floorPlan.json`) + 4d (Copy-to-Clipboard + textarea fallback)
- **TOOL-03 acceptance: SATISFIED automatically on every build** — `scripts/verify-setup-split.mjs` chained into `npm run build`; regression now requires explicitly bypassing the gate (which CI would catch)
- TOOL-04 acceptance: covered by UAT section 3d (detection-accuracy recall ≥83% on real Reception diagram)

**Ready for `/gsd-verify-work`:**

- All Phase 5 artifacts committed: 05-01..05-07 plans, summaries, and now the gate + docs + UAT
- `grep -rn 'tesseract\|opencv' src/ --include='*.{ts,tsx}'` remains contained within `src/setup/` (verified by the grep gate itself)
- `grep -rn 'useEffect.*runDetectionPipeline\|useEffect.*createWorker' src/setup/` returns nothing (Pitfall 3 enforced — pipeline runs in onClick, never useEffect)
- Guest precache stays at 234.23 KiB across 9 entries
- Setup chunk (10.8 MB) excluded from PWA precache via `workbox.globIgnores` (plan 05-05 decision, preserved)

**Ready for `/gsd-complete-phase`:**

- Once Task 4 UAT passes, `/gsd-execute-phase` orchestrator handles marking TOOL-01..TOOL-04 complete in `.planning/REQUIREMENTS.md` and Phase 5 complete in `.planning/ROADMAP.md`

## Self-Check: PASSED

Verified after SUMMARY creation:

- `scripts/verify-setup-split.mjs` — FOUND (124 lines)
- `.planning/phases/05-setup-tooling/05-UAT.md` — FOUND (200 lines)
- `package.json` — modified (build script chains verify-setup-split)
- `README.md` — modified (+70 lines, ## Setup tool section)
- `CLAUDE.md` — modified (+48 lines, Setup tool module boundary section)
- Commit `a949d3f` (Task 1) — FOUND in git log
- Commit `d75d97c` (Task 2) — FOUND in git log
- Commit `eb2dfb4` (Task 3) — FOUND in git log
- Verification gates: `tsc --noEmit` clean; `npm run lint` clean (0 warnings); `npm run test` 126/126 across 20 files; `npm run build` exits 0 with `verify-setup-split passed.`

---
*Phase: 05-setup-tooling*
*Status: awaiting browser UAT (Task 4 checkpoint)*
*Completed (autonomous phase): 2026-04-18*
