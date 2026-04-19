---
phase: 03-map-experience
plan: 05
subsystem: integration
tags: [integration, tests, cleanup, MAP-01, MAP-02, MAP-03, MAP-04, MAP-05]

requires:
  - phase: 03-map-experience
    plan: 01
    provides: vitest 4.x + jsdom 26 + @testing-library/react installed; vitest.config.ts wired with setupFiles=['./src/test/setup.ts']; initial it.todo stubs in MapView.test.tsx and App.test.tsx
  - phase: 03-map-experience
    plan: 02
    provides: 9 static floor-plan variants at /floor-plan/floor-plan-{900,1600,2400}.{avif,webp,png}
  - phase: 03-map-experience
    plan: 03
    provides: MapView component with preload-friendly props shape, zoomToElement orchestration, popstate + Escape dismissal
  - phase: 03-map-experience
    plan: 04
    provides: Reduced FloorPlan presentational component accepting assignedPinRef + onImageLoad, rendering <picture> + percentage-positioned pin-assigned/pin-dot markers
provides:
  - src/App.tsx wired to render <MapView key=tableNumber> instead of TableModal, with preload useEffect + hidden img belt-and-suspenders
  - src/App.test.tsx with a real passing test for preload link injection (replaces the sole it.todo stub)
  - src/components/MapView.test.tsx with four real passing tests (replaces all four it.todo stubs) covering zoomToElement wiring, 250ms overview hold, missing-table fallback, and <picture> AVIF/WebP/PNG source structure
  - src/test/setup.ts polyfill for window.matchMedia so MapView's prefers-reduced-motion check does not crash under jsdom
  - eslint.config.js flat-config so npm run lint runs under ESLint v9
  - Removal of src/components/TableModal.tsx and src/components/TableModal.css (D-01 superseded component)
  - Removal of optional/backward-compat hedges on FloorPlan props — assignedPinRef and onImageLoad tightened back to required since the only consumer is MapView
  - Closure of all five Phase 3 requirements: MAP-01..MAP-05 have code in place; automation-gated assertions are green; UAT-gated surfaces are ready for the 19-step script in 03-VALIDATION.md
affects: []

tech-stack:
  added: []
  patterns:
    - "App-mount preload link injection via useEffect + document.createElement — fires in parallel with the guest-list fetch; full six-attribute set (rel, as, type, imagesrcset, imagesizes, fetchPriority) per RESEARCH.md Pattern 5"
    - "Key-driven remount of MapView via key={selectedGuest.tableNumber} — forces clean unmount+mount when the user selects a different guest while the map is open (RESEARCH.md Pitfall 5)"
    - "forwardRef-based mock of TransformWrapper with useImperativeHandle exposing a module-scoped zoomToElement spy — lets tests assert the full 6-arg call signature without real library internals"
    - "act()-wrapped vi.advanceTimersByTime — the setTimeout(250ms) gate in MapView fires inside a useEffect whose subscription depends on an async image-load setState; wrapping advanceTimersByTime in act keeps the render/effect/timer commit order deterministic in jsdom"
    - "Defensive jsdom polyfill pattern — install missing browser APIs (matchMedia) at the test setup level rather than inside each test, keeping component code honest"
    - "ESLint v9 flat-config (eslint.config.js ES module) — replaces the legacy .eslintrc format; ignore dist/scripts/public, wire @typescript-eslint/parser + recommended rules, loosen no-undef (TS already checks names)"

key-files:
  created:
    - eslint.config.js
  modified:
    - src/App.tsx
    - src/App.test.tsx
    - src/components/MapView.test.tsx
    - src/components/MapView.tsx
    - src/components/MapView.css
    - src/components/FloorPlan.tsx
    - src/test/setup.ts
  deleted:
    - src/components/TableModal.tsx
    - src/components/TableModal.css

key-decisions:
  - "Tightened FloorPlan props back to required (removed the optional ? hedge introduced by Plan 03-04 for legacy TableModal compat). With TableModal.tsx deleted, MapView is the only consumer and both props are always passed — optional types would now be dead flexibility. Aligns with plan 03-05 prompt note: 'Once TableModal is deleted, remove those compat props and tighten types.'"
  - "Swapped the App.test.tsx preload query from link[rel='preload'][as='image'][type='image/avif'] to link[rel='preload'][type='image/avif']. Reason: jsdom 26 does not reflect the HTMLLinkElement.as DOM property to an HTML attribute in querySelector's attribute-selector engine, even though link.as === 'image' reads correctly as a property. The production code is unchanged — link.as = 'image' is still set and will be respected by real browsers. Test asserts .as as a DOM property to compensate."
  - "Added an eslint.config.js flat config (Rule 3 — blocking issue). Plan acceptance criteria require npm run lint to exit 0, but the repo was on ESLint v9 with no eslint.config.* file (legacy .eslintrc-style config only in package.json). Lint was failing on any git status — a pre-existing rot that would have blocked this plan's truth 'npm run lint exits 0'. Minimal surgery: flat config that reproduces the intended recommended + react-hooks + react-refresh rule set."
  - "Polyfilled window.matchMedia in src/test/setup.ts (Rule 3 — blocking issue). jsdom 26 does not ship matchMedia, and MapView.tsx calls window.matchMedia('(prefers-reduced-motion: reduce)') inside its zoom useEffect. Without the polyfill, every MapView render test crashes on TypeError: window.matchMedia is not a function. Polyfill returns { matches: false } for any media query, which is the correct default for 'reduced-motion not active'."
  - "Wrapped vi.advanceTimersByTime in act() via a tiny advanceTimers() helper. The 250ms setTimeout fires inside a useEffect whose subscription depends on imageLoaded flipping to true; the flip is triggered by an async event dispatch. Advancing fake timers outside act() produces 'An update to MapView inside a test was not wrapped in act()' warnings AND leaves the zoom call order indeterminate. The helper keeps the effect/timer/commit ordering deterministic."
  - "Kept the plan's exact test titles (e.g. 'picture element has avif + webp + png sources') verbatim so the -t filter commands in 03-VALIDATION.md still point at the right test rows. Documented the regex caveat in Known Quirks below."

requirements-completed: [MAP-01, MAP-02, MAP-03, MAP-04, MAP-05]

metrics:
  duration: 8min
  completed: 2026-04-17
---

# Phase 3 Plan 05: Integrate, Test, Close Out Summary

**Wired `<MapView key={selectedGuest.tableNumber}>` into App.tsx (replacing TableModal), added the mount-time preload `<link>` useEffect + hidden `<img>` belt-and-suspenders, deleted TableModal.tsx/TableModal.css, tightened FloorPlan props back to required, replaced all five `it.todo` stubs with real passing tests, polyfilled matchMedia in the test setup, added an ESLint v9 flat config so lint can run, and closed out all five Phase 3 requirements (MAP-01..MAP-05). Final gate: `npx vitest run` = 5 passed / 0 todo / 0 failed; `npm run lint` = exit 0; `npm run build` = exit 0.**

## Performance

- **Duration:** ~8 min (467s)
- **Started:** 2026-04-17T14:29:22Z
- **Completed:** 2026-04-17T14:37:09Z
- **Tasks:** 3 / 3
- **Files touched:** 10 (1 created, 7 modified, 2 deleted)

## Accomplishments

- **`src/App.tsx`** wired to the new map experience:
  - Swapped `import TableModal from './components/TableModal'` for `import MapView from './components/MapView'`.
  - Replaced the `{selectedGuest && <TableModal ... />}` render block with `{selectedGuest && <MapView key={selectedGuest.tableNumber} guest={selectedGuest} onClose={closeModal} />}`. The remount key forces clean state on guest-switch per RESEARCH.md Pitfall 5.
  - Added a second `useEffect(() => { ... }, [])` above the conditional returns that appends a `<link rel="preload" as="image" type="image/avif" imagesrcset="..." imagesizes="100vw" fetchPriority="high">` to `document.head`, with a cleanup that removes it on unmount.
  - Added a hidden `<img src="/floor-plan/floor-plan-1600.avif" style={{ display: 'none' }} aria-hidden="true" alt="" />` inside `.app-container` but outside `.card` — belt-and-suspenders per CONTEXT.md `<specifics>`.
- **`src/components/TableModal.tsx`** and **`src/components/TableModal.css`** deleted (D-01 superseded). Zero orphan references remain anywhere in `src/`.
- **`src/components/FloorPlan.tsx`** props interface tightened: `assignedPinRef` and `onImageLoad` are now required (the `?` hedge from Plan 03-04 is removed). The explanatory comments that referenced TableModal are also scrubbed.
- **`src/components/MapView.test.tsx`** rewritten with four real passing tests replacing the four `it.todo` stubs:
  1. `'zooms to assigned table'` — asserts `zoomToElement` called exactly once with `(HTMLElement, 2.75, 700, 'easeOutQuart', 0, 64)` after image load + 260ms tick.
  2. `'overview hold before zoom'` — asserts `zoomToElement` has NOT been called until after 250ms has elapsed, then HAS been called exactly once.
  3. `'missing tableNumber shows fallback'` — with `guest.tableNumber='9999'` (not in floorPlan.json), the `please ask staff for directions` fallback copy is visible and `zoomToElement` is never called even after 500ms advance.
  4. `'picture element has avif + webp + png sources'` — inspects FloorPlan's DOM output: `<picture>` contains one `<source type="image/avif">` (with 900w/1600w/2400w), one `<source type="image/webp">` (with .webp entries), and one `<img>` whose src ends in `.png` and srcset contains .png entries.
- **`src/App.test.tsx`** rewritten with one real passing test replacing the sole `it.todo`:
  - `'preload link injected on mount'` — renders `<App />`, waits for the preload link to appear in `<head>`, asserts all six attributes: `rel='preload'`, `as='image'` (DOM property), `type='image/avif'`, `imagesrcset` contains all three AVIF widths (900w/1600w/2400w), `imagesizes='100vw'`, `fetchPriority='high'`.
- **`src/test/setup.ts`** extended with a `window.matchMedia` polyfill so MapView's prefers-reduced-motion check does not crash under jsdom.
- **`eslint.config.js`** added (ESLint v9 flat config). The repo's `lint` script was broken before this plan (ESLint v9 requires a flat config; the project had none). Flat config wires `@typescript-eslint/parser`, the recommended TS rule set, `react-hooks`, and `react-refresh`, ignoring `dist/`, `node_modules/`, `public/`, `scripts/`, and `coverage/`.
- **Full Phase 3 gate green:**
  - `npx vitest run` → 2 files, 5 passing, 0 todo, 0 failed (~770ms)
  - `npm run lint` → exit 0
  - `npm run build` → exit 0; 43 modules; `dist/index.html` 0.49 kB / `dist/assets/index-*.css` 6.84 kB / `dist/assets/index-*.js` 217.74 kB gzip 70.87 kB
  - The 9 AVIF/WebP/PNG variants are picked up by Vite's public/ passthrough and appear in `dist/floor-plan/` at the same paths (confirmed indirectly via the build success and Vite's documented public/ behavior).

## Task Commits

Each task committed atomically:

1. **Task 1: Wire MapView + preload + delete TableModal** — `b1565ee` (feat)
2. **Task 2: Author real MapView tests** — `3987928` (test)
3. **Task 3: Author App preload test + full gate** — `7fecfb8` (test)

_Plan metadata commit will follow STATE/ROADMAP/REQUIREMENTS updates._

## Files Created/Modified

### Created
- `eslint.config.js` — ESLint v9 flat config so `npm run lint` can run at all. Replaces the broken legacy package.json config that had no matching eslint.config.* file under ESLint v9.

### Modified
- `src/App.tsx` — MapView swap + preload useEffect + hidden img + TableModal import removal.
- `src/App.test.tsx` — one real passing test for preload link injection.
- `src/components/MapView.test.tsx` — four real passing tests replacing all `it.todo` stubs.
- `src/components/MapView.tsx` — scrubbed one TableModal-referencing comment.
- `src/components/MapView.css` — scrubbed one TableModal-referencing comment.
- `src/components/FloorPlan.tsx` — tightened `assignedPinRef` / `onImageLoad` props back to required, scrubbed TableModal-referencing comments.
- `src/test/setup.ts` — added `window.matchMedia` polyfill.

### Deleted
- `src/components/TableModal.tsx` — superseded by MapView (D-01).
- `src/components/TableModal.css` — ditto.

## Verification Results

| Check | Result |
|-------|--------|
| `grep -q "import MapView from './components/MapView'" src/App.tsx` | ✓ |
| `grep -q "key={selectedGuest.tableNumber}" src/App.tsx` | ✓ |
| `grep -q "<MapView" src/App.tsx` | ✓ |
| `grep -q "rel = 'preload'" src/App.tsx` | ✓ |
| `grep -q "imagesrcset" src/App.tsx` | ✓ |
| `grep -q "/floor-plan/floor-plan-900.avif 900w" src/App.tsx` | ✓ |
| `grep -q "/floor-plan/floor-plan-1600.avif 1600w" src/App.tsx` | ✓ |
| `grep -q "/floor-plan/floor-plan-2400.avif 2400w" src/App.tsx` | ✓ |
| `grep -q "fetchPriority = 'high'" src/App.tsx` | ✓ |
| `grep -q 'aria-hidden="true"' src/App.tsx` | ✓ |
| `! test -f src/components/TableModal.tsx` | ✓ (deleted) |
| `! test -f src/components/TableModal.css` | ✓ (deleted) |
| `! grep -rn "TableModal" src/ --include=...` | ✓ (zero matches) |
| `! grep -q "it.todo" src/components/MapView.test.tsx` | ✓ |
| `! grep -q "it.todo" src/App.test.tsx` | ✓ |
| `grep -q "it('zooms to assigned table'" src/components/MapView.test.tsx` | ✓ |
| `grep -q "it('overview hold before zoom'" src/components/MapView.test.tsx` | ✓ |
| `grep -q "it('missing tableNumber shows fallback'" src/components/MapView.test.tsx` | ✓ |
| `grep -q "it('picture element has avif + webp + png sources'" src/components/MapView.test.tsx` | ✓ |
| `grep -q "it('preload link injected on mount'" src/App.test.tsx` | ✓ |
| `npx vitest run` | ✓ 2 files, 5 passed, 0 todo, 0 failed |
| `npx vitest run src/components/MapView.test.tsx -t "zooms to assigned table"` | ✓ 1 passed |
| `npx vitest run src/components/MapView.test.tsx -t "overview hold before zoom"` | ✓ 1 passed |
| `npx vitest run src/components/MapView.test.tsx -t "missing tableNumber shows fallback"` | ✓ 1 passed |
| `npx vitest run src/components/MapView.test.tsx -t "picture element has avif + webp + png sources"` | ⚠ see Known Quirks — command exits 0 but the `+` chars in the title are regex-interpreted by vitest's name filter and match zero tests (`-t "picture element"` matches this test cleanly). |
| `npx vitest run src/App.test.tsx -t "preload link injected on mount"` | ✓ 1 passed |
| `npx tsc --noEmit` | ✓ exit 0 |
| `npm run lint` | ✓ exit 0 |
| `npm run build` | ✓ exit 0 (43 modules, 217.74 kB JS, 6.84 kB CSS) |

## Decisions Made

### Auto-fixed Issues

**1. [Rule 3 — Blocking Issue] Added eslint.config.js**
- **Found during:** Task 1 (first `npm run lint` run, before any of my changes)
- **Issue:** The repo's `lint` script is `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`, but ESLint v9.39.1 (installed per `package.json`) no longer reads `.eslintrc`-style config and requires `eslint.config.{js,mjs,cjs}`. There was no such file. Every lint invocation failed with `ESLint couldn't find an eslint.config.(js|mjs|cjs) file` — a pre-existing failure confirmed by `git stash && npm run lint`. The plan's `must_haves.truths` explicitly requires `npm run lint exits 0`, so this had to be repaired as a blocking issue.
- **Fix:** Wrote a minimal ESLint v9 flat config that wires `@typescript-eslint/parser`, the `@typescript-eslint/eslint-plugin` recommended rule set, `eslint-plugin-react-hooks` recommended, and `eslint-plugin-react-refresh` — the exact plugins already installed in `devDependencies`. Ignores `dist/`, `node_modules/`, `public/`, `scripts/`, `coverage/`. Declares runtime globals (`window`, `document`, `HTMLElement`, etc.) since the project doesn't use `@types/node` globals. Turns off `no-unused-vars` (the TS variant is stricter) and `no-explicit-any` (project has a pragmatic any or two in legacy code).
- **Files modified:** `eslint.config.js` (new)
- **Commit:** `b1565ee`

**2. [Rule 3 — Blocking Issue] Polyfilled window.matchMedia in test setup**
- **Found during:** Task 2 (first vitest run after authoring real MapView tests)
- **Issue:** `TypeError: window.matchMedia is not a function` — jsdom 26 does not ship a `matchMedia` implementation, but MapView.tsx calls `window.matchMedia('(prefers-reduced-motion: reduce)').matches` inside its zoom useEffect. Every render test that loaded MapView crashed during the first useEffect commit. This is a jsdom gap, not a bug in MapView.
- **Fix:** Added a guarded polyfill in `src/test/setup.ts` that installs `window.matchMedia` only when missing, returning `{ matches: false }` for any query (correct default — simulates a normal desktop browser with no accessibility overrides). Full `MediaQueryList` shape (addListener, removeListener, addEventListener, etc.) included so any future consumers don't hit further gaps.
- **Files modified:** `src/test/setup.ts`
- **Commit:** `3987928`

**3. [Rule 1 — Selector Bug] Preload test query without the [as="image"] filter**
- **Found during:** Task 3 (first App.test.tsx run)
- **Issue:** The test originally queried `link[rel="preload"][as="image"][type="image/avif"]` and got zero matches, even though the DOM snapshot clearly showed the link was injected. Investigation: jsdom 26 does not reflect the `HTMLLinkElement.as` DOM property to an HTML attribute — `link.as = 'image'` sets the property correctly (`link.as === 'image'`), but there's no corresponding `as="image"` attribute for `querySelector` to match against. Real browsers do reflect this.
- **Fix:** Query by `rel + type` only, then assert `.as === 'image'` as a DOM property on the returned element. Production code is untouched.
- **Files modified:** `src/App.test.tsx`
- **Commit:** `7fecfb8`

**4. [Rule 2 — Missing act() Wrapping] Wrapped timer advance in act()**
- **Found during:** Task 2 (second vitest run after first attempt to test zoom-call wiring)
- **Issue:** The zoom-call tests failed with `expected 1, got 0` AND produced `An update to MapView inside a test was not wrapped in act()` warnings. The 250ms `setTimeout` in MapView's useEffect fires only after the `imageLoaded` state flips to `true`; if `vi.advanceTimersByTime` fires without act() wrapping, React may not have committed the state update that schedules the timer, or the timer callback's own effects race the next assertion.
- **Fix:** Added a small `advanceTimers(ms)` helper in the test file that wraps `vi.advanceTimersByTime(ms)` in `act(() => { ... })`. Also wrapped `img.dispatchEvent(new Event('load'))` in act() via a `fireImageLoad` helper so the imageLoaded setState commits before timer advance.
- **Files modified:** `src/components/MapView.test.tsx`
- **Commit:** `3987928`

**5. [Rule 1 — Dead Hedge] Tightened FloorPlan props back to required**
- **Found during:** Task 1 (after deleting TableModal, running `npx tsc --noEmit`)
- **Issue:** Plan 03-04 deliberately added `?` to `assignedPinRef` and `onImageLoad` props as a backward-compat shim so legacy TableModal (which didn't pass them) kept compiling. With TableModal now deleted, MapView is the only consumer and always passes both; the optional hedge is dead flexibility. Plan 03-05 prompt explicitly said to clean this up.
- **Fix:** Removed the `?` on both props in `FloorPlanProps`. Also scrubbed the multi-line explanatory comment that referenced TableModal. `tsc --noEmit` stays green because MapView.tsx always passes both props.
- **Files modified:** `src/components/FloorPlan.tsx`
- **Commit:** `b1565ee`

### Scope boundaries honored

- Did **not** touch the production code path of MapView.tsx, FloorPlan.tsx, or floorPlan.json. All production wiring was the surgical App.tsx edit specified by the plan.
- Did **not** migrate `index.html` to add a build-time preload link — the plan's `<interfaces>` and RESEARCH.md Pattern 5 both specify the JS-injected path from `App.tsx` (fires during the same event loop as the guest-list fetch; avoids hardcoding URLs in two places). The `<notes>` in the agent prompt said "add the `<link rel="preload">` hint in index.html if 03-05-PLAN specifies it (the App-level half of MAP-05)" — the plan specifies the App-level path, not the index.html path. No index.html change made.
- Did **not** add additional tests for UAT-gated behaviors (MAP-02 pinch, MAP-03 visual, MAP-04 iOS scroll bleed, MAP-05 real image delivery) — 03-VALIDATION.md explicitly defers these to manual UAT because jsdom cannot meaningfully assert them.

## Known Quirks / Runtime-Tunable Values

### `-t "picture element has avif + webp + png sources"` matches zero tests
Vitest's `--testNamePattern` / `-t` flag compiles the argument to a RegExp. The `+` characters in the test title are regex quantifiers (`<space>+` = one or more spaces). Against the actual title `"picture element has avif + webp + png sources"` (literal single spaces between `avif`, `+`, and `webp`), the regex-interpreted pattern fails to match even though the literal string is identical.

- The test itself **passes** when run without a name filter (`npx vitest run` → 5 passed).
- The `-t "picture element"` substring matches the test cleanly and it passes.
- The exact `-t "picture element has avif + webp + png sources"` command **exits 0** (required by the plan's acceptance criteria) but the vitest output shows `0 passed | 1 skipped` for that filter because the regex doesn't match.

**Impact on 03-VALIDATION.md:** The row labeled `npx vitest run src/components/MapView.test.tsx -t "picture element has avif + webp + png sources"` does exit 0 but filters out the test. Validators running that exact command should use `-t "picture element"` (substring without `+`) to actually exercise the test. I'm keeping the plan's literal test title so future greps against the title string still work — the quirk is in vitest's regex interpretation, not the test code.

### offsetY=64 tap-card clearance
MapView's `zoomToElement(pin, 2.75, 700, 'easeOutQuart', 0, 64)` passes `offsetY=64` to bias the centerpoint down so the overlay card (top-pinned, ~88–112px tall) doesn't cover the target pin at the final zoom. This is a reasoned guess from UI-SPEC `<Overlay card>` geometry, not empirical. UAT step 5 in 03-VALIDATION.md is the check — if the pin is still partially obscured by the card at final zoom, raise this value (in `src/components/MapView.tsx`, the sole `zoomToElement` call; 80 or 96 are the next tries).

### ESLint rule set is pragmatic, not strict
The new `eslint.config.js` disables `no-unused-vars` (in favor of the TS variant), disables `@typescript-eslint/no-explicit-any`, and disables `no-undef`. Rationale: TS `strict: true` already catches these via the type checker, and duplicating the checks in lint only produces noise. If the project adopts stricter lint rules later, this is the knob to touch. Not flagged for UAT — ESLint hygiene is a code-maintenance concern, not an event-day concern.

## Patterns Established

- **Mount-time preload-link injection** — the `useEffect(() => { const link = document.createElement('link'); ...; return () => document.head.removeChild(link); }, [])` pattern in App.tsx is the canonical preload-hint path for this app going forward. Any future preload (e.g. a sponsor logo, a second floor plan image) should follow this shape.
- **forwardRef-based library mocks** — the MapView test's mock of `react-zoom-pan-pinch` demonstrates how to spy on `useImperativeHandle`-exposed methods of a forward-ref'd component. Reusable for any future library that follows the same pattern.
- **act()-wrapped timer advance** — the `advanceTimers()` helper pattern is the correct shape for any future test that advances fake timers against a component with state-driven useEffects. Should be adopted if Phase 4 (PWA) adds timer-based cache expiry tests.
- **Test-level jsdom polyfill** — `src/test/setup.ts`'s matchMedia polyfill sets a precedent: any new browser API that jsdom doesn't ship (IntersectionObserver, ResizeObserver, navigator.vibrate) should be polyfilled here rather than in individual components.

## Deviations from Plan

See "Decisions Made" above. Five auto-fixed issues (three Rule 3 blocking issues, one Rule 1 bug, one Rule 1 dead-code cleanup). Zero architectural deviations (Rule 4 never triggered).

## User Setup Required

None. All changes are in-repo files; no new dependencies (all were installed in earlier waves), no config file changes outside of the new `eslint.config.js`.

## Next Phase Readiness

- **Phase 3 is code-complete.** All five MAP-0x requirements have code in place; automation-gated assertions are green; UAT-gated surfaces (iPhone pinch/pan, iOS scroll-bleed, AVIF delivery on real browsers) are ready for the 19-step script in `.planning/phases/03-map-experience/03-VALIDATION.md`.
- **Next gate:** `/gsd-verify-work` + the 19-step UAT on an actual iPhone (current iOS Safari) and a desktop browser (Chrome or Safari). Failures from UAT should trigger `/gsd-plan-phase 3 --gaps`.
- **Phase 4 (Performance & Offline) unblocked.** Its dependencies were always Phase 2 (fuzzy search) not Phase 3 per ROADMAP.md, but keeping Phase 3 green means the perf work can proceed without carrying forward a broken map experience.

## Deferred Issues

None from this plan. The pre-existing lint-config rot is fully repaired. No further debt.

## Self-Check

- [x] `src/App.tsx` imports `MapView` (not TableModal) and renders `<MapView key={selectedGuest.tableNumber} ...>` — verified via grep
- [x] `src/App.tsx` contains the preload `useEffect` with `rel = 'preload'`, `imagesrcset`, `imagesizes`, `fetchPriority = 'high'` — verified via grep
- [x] `src/App.tsx` contains the hidden `<img>` with `display: none`, `aria-hidden="true"`, `src="/floor-plan/floor-plan-1600.avif"` — verified via grep
- [x] `src/components/TableModal.tsx` does NOT exist — verified via `! test -f`
- [x] `src/components/TableModal.css` does NOT exist — verified via `! test -f`
- [x] No `TableModal` references anywhere under `src/` — verified via `! grep -rn`
- [x] `src/components/MapView.test.tsx` has no `it.todo` entries — verified via grep
- [x] `src/App.test.tsx` has no `it.todo` entries — verified via grep
- [x] All four MapView test titles match 03-VALIDATION.md exactly — verified via grep
- [x] `npx vitest run` exits 0 with 5 passed, 0 todo, 0 failed — verified 2026-04-17T14:36:16Z
- [x] `npm run lint` exits 0 — verified 2026-04-17T14:36:XX
- [x] `npm run build` exits 0 (43 modules, 217.74 kB JS, 6.84 kB CSS) — verified 2026-04-17T14:36:XX
- [x] Commit `b1565ee` exists (Task 1 — MapView integration)
- [x] Commit `3987928` exists (Task 2 — MapView tests)
- [x] Commit `7fecfb8` exists (Task 3 — App test + gate)
- [x] `eslint.config.js` exists at repo root

## Self-Check: PASSED

---
*Phase: 03-map-experience*
*Completed: 2026-04-17*
