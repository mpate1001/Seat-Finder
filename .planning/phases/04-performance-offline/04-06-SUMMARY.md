---
phase: 04-performance-offline
plan: 06
subsystem: build-verification
status: complete
tags: [verification, uat, docs, build-smoke, PERF-01, PERF-02, PERF-03, PERF-04]

requires:
  - phase: 04-performance-offline
    plan: 01
    provides: "requireSheetUrl() plugin + .env.example convention (referenced in README Setup)"
  - phase: 04-performance-offline
    plan: 02
    provides: "guestsCache localStorage SWR behavior (documented in README PWA behavior section)"
  - phase: 04-performance-offline
    plan: 03
    provides: "public/pwa-192.png, public/pwa-512.png, public/pwa-512-maskable.png, public/apple-touch-icon.png — verified by scripts/verify-pwa-build.mjs"
  - phase: 04-performance-offline
    plan: 04
    provides: "<StalenessBadge /> behavior documented in UAT PERF-01 section"
  - phase: 04-performance-offline
    plan: 05
    provides: "dist/sw.js + dist/workbox-*.js + dist/manifest.webmanifest at build time — now asserted by scripts/verify-pwa-build.mjs"

provides:
  - "scripts/verify-pwa-build.mjs — build-time smoke test (exit 0 on pass, exit 1 with missing list on fail)"
  - "package.json `build` script extended: `tsc && vite build && node scripts/verify-pwa-build.mjs`"
  - "README.md Setup + Development + PWA behavior sections (self-contained onboarding without reading .planning/)"
  - "CLAUDE.md ## Scripts section populated (previously empty heading)"
  - ".planning/phases/04-performance-offline/04-UAT.md — 133-line human UAT checklist mapped to PERF-01..PERF-04, with blocking-vs-nice-to-have classification"

affects: []

tech-stack:
  added: []
  patterns:
    - "Build-smoke pattern: tiny node-script existence-check run as last step of npm build; no vitest integration (30s+ per run) or snapshot testing (dist/ is deployable, not a build intermediate)"
    - "Docs onboarding pattern: README self-contained for `cp .env.example .env.local` + generate-pwa-icons; CLAUDE.md Scripts section lists every npm script so Claude sessions can discover the build chain without reading phase planning docs"
    - "UAT checklist pattern: map each automated-test gap to a device-specific checklist item; separate blocking from nice-to-have so sign-off is fast in practice"

key-files:
  created:
    - "scripts/verify-pwa-build.mjs"
    - ".planning/phases/04-performance-offline/04-UAT.md"
  modified:
    - "package.json"
    - "README.md"
    - "CLAUDE.md"

key-decisions:
  - "Script not test: scripts/verify-pwa-build.mjs is a node existence-check (not a vitest integration test). Rationale: a vitest test that runs `vite build` in a tmpdir would take 30+ seconds per run, require Workbox state isolation, and duplicate what we already do in the build pipeline. Presence-check is the contract; byte sizes shift per Workbox/Vite version."
  - "Build chain order: `tsc && vite build && node scripts/verify-pwa-build.mjs` — verifier runs LAST so tsc/Vite errors surface first. Exit-1 from the verifier halts npm run build, which halts CI."
  - "README Setup section placed before the existing Google Sheets Setup block (not after), so a fresh clone reads the env-var flow first. Kept the original CSV example + column table — they are still accurate. Rewrote only step 3 of the old 'Getting Started' to reference `.env.local` instead of editing googleSheets.ts."
  - "CLAUDE.md ## Scripts was an empty heading under <!-- GSD:stack-start --> — populated with 8 entries rather than leaving blank. The section is inside a GSD-managed block, so future `generate-claude-profile` / stack-doc regeneration may overwrite it; acceptable risk since regeneration would include the live script list anyway."
  - "UAT separates blocking (1b, 2a, 3b) from nice-to-have. Rationale: the wedding is in Newport News VA on iOS-majority devices; iOS Add-to-Home-Screen is the single highest-risk PERF-02 behavior and the one automation cannot touch. Android install is nice-to-have, not blocking."

metrics:
  duration: ~3min
  duration_seconds: 191
  started: 2026-04-17T17:31:25Z
  completed_automated: 2026-04-17T17:34:36Z
  tasks_automated_complete: 3
  tasks_total: 4  # task 4 is the human UAT checkpoint
  files: 5  # 2 created, 3 modified
  test_delta: 0  # no new vitest specs; 37/37 still passing from plan 04-05
  gates:
    tsc: pass
    lint: pass
    vitest: "37/37 pass"
    build: "exit 0 with 'PWA build verification passed.'"
    verify_pwa_build_missing_case: "exit 1 with 'Missing files: [ sw.js ]' (verified by deletion test)"

requirements-completed: []  # All PERF-XX are provisionally complete once the UAT is signed off; this SUMMARY does not mark them complete yet.
requirements-awaiting-uat: [PERF-01, PERF-02, PERF-03, PERF-04]
---

# Phase 4 Plan 06: Build Verification + Docs + UAT Checklist Summary

**Phase 4 is code-complete and awaiting human UAT. Three automated tasks shipped — a dist/ smoke-test script wired into `npm run build`, README + CLAUDE.md docs so a fresh clone can set up without reading planning artifacts, and a 133-line UAT checklist that maps every PERF-XX requirement to real-device behaviors automation cannot verify. The phase gate (tsc + vitest + lint + build + verify-pwa-build) exits 0 end-to-end. Sign-off on PERF-01/1b (offline badge), PERF-02/2a (iOS Add to Home Screen), and PERF-03/3b (SW update toast) is required before the phase is marked complete.**

## Status: `awaiting_uat`

The human UAT checkpoint (Task 4 in `04-06-PLAN.md`) is now open. The user
runs through `.planning/phases/04-performance-offline/04-UAT.md` and reports
either "UAT passed" or specific blocking failures.

## Performance

- **Duration:** ~3 min wall clock for Tasks 1–3 (2026-04-17T17:31:25Z → 17:34:36Z UTC, ~191 seconds)
- **Tasks 1–3 (automated):** committed atomically
- **Task 4 (UAT):** human-verify checkpoint — not yet run
- **Files touched:** 5 (2 created, 3 modified)
- **Test delta:** 0 new specs (plan is docs + build-smoke; existing 37/37 still pass from plan 04-05)

## Accomplishments

- **Build-smoke shipped.** `scripts/verify-pwa-build.mjs` checks 7 artifacts in `dist/`: `manifest.webmanifest`, `sw.js`, the hashed `workbox-<hex>.js` (regex), `pwa-192.png`, `pwa-512.png`, `pwa-512-maskable.png`, `apple-touch-icon.png`. Exit 0 prints matched artifacts; exit 1 prints the missing list. Verified both code paths manually (deleted `dist/sw.js`, ran script → exit 1 with `Missing files: [ 'sw.js' ]`; restored and re-ran → exit 0 with matched list).
- **npm build chain is now gated.** `package.json` `build` script is `tsc && vite build && node scripts/verify-pwa-build.mjs` — the verifier runs LAST so tsc errors or Vite bundle failures surface first, but a successful bundle that is missing PWA artifacts (e.g., if `vite-plugin-pwa` is accidentally uninstalled) fails the build loudly. End-to-end: `VITE_SHEET_URL="…" npm run build` finishes with `PWA build verification passed.`
- **README.md now self-contained.** New sections: Setup (`cp .env.example .env.local`, `VITE_SHEET_URL`, `npm run generate-pwa-icons`, `npm run generate-images`), Development (all 8 npm scripts with one-liners), PWA behavior (localStorage SWR, SW precache + CacheFirst, no-caching-for-Sheets, update toast, Add-to-Home-Screen). Preserved existing project description, tech stack, and color-palette sections. Merged the Google Sheets Setup into the new env-var flow (removed the old "edit `src/services/googleSheets.ts`" instruction which was out of date — plan 04-01 moved that to `import.meta.env.VITE_SHEET_URL`).
- **CLAUDE.md Scripts section filled.** The `## Scripts` heading under `<!-- GSD:stack-start -->` was a bare heading with no body. Now lists all 8 npm scripts (`dev`, `build`, `preview`, `lint`, `test`, `test:watch`, `generate-images`, `generate-pwa-icons`) each with a one-line purpose, so future Claude sessions can discover the build chain without reading phase planning docs.
- **04-UAT.md authored.** 133 lines. Four sections corresponding to PERF-01 through PERF-04, 12 numbered checklist items (1a–d, 2a–c, 3a–c, 4a–c), Prerequisites block, Sign-off table, Blocking Items Summary. iOS Add-to-Home-Screen (PERF-02/2a) explicitly flagged blocking per RESEARCH.md Assumption A5. Android install (2b) marked OK to skip if no device available — iOS is the wedding priority. Each item has DevTools or device steps written so the user doesn't have to remember flow details.
- **Full phase gate green:** `npx tsc --noEmit` exit 0, `npm run lint` exit 0 (`--max-warnings 0`), `npx vitest run` 8 files / 37 tests passing (unchanged from plan 04-05 — this plan adds no vitest specs), `VITE_SHEET_URL=… npm run build` exit 0 with the verifier's pass message as the final line.

## Task Commits

Each of Tasks 1–3 was committed atomically on branch `dev`:

1. **Task 1 (build-smoke + build script):** `fbae7f3` — `feat(04-06): add PWA build verification script and wire into npm build`
2. **Task 2 (README + CLAUDE.md docs):** `2240927` — `docs(04-06): add README Setup + PWA behavior; fill CLAUDE.md Scripts`
3. **Task 3 (UAT checklist):** `fec25b0` — `docs(04-06): author Phase 4 UAT checklist for real-device verification`

Task 4 (human UAT) will be marked complete in a separate commit by the orchestrator or a continuation agent once the user reports "UAT passed".

## Files Created/Modified

- **Created** `scripts/verify-pwa-build.mjs` (69 lines) — ESM node script. Uses `fs.existsSync` for exact filenames and `fs.readdirSync` + regex for the Workbox hash pattern. Prints matched artifacts on success; prints missing files + missing patterns on failure. Exit codes 0/1.
- **Created** `.planning/phases/04-performance-offline/04-UAT.md` (133 lines) — the human sign-off document. Per the plan spec (min 40 lines, must mention PERF-01..PERF-04 + "Add to Home Screen" + "Updated 90m ago" + "docs.google.com" — all present).
- **Modified** `package.json` (1 line) — `build` script now chains `node scripts/verify-pwa-build.mjs` after `vite build`. No other script touched.
- **Modified** `README.md` (+63 lines net) — replaced the old "Getting Started → Installation → Google Sheets Setup" block with Setup (4 steps), Development (8-script table), PWA behavior (6 bullets), and an updated Google Sheets Setup that references `.env.local` instead of editing `src/services/googleSheets.ts`. Preserved Tech Stack, Project Structure, Color Palette, Future Enhancements, and License sections verbatim.
- **Modified** `CLAUDE.md` (+8 lines) — populated the empty `## Scripts` heading with 8 bullet entries covering every npm script. Formatted as markdown dash-bullets to match the rest of the GSD:stack block.

## Decisions Made

- **Script over vitest integration test.** A presence-check script is simpler, faster (<50ms vs 30s+ for a rebuild), and catches the exact failure mode we care about: "the bundle emitted but PWA artifacts are missing". Byte-size assertions would be brittle (Workbox + Vite versions shift sizes). Matched the plan's RESEARCH.md §9c Option A exactly.
- **Order: tsc → vite build → verifier.** tsc errors and Vite bundle errors are more common than missing-artifact failures, so they surface first. The verifier is a safety net for the rarer silent-drop case (e.g., a bad `globPatterns` change in `vite.config.ts` that compiles fine but stops precaching).
- **README merge, not rewrite.** Preserved the project description, tech stack, project structure, color palette, future enhancements, and license. Replaced only the obsolete "edit `src/services/googleSheets.ts`" instruction with the new env-var flow. The Setup / Development / PWA behavior sections slot in between the existing Prerequisites and Google Sheets Setup.
- **CLAUDE.md Scripts lives inside a GSD-managed comment block** (`<!-- GSD:stack-start -->` … `<!-- GSD:stack-end -->`). Future `generate-claude-profile` runs may regenerate this block. Acceptable because the regeneration would include the live script list anyway — if the tool overwrites with a fresh list, the content stays accurate.
- **UAT blocking-set kept minimal.** Three items (offline badge, iOS A2HS, SW update toast). Each maps to a requirement automation cannot assert and each represents a failure mode that would materially break the wedding-day UX. Everything else (including Android install, Lighthouse audit) is recommended but non-blocking.

## Deviations from Plan

**None.** Tasks 1–3 executed exactly as specified in `04-06-PLAN.md`. No auto-fixes were required.

## Known Stubs

None.

## Threat Flags

None — this plan adds build-time verification, documentation, and a test checklist. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Open Items

- **Task 4 (human UAT).** `.planning/phases/04-performance-offline/04-UAT.md` authored and awaiting sign-off. The three BLOCKING items (PERF-01/1b offline, PERF-02/2a iOS A2HS, PERF-03/3b SW update flow) must pass before the phase is marked complete and `/gsd-verify-work` runs.
- **PERF-XX requirements.** Cannot be marked complete in `REQUIREMENTS.md` until the UAT reports pass. The frontmatter `requirements-awaiting-uat` field flags this explicitly.

## Self-Check: PASSED

Verified on 2026-04-17T17:34:36Z:
- `scripts/verify-pwa-build.mjs` — exists, 69 lines, passes its own smoke test on the current `dist/`.
- `package.json` — `build` script contains `verify-pwa-build.mjs`.
- `README.md` — contains `VITE_SHEET_URL` (2 occurrences) and `generate-pwa-icons`.
- `CLAUDE.md` — contains `generate-pwa-icons` and `verify-pwa-build`.
- `.planning/phases/04-performance-offline/04-UAT.md` — 133 lines, all required strings present (PERF-01..04, "Add to Home Screen", "Updated 90m ago", "docs.google.com").
- Commits verified in git log: `fbae7f3`, `2240927`, `fec25b0` all present on branch `dev`.
- Phase gate green: tsc exit 0, lint exit 0, vitest 37/37, build exit 0 with "PWA build verification passed."
