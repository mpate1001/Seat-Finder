---
phase: 04-performance-offline
plan: 01
subsystem: infra
tags: [env, vite, config, fail-fast, PERF-04]

requires:
  - phase: 03-map-experience
    provides: "src/services/googleSheets.ts fetchGuests() baseline; src/test/setup.ts + vitest.config.ts infrastructure (matchMedia polyfill, jsdom, @testing-library/jest-dom)"
provides:
  - "VITE_SHEET_URL as single source of truth for Google Sheets CSV URL (D-17)"
  - "Module-load fail-fast guard in googleSheets.ts with actionable error message (D-18)"
  - "Build-time Vite plugin that aborts production build when env var is missing"
  - "parseGuestsCsv named export for plan 04-02 cache wrapper reuse"
  - "ImportMetaEnv type augmentation typing VITE_SHEET_URL as readonly string"
affects: [04-02-swr-cache, 04-03-sw-precache, 04-04-workbox-runtime, 04-05-pwa-manifest, 04-06-uat]

tech-stack:
  added: []  # No new deps -- used existing vite + @vitejs/plugin-react APIs
  patterns:
    - "Env-driven config via import.meta.env.VITE_* with .env.local (gitignored) + .env.example (committed)"
    - "Defense-in-depth fail-fast: module-load guard (runtime) + vite configResolved plugin (build)"
    - "Cache-busting dynamic imports in vitest via query-string suffix + @vite-ignore comment + typeof cast"
    - "Pure-function CSV parser extracted from I/O wrapper for reuse (parseGuestsCsv vs fetchGuests)"

key-files:
  created:
    - ".env.example"
    - ".env.local"
    - "src/services/googleSheets.test.ts"
  modified:
    - "src/services/googleSheets.ts"
    - "src/vite-env.d.ts"
    - "vite.config.ts"
    - ".gitignore"

key-decisions:
  - "Typed ImportMetaEnv.VITE_SHEET_URL as `readonly string` (not `string | undefined`) -- module-load guard converts runtime reality into 'valid string or hard throw before any consumer runs'"
  - "Plugin hooks into configResolved (not config) because env files are only loaded by the time configResolved fires"
  - "Guard only when config.command === 'build' -- dev/test use .env.local via import.meta.env without setting process.env"
  - "freshImport() helper uses @vite-ignore + runtime-built spec + typeof cast to let Vitest cache-bust per-test while keeping tsc strict-mode clean"

patterns-established:
  - "Env var plumbing: .env.example documents vars with empty values; .env.local holds secrets and is gitignored via explicit + wildcard *.local rules"
  - "Service module fail-fast: assign env var to typed const at module top; throw inline if falsy; downstream code treats value as non-nullable"
  - "Vite build-time guards: inline Plugin factory function using ResolvedConfig type -- avoids loose structural typing that breaks strict: true"

requirements-completed: [PERF-04]

duration: 4min
completed: 2026-04-17
---

# Phase 4 Plan 01: VITE_SHEET_URL Env Var Plumbing Summary

**Hard-coded Google Sheets URL replaced with VITE_SHEET_URL env var (D-17), with defense-in-depth fail-fast at module load + vite build; parseGuestsCsv extracted as named export for plan 04-02 cache wrapper reuse.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-17T16:58:14Z
- **Completed:** 2026-04-17T17:02:13Z
- **Tasks:** 3
- **Files modified:** 7 (3 created: .env.example, .env.local, googleSheets.test.ts; 4 modified: googleSheets.ts, vite-env.d.ts, vite.config.ts, .gitignore)

## Accomplishments

- **PERF-04 delivered:** `VITE_SHEET_URL` is the single source of truth. Hard-coded URL on old line 3 of `src/services/googleSheets.ts` is gone; audit trail preserved in `.env.local` (gitignored, byte-for-byte identical).
- **Fail-fast at two layers:** module-load guard in `googleSheets.ts` throws "VITE_SHEET_URL is not set. Copy .env.example to .env.local..." immediately when the service is imported without the env var. The `requireSheetUrl` Vite plugin throws before bundling starts if `process.env.VITE_SHEET_URL` is missing during `vite build` -- converts a runtime failure into a CI-gating error.
- **parseGuestsCsv exported:** The 40-line CSV parser logic is now a pure function named-exported from `googleSheets.ts`. Plan 04-02's `guestsCache.ts` can `import { parseGuestsCsv, SHEET_URL } from './googleSheets'` without duplicating the escape-quote handling.
- **Type-safe env access:** `ImportMetaEnv` interface augmentation in `src/vite-env.d.ts` declares `readonly VITE_SHEET_URL: string`, so consumers get `string` (not `any`) without narrowing.
- **6 new unit tests passing:** 4 for `parseGuestsCsv` (valid, quoted-comma escape, missing columns, header reorder) + 2 for the module-load guard (empty env throws; set env loads).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add env var plumbing (.env.example, .env.local, .gitignore, vite-env.d.ts)** - `92d64ff` (feat)
2. **Task 2 RED: Failing tests for parseGuestsCsv + env guard** - `0e7f94a` (test)
2. **Task 2 GREEN: Refactor googleSheets.ts + extract parseGuestsCsv** - `b226b7e` (feat)
3. **Task 3: requireSheetUrl Vite plugin for build-time guard** - `ce75b72` (feat)

_Task 2 used TDD: RED commit proves tests fail against old API, GREEN commit implements._

## Files Created/Modified

- **Created** `.env.example` - Documents `VITE_SHEET_URL=` with empty value (intentional -- forces guard on clean clone)
- **Created** `.env.local` - Holds the production Google Sheets CSV URL (gitignored)
- **Created** `src/services/googleSheets.test.ts` - 6 Vitest cases covering parser + guard
- **Modified** `src/services/googleSheets.ts` - Env-driven `SHEET_URL` const + inline throw guard + named `parseGuestsCsv` export + simplified `fetchGuests` delegates
- **Modified** `src/vite-env.d.ts` - Added `ImportMetaEnv` / `ImportMeta` interfaces typing `VITE_SHEET_URL` as readonly string (asset-module declarations preserved)
- **Modified** `vite.config.ts` - Added `requireSheetUrl()` plugin using `Plugin` + `ResolvedConfig` types from `vite`
- **Modified** `.gitignore` - Added explicit `.env`, `.env.local`, `.env.*.local` entries (belt-and-suspenders over the pre-existing `*.local` glob)

## Decisions Made

- **ImportMetaEnv typed as `readonly string` not `string | undefined`:** The module-load guard crashes the module if the value is falsy, so by the time anything imports the module the type-level assumption holds. Downstream code treats it as plain `string`.
- **`configResolved` hook, not `config`:** Vite loads `.env*` files between `config` and `configResolved`. Throwing in `configResolved` means the plugin sees the effective env state. (This is the D-18 research pitfall flagged in 04-RESEARCH.md §8.)
- **Guard scoped to `config.command === 'build'`:** Dev server and Vitest read `import.meta.env` from `.env.local` without populating `process.env`. Enforcing on the build command only covers the "ship a broken bundle" failure mode without false-positive on local dev.
- **`freshImport()` helper pattern for cache-bust:** The plan specified `await import('./googleSheets?guard-empty')` literal. TypeScript's strict: true cannot resolve query-suffixed specifiers. Fix: runtime-construct the spec, annotate with `/* @vite-ignore */`, cast the return to `typeof import('./googleSheets')`. Cleaner than adding ambient module declarations that TS rejects with TS2664.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dynamic import specifier TS2307 under strict tsc**
- **Found during:** Task 2 GREEN (after rewriting googleSheets.ts, tsc failed on the test file)
- **Issue:** The plan specified tests use `await import('./googleSheets?guard-empty')` and `?guard-ok` to force Vitest to re-evaluate the module per-test (so the module-load guard fires each call). TypeScript under `strict: true` + `moduleResolution: bundler` rejects query-suffixed specifiers with TS2307 "Cannot find module". First attempted fix (ambient `declare module './googleSheets?guard-empty' { export * from './googleSheets'; }`) also failed with TS2664 "Invalid module name in augmentation, module cannot be found" because TS validates the augmentation target resolves.
- **Fix:** Added a `freshImport(tag)` helper that (a) builds the spec at runtime via template literal, (b) uses `/* @vite-ignore */` comment so Vite keeps the literal intact through bundling, and (c) casts the inferred `Promise<unknown>` to `Promise<typeof import('./googleSheets')>`. This keeps the Vitest cache-bust behavior intact while bypassing TS static-resolution.
- **Files modified:** `src/services/googleSheets.test.ts`
- **Verification:** `npx tsc --noEmit` clean; `npx vitest run` all 13 tests pass (6 for googleSheets + 7 pre-existing from phase 3).
- **Committed in:** `b226b7e` (GREEN commit, same as the service rewrite)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix preserved the plan's intent (per-test module cache-bust) while satisfying strict tsc gate. No behavior change, just a typing-layer adapter.

## Issues Encountered

- None substantive. The TDD cycle went RED (6 failing tests) -> GREEN (13 passing) -> refactor (none needed).

## Infrastructure Notes (from plan's output spec)

- **Exact URL preserved from old hard-coded string (for audit):** `https://docs.google.com/spreadsheets/d/e/2PACX-1vT2CjdXZd0XrE_Q9_BoNWhIqr69ElM60e7CgVvYSWIVA4QRs8CtVV-3UWqWaco9jk9iestkouEd_7en/pub?output=csv`. Now lives only in `.env.local` (gitignored). Verified byte-for-byte identical to pre-refactor line 3 of `src/services/googleSheets.ts` (copied directly, no re-encoding).
- **`vitest.config.ts` already existed** from Phase 3 with `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`. Task 2 Step A was a no-op (skip per plan instruction). `globals: true` (pre-existing) differs from the plan's suggested `globals: false` -- left unchanged since our tests use explicit `import { describe, it, ... } from 'vitest'` either way and changing it risks breaking phase 3 tests.
- **`src/test/setup.ts` already existed** from Phase 3 (matchMedia polyfill for prefers-reduced-motion). Left unchanged as our tests need no new global setup.
- **TS strictness surprise (documented above):** Query-suffixed dynamic imports are not expressible in the TypeScript type system without the `@vite-ignore` + runtime-construct pattern. Documented as a reusable pattern for future phases that need per-test module re-evaluation.
- **`.gitignore` note:** Pre-existing `*.local` pattern on line 13 already ignores `.env.local` transitively. Added explicit `.env`, `.env.local`, `.env.*.local` entries below for clarity + to preserve signal if anyone ever removes the generic `*.local` glob.

## Known Stubs

None. All code paths are wired to real data sources. The `VITE_SHEET_URL=` entry in `.env.example` is empty **by design** (per plan D-18 "no silent fallback") -- it is not a stub; it is a forcing function that ensures any new contributor fails loudly until they populate `.env.local`.

## Next Plan Readiness

- **Plan 04-02 (SWR cache wrapper)** can now `import { parseGuestsCsv, SHEET_URL } from './googleSheets'` without duplication. The named exports are tested and stable.
- **Plan 04-05 (PWA manifest via vite-plugin-pwa)** will extend `vite.config.ts` plugins array -- current shape `[react(), requireSheetUrl()]` is ready for a third plugin (append, don't replace).
- **No blockers.**

## Self-Check: PASSED

File existence:
- FOUND: .env.example
- FOUND: .env.local
- FOUND: src/vite-env.d.ts
- FOUND: src/services/googleSheets.ts
- FOUND: src/services/googleSheets.test.ts
- FOUND: vite.config.ts

Commits:
- FOUND: 92d64ff (Task 1 env plumbing)
- FOUND: 0e7f94a (Task 2 RED)
- FOUND: b226b7e (Task 2 GREEN)
- FOUND: ce75b72 (Task 3 Vite plugin)

Gates:
- tsc --noEmit: clean
- npm run lint: clean (exit 0)
- npx vitest run: 3 files, 13 tests passed
- VITE_SHEET_URL unset + vite build: throws expected error (exit non-zero) -- verified
- VITE_SHEET_URL set + npm run build: succeeds -- verified (dist/ emitted)

---
*Phase: 04-performance-offline*
*Completed: 2026-04-17*
