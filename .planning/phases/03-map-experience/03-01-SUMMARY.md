---
phase: 03-map-experience
plan: 01
subsystem: infrastructure
tags: [vitest, testing-library, jsdom, sharp, react-zoom-pan-pinch, npm, dependencies]

requires:
  - phase: 01-data-integrity
    provides: percentage-based floorPlan.json coords that Phase 3 pan/zoom math will consume
  - phase: 02-fuzzy-search
    provides: guest selection flow (GuestDropdown onSelect → App.selectedGuest) that Phase 3 MapView will consume
provides:
  - react-zoom-pan-pinch@4.0.3 runtime dep installed and pinned exact
  - sharp devDep installed for one-time image variant generation (used by plan 03-02)
  - vitest 4.1 + @testing-library/react + @testing-library/user-event + @testing-library/jest-dom + jsdom installed
  - @types/node devDep installed (needed by vitest.config.ts defineConfig + future script typings)
  - vitest.config.ts with jsdom env, globals: true, setupFiles → src/test/setup.ts
  - src/test/setup.ts loading @testing-library/jest-dom matchers globally
  - src/components/MapView.test.tsx test stub file with 4 it.todo entries (titles match 03-VALIDATION.md Per-Task Verification Map)
  - src/App.test.tsx test stub file with 1 it.todo entry (preload link injected on mount)
  - npm scripts: test (vitest run), test:watch (vitest), generate-images (node scripts/generate-images.mjs)
affects: [03-02-PLAN, 03-03-PLAN, 03-04-PLAN, 03-05-PLAN, phase-4, phase-5]

tech-stack:
  added:
    - react-zoom-pan-pinch@4.0.3 (runtime)
    - vitest ^4.1.4 (devDep)
    - "@testing-library/react ^16.3.2"
    - "@testing-library/user-event ^14.6.1"
    - "@testing-library/jest-dom ^6.9.1"
    - jsdom ^26.1.0
    - "@types/node ^22.19.17"
    - sharp ^0.34.5
  patterns:
    - "vitest globals: true — avoids every test file re-importing describe/it/expect"
    - "explicit 'import { describe, it } from vitest' in test stubs — avoids tsconfig.types change"
    - "vitest.config.ts shape mirrors vite.config.ts (same defineConfig + plugins pattern) for familiarity"
    - "jest-dom matchers loaded once globally via setupFiles (standard React testing recipe)"

key-files:
  created:
    - vitest.config.ts
    - src/test/setup.ts
    - src/components/MapView.test.tsx
    - src/App.test.tsx
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "react-zoom-pan-pinch pinned exact at 4.0.3 (not ^4.0.3) to match must_haves.truths and lock downstream plan behavior"
  - "Used explicit vitest named imports (import { describe, it }) instead of tsconfig types: ['vitest/globals'] — keeps tsconfig.json untouched"
  - "Did not run 'npm audit fix' despite reported vulnerabilities — out of scope for this plan (plan-level boundary), logging to deferred items"
  - "Did not touch tsconfig.json — executor is non-invasive to existing type settings"

patterns-established:
  - "Test stub pattern: it.todo with verbatim titles from 03-VALIDATION.md Per-Task Verification Map enables downstream plans to flip todo→real with no rename"
  - "Foundation-plan pattern: scaffolding plan pins exact versions for critical runtime libs; dev libs remain caret-ranged"

requirements-completed: []

duration: 2min
completed: 2026-04-17
---

# Phase 3 Plan 01: Foundation — Testing + Runtime Dependencies Summary

**Installed react-zoom-pan-pinch@4.0.3 + sharp + vitest/testing-library/jsdom stack; scaffolded vitest.config.ts + jest-dom setup + 5 it.todo test stubs so plans 02–05 can author TypeScript imports and automated verify commands with zero discovery friction.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T13:47:07Z
- **Completed:** 2026-04-17T13:49:04Z
- **Tasks:** 2 / 2
- **Files created:** 4
- **Files modified:** 2

## Accomplishments
- Runtime pan/zoom library (react-zoom-pan-pinch@4.0.3) installed and pinned — plans 03-03/04/05 can now `import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'` without TypeScript errors.
- Image-pipeline devDep (sharp@^0.34.5) installed — plan 03-02 can now run `scripts/generate-images.mjs`.
- Full vitest + @testing-library stack installed and configured; `npx vitest run` exits 0 with 5 `todo` entries reported as skipped (not failures).
- Test stub files present at the exact paths referenced in `03-VALIDATION.md` `## Per-Task Verification Map`, with test titles matching the `-t` arguments downstream plans will run. No rename churn needed when plans flip `it.todo` → real `it(...)`.
- npm scripts `test`, `test:watch`, `generate-images` wired in — addressable via `npm run test`, `npm run test:watch`, `npm run generate-images`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install runtime + dev dependencies and add npm scripts** — `0876c46` (chore)
2. **Task 2: Create vitest config, jest-dom setup, and test stub files** — `dd65fcc` (test)

_Plan metadata commit will be recorded after STATE/ROADMAP updates._

## Files Created/Modified

### Created
- `vitest.config.ts` — Vitest configuration: jsdom environment, `globals: true`, `setupFiles: ['./src/test/setup.ts']`. Shape mirrors `vite.config.ts`.
- `src/test/setup.ts` — One-line jest-dom matchers bootstrap (`import '@testing-library/jest-dom';`).
- `src/components/MapView.test.tsx` — Test stub with 4 `it.todo` entries covering MAP-01 (zooms to assigned table, overview hold), fallback branch (missing tableNumber), and MAP-05 (picture element sources).
- `src/App.test.tsx` — Test stub with 1 `it.todo` entry for the MAP-05 preload link behavior.

### Modified
- `package.json` — Added `react-zoom-pan-pinch` (pinned `4.0.3` exact); added devDeps `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `@types/node`, `sharp`; added scripts `test`, `test:watch`, `generate-images`; preserved existing `dev`, `build`, `preview`, `lint` scripts exactly.
- `package-lock.json` — Regenerated by npm for the 92 new packages (+transitive closure).

## Decisions Made

- **Pin `react-zoom-pan-pinch` exact at `4.0.3`** (not `^4.0.3`): The plan's `must_haves.truths` specifies the pinned string `"react-zoom-pan-pinch": "4.0.3"`. npm defaults to `^` prefix, so we edited the manifest post-install to match. Rationale: this library's `zoomToElement` API is load-bearing for MAP-01; a future minor bump that changes animation internals would be detected immediately by pinning.
- **Keep dev deps caret-ranged** (`^4.1.4`, `^16.3.2`, etc.): Testing libraries get frequent patch bumps; caret allows npm to pick up non-breaking fixes without plan rework. Plan-checker-approved `must_haves.truths` specifies `^4.` / `^16.` pattern only (not exact).
- **Explicit vitest imports in test stubs** (`import { describe, it } from 'vitest'`): Works alongside `globals: true` (vitest supports both). Chosen over adding `types: ["vitest/globals"]` to tsconfig.json because the plan's Task 2 action explicitly says "Do NOT add TypeScript `types: [\"vitest/globals\"]` to tsconfig.json". Keeps existing tsconfig unchanged.
- **No tsconfig.json changes**: Plan action forbade it; verified tsconfig.json untouched after plan completion.
- **Did not run `npm audit fix`**: npm reports 7 vulnerabilities (2 moderate, 5 high) in the updated lockfile. Running audit fix here would (a) be out of this plan's scope, (b) potentially change pinned versions behind our back, and (c) not block any downstream plan. Flagged to deferred items — see below.

## Patterns Established

- **Foundation-plan pattern for dependency scaffolding**: A "wave 0" plan that only installs deps + creates empty stubs + adds scripts, with zero application-logic changes. Downstream plans become linear since every TypeScript import resolves and every validation command is addressable.
- **Test-stub titles = validation-map titles**: Every `it.todo(...)` title in `src/components/MapView.test.tsx` and `src/App.test.tsx` matches verbatim the `-t "..."` argument in `.planning/phases/03-map-experience/03-VALIDATION.md` Per-Task Verification Map. Flipping `it.todo` → real `it(...)` in downstream plans requires zero rename.

## Deviations from Plan

None — plan executed exactly as written.

_Minor mechanical adjustment:_ `npm install` wrote `"react-zoom-pan-pinch": "^4.0.3"` by default; edited to exact `"4.0.3"` to match the plan's `must_haves.truths` and acceptance criteria grep. This is the plan's expected behavior (the acceptance grep forced exact), not a deviation.

## Issues Encountered

- **npm reported 7 vulnerabilities** (2 moderate, 5 high) in the updated lockfile. Not blocking (the dev/test stack surfaces these in transitive deps — not in app runtime code). Out of scope for this plan. Flagged as deferred item for a future security audit plan.

## User Setup Required

None — all changes are local npm installs and in-repo files. No external service configuration.

## Next Phase Readiness

- **Plan 03-02 (generate images)**: Unblocked. `sharp@^0.34.5` is in `node_modules`; `npm run generate-images` resolves to the script path the plan will create.
- **Plan 03-03 (MapView overlay + zoom)**: Unblocked. `react-zoom-pan-pinch` types resolve; `src/components/MapView.test.tsx` is ready to receive real assertions for `"zooms to assigned table"` and `"overview hold before zoom"`.
- **Plan 03-04 (FloorPlan + picture element)**: Unblocked. `"picture element has avif + webp + png sources"` stub is ready to be flipped to a real DOM assertion.
- **Plan 03-05 (App.tsx wiring + preload)**: Unblocked. `"preload link injected on mount"` stub is ready.
- **Verification gate**: `npm run test` exits 0 with 5 todo; CI-style gate is green from plan 03-01 onward.

**Deferred items** (not blocking phase completion):
- npm audit vulnerabilities (7 in lockfile, mostly transitive jsdom deps) — flag for a security pass later.

## Self-Check

- [x] `vitest.config.ts` exists
- [x] `src/test/setup.ts` exists
- [x] `src/components/MapView.test.tsx` exists
- [x] `src/App.test.tsx` exists
- [x] Commit `0876c46` exists in git log (Task 1)
- [x] Commit `dd65fcc` exists in git log (Task 2)
- [x] `npx vitest run` exits 0 with 5 todo tests
- [x] `react-zoom-pan-pinch` pinned exact at `4.0.3`
- [x] All 7 devDeps present
- [x] All 3 new npm scripts addressable

## Self-Check: PASSED

---
*Phase: 03-map-experience*
*Completed: 2026-04-17*
