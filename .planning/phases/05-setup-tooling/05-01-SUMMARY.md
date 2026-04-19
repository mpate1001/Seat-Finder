---
phase: 05-setup-tooling
plan: 01
subsystem: infra
tags: [route-split, react-lazy, suspense, code-splitting, strictmode, TOOL-03]

# Dependency graph
requires:
  - phase: 04-performance-offline
    provides: "Vitest + jsdom + @testing-library conventions, eslint flat config, vite-plugin-pwa baseline"
provides:
  - "Pathname-dispatch Root component routing / -> <App/> and /setup -> <SetupApp/> via React.lazy + Suspense"
  - "src/setup/ directory as the code-split boundary for plans 05-02..05-06 (OpenCV, Tesseract, detection, review, export all live inside this tree)"
  - "Separate Rollup chunk for SetupApp proven (dist/assets/SetupApp-*.js + SetupApp-*.css emitted independently of guest index chunk)"
  - "Static-import invariant locked by unit tests (D-01): only src/Root.tsx is allowed to reference ./setup/, and only through lazy(() => import(...))"
  - "renderRootAt(pathname) helper exported from src/main.test.tsx for downstream path-variant tests"
affects: [05-02-opencv-wasm, 05-03-file-upload, 05-04-detection-pipeline, 05-05-review-ui, 05-06-export, 05-07-bundle-verification]

# Tech tracking
tech-stack:
  added: ["@types/node (wired into tsconfig types[] — package was already a devDep)"]
  patterns:
    - "Pathname dispatch with React.lazy — no router library, single read of window.location.pathname at render time, reload-to-navigate"
    - "Thin main.tsx entry shim + extracted Root dispatcher — tests mount <Root/> directly without executing createRoot(#root) under jsdom"
    - "Setup-directory barrel (src/setup/index.ts) re-exports default for optional import('./setup') resolution"

key-files:
  created:
    - "src/Root.tsx — pathname dispatcher with lazy setup edge"
    - "src/setup/SetupApp.tsx — default-exported shell with D-04 subtitle + placeholder upload button"
    - "src/setup/SetupApp.css — .setup- prefixed styles (plain #edf2f4 bg, no wedding imagery)"
    - "src/setup/index.ts — barrel re-exporting default"
    - "src/main.test.tsx — 4 specs locking dispatch + static-import invariants"
  modified:
    - "src/main.tsx — reduced to 10-line entry shim (StrictMode + createRoot + <Root/>)"
    - "eslint.config.js — .claude/** added to ignores (stale agent worktrees)"
    - "vitest.config.ts — exclude: ['**/node_modules/**', '**/dist/**', '.claude/**']"
    - "tsconfig.json — types: ['vite/client', 'node'] so tests can use node:fs/node:path/__dirname"

key-decisions:
  - "Plan was pre-revised during plan-check to extract Root.tsx from main.tsx. Execution honored that — tests import Root directly and never trigger createRoot(#root) under jsdom."
  - "Added 'node' to tsconfig.json types[] (not a separate tsconfig.test.json) because only src/main.test.tsx needs node APIs and @types/node was already a devDep. Minimal disruption."
  - "Stale agent worktrees under .claude/worktrees/ produced both lint and vitest failures on their own copied source. Added .claude/** to ignores of both tools as a Rule 3 blocking-issue fix."
  - "Suspense fallback copy uses ASCII three-dot ellipsis ('Loading setup tool...') not Unicode …, matching the plan's pre-check that bundler-sensitive characters should not leak into chunk matching."

patterns-established:
  - "Route-split via React.lazy: the ONLY guest->setup edge is lazy(() => import('./setup/SetupApp')) inside Root.tsx. Every subsequent Phase 5 plan operates entirely inside src/setup/ and must never be statically imported from guest files. Plan 05-07 enforces with a dist/assets grep gate."
  - "Entry-shim + Root dispatcher: keeps main.tsx free of component bodies so jsdom tests can mount Root without mocking document.getElementById('root')."
  - "Setup shell conventions: .setup-* CSS prefix; utility-palette (#edf2f4 bg, no wedding imagery); declarative-only (no useEffect in the shell) so heavy init lands behind user gestures in later plans."

requirements-completed: [TOOL-03]

# Metrics
duration: 5min
completed: 2026-04-17
---

# Phase 5 Plan 1: Route-Split Setup Tool Scaffold Summary

**Pathname-dispatch Root.tsx + React.lazy(() => import('./setup/SetupApp')) Suspense boundary that produces a separate Rollup chunk for the admin shell, locking the TOOL-03 code-split invariant before OpenCV/Tesseract land in later plans.**

## Performance

- **Duration:** ~5 min (293 s)
- **Started:** 2026-04-17T21:05:24Z
- **Completed:** 2026-04-17T21:10:17Z
- **Tasks:** 3
- **Files created:** 5
- **Files modified:** 4
- **Commits:** 3 (one per task)

## Accomplishments

- Extracted a `Root.tsx` dispatcher that reads `window.location.pathname` exactly once (D-02, no listener) and branches to guest `<App />` on `/` or a `<Suspense>`-wrapped lazy `<SetupApp />` on `/setup`.
- Reduced `src/main.tsx` to a pure 10-line entry shim (`StrictMode + createRoot + <Root/>`) so tests can mount the dispatcher directly without jsdom tripping on `createRoot(document.getElementById('root')!)`.
- Created the `src/setup/` directory boundary (`SetupApp.tsx`, `SetupApp.css`, `index.ts` barrel) with the D-04 route-obscurity subtitle and a disabled placeholder upload button — the shell is declarative-only (no `useEffect`, no side effects) so StrictMode double-invoke cannot race any init work in later plans.
- Added 4 vitest specs in `src/main.test.tsx` locking the dispatch contract: `/` renders guest app (no "Setup tool" heading), `/setup` renders the Suspense fallback (the deterministic observable under jsdom since the lazy chunk never resolves synchronously), plus two on-disk regex guards verifying no static `./setup/*` imports leak into `src/main.tsx` or `src/Root.tsx`.
- Production build confirms code-splitting works: Rollup emits `dist/assets/SetupApp-BZ_kR2JB.css` (1.17 KB) and `dist/assets/SetupApp-DaoF8dcd.js` (0.62 KB) as separate chunks from the guest `index-*.js` (223.51 KB). The TOOL-03 scaffold is proven.
- Zero imports of `@techstark/opencv-js` or `tesseract.js` anywhere in this plan's files — those land in 05-02..05-04 behind further lazy-init inside user-gesture handlers.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add `src/setup/SetupApp.{tsx,css}` + `src/setup/index.ts` barrel** — `194ac0e` (feat)
2. **Task 2: Extract `src/Root.tsx` + rewrite `src/main.tsx` as thin entry shim** — `a61f45c` (feat; includes Rule 3 eslint ignore fix)
3. **Task 3: Add `src/main.test.tsx` locking the dispatch contract** — `bd00656` (test; includes Rule 3 vitest + tsconfig fixes)

Plan metadata commit is recorded separately at the end of this summary (includes `SUMMARY.md`, `STATE.md`, `ROADMAP.md`).

## Files Created/Modified

### Created

- `src/Root.tsx` — Default-exported `Root()` component. Reads `window.location.pathname` at render, branches to `<App />` or `<Suspense><SetupApp /></Suspense>`. Holds the single allowed `lazy(() => import('./setup/SetupApp'))` edge.
- `src/setup/SetupApp.tsx` — Default export `SetupApp()`. `<h1>Setup tool</h1>`, D-04 subtitle copy, disabled placeholder `Upload floor plan` button, short help paragraph. No `useEffect`; no side-effect state writes at module scope.
- `src/setup/SetupApp.css` — `.setup-*` prefixed styles. Plain `#edf2f4` background (utility, not ceremony — intentionally skips the wedding hero image). Mirrors Seat-Finder palette: `#2b2d42` navy, `#ef233c` accent, 10 px / 20 px radii, system font stack. Includes `.setup-loading` for the Suspense fallback.
- `src/setup/index.ts` — `export { default } from './SetupApp';` barrel so `import('./setup')` also resolves.
- `src/main.test.tsx` — 4 vitest specs + exported `renderRootAt(pathname)` helper. Uses `Object.defineProperty(window, 'location', ...)` to stub pathname; regex-guards `src/main.tsx` and `src/Root.tsx` on disk via `readFileSync`.

### Modified

- `src/main.tsx` — Reduced from "StrictMode wrapping `<App/>` directly" to "StrictMode wrapping `<Root/>`". 10 lines total, no component body.
- `eslint.config.js` — Added `.claude/**` to the top-level ignores block.
- `vitest.config.ts` — Added explicit `test.exclude: ['**/node_modules/**', '**/dist/**', '.claude/**']` (vitest default exclude covers node_modules/dist but not `.claude`).
- `tsconfig.json` — `types: ['vite/client']` → `types: ['vite/client', 'node']` so the test can use `node:fs`, `node:path`, and `__dirname` without tripping the production `tsc` step of `npm run build`.

## Dispatch Contract (locked)

```tsx
// src/Root.tsx (load-bearing logic)
const SetupApp = lazy(() => import('./setup/SetupApp'));

export default function Root(): JSX.Element {
  const pathname = window.location.pathname;
  if (pathname === '/setup') {
    return (
      <Suspense fallback={<div className="setup-loading">Loading setup tool...</div>}>
        <SetupApp />
      </Suspense>
    );
  }
  return <App />;
}
```

- Pathname is read **once** at render — no listener, no `useEffect`, no `popstate`. Navigation is reload-based (D-02).
- The `lazy()` call lives at module scope so the Suspense boundary can mount it. This is the only allowed edge from the guest graph into the setup graph (D-01).
- StrictMode wraps `<Root />` in `main.tsx`, so double-invoke of the dispatcher is expected and safe (no effects to race).

## Build Output (TOOL-03 verification)

`VITE_SHEET_URL=... npm run build` emits (abbreviated):

```
dist/assets/SetupApp-BZ_kR2JB.css    1.17 kB | gzip: 0.51 kB
dist/assets/SetupApp-DaoF8dcd.js     0.62 kB | gzip: 0.38 kB   <-- separate setup chunk
dist/assets/index-IBN15Kjo.css       8.64 kB | gzip: 2.48 kB
dist/assets/index-CeC1HRi3.js      223.51 kB | gzip: 72.98 kB  <-- guest chunk
```

`grep -l -E "opencv|tesseract" dist/assets/*.js` returns no matches (expected — those deps aren't installed yet; 05-07 hardens this check once they are).

## Decisions Made

- **Extract Root to a separate file (vs inline in `main.tsx`).** Inline would have forced `main.test.tsx` to mock `document.getElementById('root')` and deal with `createRoot` being invoked at module load under jsdom. Extraction is cleaner and was baked into the plan revision.
- **Use `node:fs` / `__dirname` in the test (vs Vite's `?raw` suffix).** `readFileSync` is the simplest path and matches how plan 05-07's bundle-grep gate will read `dist/assets/*.js` at verification time — the test and the CI gate use the same approach.
- **Add `node` to tsconfig types (vs creating a separate tsconfig.test.json).** Only one file needs node APIs, `@types/node` is already installed, and the production `tsc` step of `npm run build` must pass cleanly. Minimal surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] ESLint crashed on stale agent worktree**
- **Found during:** Task 2 (verifying `npm run lint` cleanly after Root extraction).
- **Issue:** `.claude/worktrees/agent-a7599039/` contains a copied checkout from a prior parallel-agent run. ESLint traversed it and reported 24 errors (`console`, `process`, `Buffer` not defined in `.mjs` files) — pre-existing, unrelated to this plan, but blocking `npm run lint` from reporting clean.
- **Fix:** Added `'.claude/**'` to the `ignores` block in `eslint.config.js`.
- **Files modified:** `eslint.config.js`.
- **Verification:** `npm run lint` now exits 0.
- **Committed in:** `a61f45c` (Task 2 commit).

**2. [Rule 3 — Blocking] Vitest crashed on stale agent worktree**
- **Found during:** Task 3 (running `npm test` full-suite to confirm no regressions).
- **Issue:** The same stale worktree ships its own nested `node_modules/react`. Vitest picked up tests inside it and every one threw `TypeError: Cannot read properties of null (reading 'useState')` because the nested React instance has a different internal dispatcher than the outer React the test runtime imported.
- **Fix:** Added `test.exclude: ['**/node_modules/**', '**/dist/**', '.claude/**']` to `vitest.config.ts` (restoring the default excludes and adding `.claude/**`).
- **Files modified:** `vitest.config.ts`.
- **Verification:** `npm test` — 9 files, 41 tests, all green.
- **Committed in:** `bd00656` (Task 3 commit).

**3. [Rule 3 — Blocking] Production `tsc` rejected node:fs / node:path / __dirname**
- **Found during:** Task 3 (running `npm run build` — the plan's verification step requires it to succeed).
- **Issue:** `src/main.test.tsx` uses `readFileSync` from `node:fs` + `__dirname` to regex-guard the on-disk shape of `main.tsx` and `Root.tsx`. Without node types in scope, `tsc` raised TS2307 + TS2304 and failed the build chain (`tsc && vite build && verify-pwa-build`).
- **Fix:** Extended `tsconfig.json` `types` array from `['vite/client']` to `['vite/client', 'node']`. `@types/node@^22.19.17` was already a devDependency, so no install.
- **Files modified:** `tsconfig.json`.
- **Verification:** `npx tsc --noEmit` clean; `npm run build` completes with the expected separate SetupApp chunk.
- **Committed in:** `bd00656` (Task 3 commit).

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking).
**Impact on plan:** All three fixes were necessary for the plan's own verification steps to pass (`npm run lint`, `npm test`, `npm run build`). None changed product behavior. No scope creep. The two `.claude/**` excludes are defensive — they protect future agents from the same issue.

## Issues Encountered

- Hook infrastructure reported the first background build invocation as "exit code 0" even though the output showed TS2307/TS2304 errors. Reading the output file directly revealed the failure. Resolved by explicit `cat` of the log file rather than trusting the hook summary. No code impact.

## Notes for Subsequent Plans

- **05-02 (OpenCV wasm load)**: Add the dep, import it ONLY from a file under `src/setup/` that is reached from `SetupApp.tsx`'s handler tree (not from module scope — see Pitfall 3). The existing `.setup-` namespace keeps any OpenCV canvas styles off the guest surface.
- **05-03..05-06**: The `src/setup/` directory is the single boundary. Any new file should live under it. `src/setup/index.ts` is a minimal barrel; extend it only if a new entry point needs default-export resolution.
- **05-07 (bundle-verification)**: The grep-over-`dist/assets/*.js` gate promised by D-03 can reuse the approach already pre-exercised in this plan. When opencv/tesseract are installed, 05-07 should add the grep gate to `scripts/verify-pwa-build.mjs` (or a sibling) so `npm run build` fails if either string appears in the guest chunk.
- **Dev server / SPA fallback**: Vite's default dev server handles `/setup` through its index fallback without any config change. No `vite.config.ts` edit was needed here (as the plan anticipated).

## Next Plan Readiness

- `src/setup/` directory is the locked boundary for all subsequent Phase 5 work.
- Dispatch contract + separate Rollup chunk are both proven and unit-test locked.
- Placeholder `Upload floor plan` button is visible and disabled; plan 05-05 will wire its `onClick` through `<FileDrop/>` without changing the surrounding shell markup.

## Self-Check: PASSED

Verified after SUMMARY creation:
- `src/Root.tsx` — FOUND (default export `Root`, line 23).
- `src/setup/SetupApp.tsx`, `SetupApp.css`, `index.ts` — FOUND.
- `src/main.test.tsx` — FOUND (4 passing specs).
- `src/main.tsx` — MODIFIED (10-line entry shim, no component body).
- `eslint.config.js`, `vitest.config.ts`, `tsconfig.json` — MODIFIED (deviation fixes).
- Commits `194ac0e`, `a61f45c`, `bd00656` — ALL present in `git log --oneline`.
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm test` — 41/41 green.
- `npm run build` — emits separate SetupApp chunk; `grep opencv|tesseract dist/assets/*.js` — no matches.

---

*Phase: 05-setup-tooling*
*Completed: 2026-04-17*
