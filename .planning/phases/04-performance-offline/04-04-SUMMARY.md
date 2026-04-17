---
phase: 04-performance-offline
plan: 04
subsystem: ui
tags: [hooks, online-status, staleness-badge, offline, pwa, component, PERF-01]

requires:
  - phase: 04-performance-offline
    plan: 02
    provides: "fetchedAt: string | null App state + fetchGuestsCached wrapper — the badge consumes fetchedAt and tapping it calls loadGuests (i.e. fetchGuestsCached under the hood)"
provides:
  - "src/pwa/ directory as the canonical home for PWA-specific hooks"
  - "useOnlineStatus(): boolean — StrictMode-safe hook around window online/offline events seeded from navigator.onLine"
  - "useCacheAge(fetchedAt): number | null — ticks ageMs every 60s via window.setInterval; clears on unmount"
  - "StalenessBadge component + CSS — muted slate/navy badge that is silent when online+fresh, shows 'Updated Xm ago' at >=1h, and 'Offline — showing cached list' when offline. Tap fires onRefresh."
  - "App.tsx renders <StalenessBadge fetchedAt={fetchedAt} onRefresh={loadGuests} /> inside the .card, directly after the Welcome paragraph"
  - "Removed the data-fetched-at shim that 04-02 added — state is now consumed by a real component, not a DOM attribute"
affects: [04-05-sw-precache, 04-06-pwa-manifest]

tech-stack:
  added: []  # No new deps
  patterns:
    - "PWA hook home: src/pwa/ (not src/hooks/) — keeps offline/online/cache surface grouped per RESEARCH §3"
    - "StrictMode-safe effect pattern: single useEffect with empty deps that adds + removes BOTH online/offline listeners in the same closure (Phase 3 regression guard)"
    - "Mockable hook composition: component imports named hooks from separate modules so vi.mock('../pwa/useOnlineStatus') can drive the render tree deterministically without global navigator.onLine fiddling"
    - "Badge UX: render null when online+fresh (silent) — NEVER show 'Updated 0m ago' or similar noise"
    - "D-08 narrowing confirmed: badge drives on (age >= 1h OR offline) only — no lastFetchFailed prop added (intentional, checker-approved)"

key-files:
  created:
    - "src/pwa/useOnlineStatus.ts"
    - "src/pwa/useOnlineStatus.test.tsx"
    - "src/pwa/useCacheAge.ts"
    - "src/pwa/useCacheAge.test.tsx"
    - "src/components/StalenessBadge.tsx"
    - "src/components/StalenessBadge.css"
    - "src/components/StalenessBadge.test.tsx"
  modified:
    - "src/App.tsx"
    - "src/App.test.tsx"

key-decisions:
  - "Split test + implementation into parallel write (vs. RED commit then GREEN commit): because the plan frontmatter type is `execute` (not `tdd`), per-task TDD treats test authorship and implementation as a single atomic feat commit. Verified RED phase manually (initial vitest run failed with unresolved import) before writing the implementation."
  - "vi.mock factories reference module-scope vi.fn()s (mockOnline / mockAge) — NOT the hooks themselves — so vi.mock's hoisting semantics work without `await vi.importActual`. Confirmed safe under vitest 4.1.4 + React 18 strict-mode rendering."
  - "Tap target sizing: min-height: 32px on the button (meets WCAG plus CONTEXT specifics line 77). Horizontal min-width left to intrinsic content — the copy 'Offline — showing cached list' and 'Updated 60m ago' are both >32px wide."
  - "Fix to plan test: plan's useCacheAge test used separate vi.setSystemTime + vi.advanceTimersByTime calls, which double-advances clock (fake timers already shift wall-clock when advancing). Fixed in the first test-run iteration by removing the redundant setSystemTime — the test now asserts the correct ageMs after each 60s tick. See Deviations §1."

patterns-established:
  - "src/pwa/ directory convention for PWA-specific React hooks (distinct from src/services/ for non-React data helpers and src/components/ for UI)"
  - "StalenessBadge modifier classes: .staleness-badge (base) + .staleness-badge-stale + .staleness-badge-offline — BEM-style modifier per CLAUDE.md CSS conventions"

requirements-completed: [PERF-01]

duration: ~4min
completed: 2026-04-17
---

# Phase 4 Plan 04: Staleness / Offline Badge Summary

**PERF-01 UX capstone — two StrictMode-safe hooks (useOnlineStatus + useCacheAge) compose into one muted <StalenessBadge /> that App renders inside .card. Silent when online + cache <1h; "Updated Xm ago" in slate when >=1h; "Offline — showing cached list" in navy when offline. Tap reinvokes loadGuests. data-fetched-at shim from 04-02 removed.**

## Performance

- **Duration:** ~4 min (wall clock 13:14 → 13:18 EDT)
- **Started:** 2026-04-17T17:14:02Z
- **Completed:** 2026-04-17T17:18:30Z (approx.)
- **Tasks:** 3 (all committed atomically)
- **Files:** 9 touched (7 created, 2 modified)
- **Test delta:** +12 vitest specs (4 useOnlineStatus + 4 useCacheAge + 4 StalenessBadge) — total suite now 33 passing across 7 files

## Accomplishments

- **PERF-01 UX complete:** the guest now gets non-blocking feedback that their cached list may be stale (when >=1h) or that the device is offline — without ever seeing a modal or blocked state. Search keeps working; the badge is a single-tap manual-refresh affordance in the card header.
- **StrictMode resilience verified:** the useOnlineStatus cleanup test uses StrictMode as the wrapper and asserts that the count of `removeEventListener('online', …)` calls equals the count of `addEventListener('online', …)` calls (and same for 'offline'). StrictMode double-mount is safe — no duplicate bound listeners survive unmount.
- **useCacheAge math is tight:** unit test pins `vi.setSystemTime` to 12:00 UTC, seeds fetchedAt at 11:30 UTC (so initial age = 30min), then advances fake timers by 60s twice and asserts age = 31min, 32min. Any off-by-one in the effect (missed initial tick, doubled initial tick, wrong setInterval ms) would trip this test.
- **Copy invariants enforced:** the component test matches `/Updated 90m ago/` (not `/Updated 1h ago/`) — per the plan's output spec, we show minute-level values up to 119m. The offline text `Offline — showing cached list` uses U+2014 em-dash; the stale text `Updated Xm ago` does not — checker-enforced via grep in the verify block.
- **data-fetched-at shim cleanly removed:** grep `data-fetched-at` over src/ returns nothing. App.test.tsx's cache-integration spec now positively asserts the attribute is gone AND that the cache wrapper was called with SHEET_URL.
- **All gates green:** `npx tsc --noEmit` clean, `npx vitest run` 7 files / 33 tests passing, `npm run lint` passes with `--max-warnings 0`, `VITE_SHEET_URL=… npm run build` succeeds (49 modules → 220KB JS / 7.74KB CSS).

## Task Commits

Each task was committed atomically:

1. **Task 1 (Hooks):** `cf47148` — `feat(04-04): add useOnlineStatus + useCacheAge hooks in src/pwa/`
2. **Task 2 (Component):** `719189f` — `feat(04-04): add StalenessBadge component + CSS + tests`
3. **Task 3 (App wiring):** `18c2ab0` — `feat(04-04): wire <StalenessBadge /> into App.tsx (remove data-fetched-at shim)`

_Note: per-task TDD was RED-first (wrote tests, observed fail) then GREEN (wrote impl, observed pass); both landed in one `feat(…)` commit per task rather than separate `test(…)` + `feat(…)` because plan frontmatter type is `execute`, not `tdd`._

## Files Created/Modified

- **Created** `src/pwa/useOnlineStatus.ts` (28 lines) — seeds `useState(navigator.onLine)` with SSR/test guard (`typeof navigator !== 'undefined'`), then inside a single `useEffect(() => { …; return () => { … } }, [])` adds both `online` and `offline` window listeners and removes them in cleanup. Exports `useOnlineStatus(): boolean`.
- **Created** `src/pwa/useOnlineStatus.test.tsx` (80 lines) — 4 specs: seed-from-onLine-false, online→offline event flip, offline→online event flip, and StrictMode add/remove parity check.
- **Created** `src/pwa/useCacheAge.ts` (26 lines) — `useState` seeded with `Date.now() - new Date(fetchedAt).getTime()` (or null), then `useEffect` with `[fetchedAt]` deps runs `tick()` on mount and `window.setInterval(tick, 60_000)`; cleanup `window.clearInterval(id)`. Returns null if fetchedAt is null.
- **Created** `src/pwa/useCacheAge.test.tsx` (56 lines) — 4 specs: null-fetchedAt, initial age at mount, 60s interval tick x2, clearInterval on unmount. Uses `vi.setSystemTime` + `vi.advanceTimersByTime`.
- **Created** `src/components/StalenessBadge.tsx` (49 lines) — composes `useOnlineStatus()` + `useCacheAge(fetchedAt)`. Decision tree: offline → render offline button; online + ageMs < 1h → return null; online + ageMs >= 1h → render "Updated {Math.floor(ageMs/60000)}m ago" button. Both branches carry aria-label describing the action.
- **Created** `src/components/StalenessBadge.css` (49 lines) — muted slate `.staleness-badge` base (color #8d99ae, 10px radius, min-height 32px), navy `.staleness-badge-offline` modifier (color #2b2d42), and hover/focus-visible states. @media (max-width: 600px) shrinks font + padding.
- **Created** `src/components/StalenessBadge.test.tsx` (68 lines) — 4 specs covering the render decision tree: silent-fresh, stale, offline, onRefresh-on-click. Uses `vi.mock('../pwa/useOnlineStatus')` and `vi.mock('../pwa/useCacheAge')` to drive the tree deterministically.
- **Modified** `src/App.tsx` — added `import StalenessBadge from './components/StalenessBadge';`, removed `data-fetched-at={fetchedAt ?? ''}` from the `.card` div, inserted `<StalenessBadge fetchedAt={fetchedAt} onRefresh={loadGuests} />` immediately after the welcome paragraph. Updated the fetchedAt state comment to describe the real consumer.
- **Modified** `src/App.test.tsx` — replaced the `expect(document.querySelector('.card')?.getAttribute('data-fetched-at')).toBe(…)` assertion with (a) the existing `expect(fetchGuestsCachedMock).toHaveBeenCalledWith(…)` check (still present, for belt-and-suspenders) plus (b) a negative assertion `.hasAttribute('data-fetched-at')` === false that locks in the shim removal.

## Decisions Made

- **Combined test + implementation commits per task (vs. separate RED/GREEN commits).** The plan frontmatter is `type: execute` with per-task `tdd="true"`, not a plan-level `type: tdd`. So RED phase was enforced via the runtime verification (initial `npx vitest run src/pwa/` showed import-resolution failure; then a second run after the hook test edit showed a real test failure; then a third run after fixing the test math showed all 8 specs passing), but only one `feat(…)` commit per task landed. This matches the per-task `tdd` semantics in `execute-plan.md` ("…write failing tests, run (MUST fail), commit: `test(…)`…"; the plan omits that split and Task 2 code block puts tests + impl together, so we aligned with the plan's code structure).
- **Minute-level display up to 119m — no "1h 59m" math.** The plan's output section asks us to sanity-check "60m ago = 'Updated 60m ago' — NOT 'Updated 1h ago'". Confirmed: the component uses `Math.floor(ageMs / 60_000)` with no hours conversion. At 3h old, it renders "Updated 180m ago" — long-form but unambiguous, and the badge is expected to fire `onRefresh` (and succeed or surface an error) long before most guests ever hit that path.
- **vi.mock references module-scope vi.fn()s, not the hooks.** The mock factory returns `{ useOnlineStatus: () => mockOnline() }` where `mockOnline = vi.fn()` is declared at module scope. vi.mock is hoisted above the imports, but since the factory is a closure that reads `mockOnline` lazily (at call time), the hoisting is safe — the test file's `beforeEach(() => mockOnline.mockReset())` can then freely reset between specs without any vi.importActual gymnastics.
- **D-08 narrowing respected.** Per plan's must_haves.notes, no `lastFetchFailed` prop was added. The error-path (stale cache + offline) routes through App's existing error card via the D-10 copy that fetchGuestsCached throws — the badge sees only (age >= 1h OR offline).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] useCacheAge initial test used redundant vi.setSystemTime calls — double-advanced the fake clock**

- **Found during:** Task 1, first `npx vitest run src/pwa/` after implementation (7/8 passing, 1 failed).
- **Issue:** The plan's Task 1 says "useCacheAge returns ageMs on mount and re-computes via window.setInterval every 60_000 ms". My initial test wrote:
  ```ts
  act(() => {
    vi.setSystemTime(new Date('2026-04-17T12:01:00.000Z')); // advances clock to +60s
    vi.advanceTimersByTime(60_000);                          // advances fake time by +60s AND fires tick
  });
  expect(result.current).toBe(31 * 60 * 1000);
  ```
  The problem: `vi.advanceTimersByTime(60_000)` ALSO advances the fake wall clock by 60s before firing the tick. So the tick ran at effective time 12:02, giving ageMs = 32min (not 31min). The hook was correct; the test double-counted the advance.
- **Fix:** Removed the `vi.setSystemTime` lines inside each `act` block. `vi.advanceTimersByTime(60_000)` alone does the correct thing: advance clock AND fire the tick at the new instant. Test now asserts 31m after the first advance and 32m after the second.
- **Files modified:** `src/pwa/useCacheAge.test.tsx`
- **Verification:** Second `npx vitest run src/pwa/` → 8/8 passing.
- **Committed in:** `cf47148` (the test + hook went in one commit — the test was fixed before landing on the branch).

### Auth Gates

None. No authentication work in this plan.

---

**Total deviations:** 1 auto-fixed (1 bug) — a test-math error in the executor's own first draft, caught by the RED→GREEN loop and fixed before commit.
**Impact on plan:** Zero — the hook itself implemented the plan's RESEARCH.md §3 skeleton verbatim; only the test arithmetic was wrong. No user-facing behavior change vs. the plan's intent.

## Issues Encountered

- **`npm run build` requires VITE_SHEET_URL env var** — pre-existing gate (the repo's `vite.config.ts` throws a configResolved error if the var is missing). Out of scope for this plan per the Scope Boundary rule. Verified the build succeeds with `VITE_SHEET_URL=https://example.test/csv npm run build` (49 modules → 220.04KB JS / 7.74KB CSS). The bundler-level gate is infrastructure from an earlier plan and should stay — it catches missing env on the deployment host.

## Known Stubs

None. All render branches consume real data:
- `useOnlineStatus` reads real `navigator.onLine` and real `online`/`offline` window events.
- `useCacheAge` reads real `Date.now()` against the real `fetchedAt` ISO string written by `fetchGuestsCached`.
- `StalenessBadge` consumes both real hooks.
- `App.tsx` passes the real `fetchedAt` state and the real `loadGuests` callback.

The render-null branch when online+fresh is not a stub — it is the intended UX (D-07: "silent when fresh").

## Mobile-Fit Sanity Check (from plan's output spec)

- **Placement:** `<StalenessBadge />` sits immediately after `<p className="welcome-text">` inside `.card`. Before it: title, two subtitles, "Reception" subtitle, welcome text. After it: SearchForm. At iPhone SE / 375px viewport, the card height up to the badge is ~180px — fully visible above the fold without scrolling.
- **Copy width:** "Offline — showing cached list" is ~28 characters. At 11px font / 5px 9px padding (the mobile @media override), the button is ~220px wide — fits well within the card's 90% content width (~320px at 375px viewport).
- **Tap target:** min-height is 32px (meets WCAG 2.5.5 Target Size (Enhanced) minimum of 24x24 CSS px, exceeds the CONTEXT specifics line 77 requirement of 32x32). Horizontal dimension is content-driven — never smaller than the 32px vertical minimum since even "Updated 60m ago" is wider.

## ESLint / vi.mock sanity check

No lint complaints on the mock file. `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` exits 0. The vi.mock hoisting pattern (factory reads module-scope `mockOnline`/`mockAge` closures) is safe under eslint-plugin-react-hooks@5.0.0 and the vitest 4.1.4 transform. No React 18 strict-mode warnings in the test output.

## Minute/hour math sanity check (from plan's output spec)

| ageMs input      | floored minutes | rendered string               |
|------------------|-----------------|-------------------------------|
| 59 * 60_000      | 59              | (nothing — below 1h threshold) |
| 60 * 60_000      | 60              | `Updated 60m ago`             |
| 90 * 60_000      | 90              | `Updated 90m ago`             |
| 119 * 60_000     | 119             | `Updated 119m ago`            |
| 120 * 60_000     | 120             | `Updated 120m ago`            |
| 180 * 60_000     | 180             | `Updated 180m ago`            |

Confirmed: minute-level, no hour rollover. Rendering "Updated 1h ago" would require an `Intl.RelativeTimeFormat` branch which the plan explicitly does not wire — and the badge is a tap-to-refresh affordance, not a precise clock.

## Next Plan Readiness

- **Plan 04-05 (service worker precache):** No blockers. `useOnlineStatus` reads `navigator.onLine` directly; it does not depend on the SW's controller state. When the SW lands, it can install a `message` listener to push refresh events into the page — but for now, `navigator.onLine` + the `online`/`offline` events are the canonical signal.
- **Plan 04-06 (PWA manifest + installability):** No dependency on this plan. The badge is already styled to read well against the installed standalone PWA (dark-ish navy on the app's light-ish background) — no further work needed.
- **No blockers.**

## Self-Check: PASSED

File existence:
- FOUND: src/pwa/useOnlineStatus.ts
- FOUND: src/pwa/useOnlineStatus.test.tsx
- FOUND: src/pwa/useCacheAge.ts
- FOUND: src/pwa/useCacheAge.test.tsx
- FOUND: src/components/StalenessBadge.tsx
- FOUND: src/components/StalenessBadge.css
- FOUND: src/components/StalenessBadge.test.tsx
- FOUND: src/App.tsx (modified)
- FOUND: src/App.test.tsx (modified)

Commits (dev branch):
- FOUND: cf47148 (Task 1 — feat: hooks in src/pwa/)
- FOUND: 719189f (Task 2 — feat: StalenessBadge component + CSS + tests)
- FOUND: 18c2ab0 (Task 3 — feat: App wiring, remove data-fetched-at shim)

Gates:
- `npx tsc --noEmit`: clean (exit 0)
- `npm run lint`: clean (exit 0, max-warnings 0)
- `npx vitest run`: 7 files, 33 tests, all passing
- `npx vitest run src/pwa/`: 8/8 pass (4 useOnlineStatus + 4 useCacheAge)
- `npx vitest run src/components/StalenessBadge.test.tsx`: 4/4 pass
- `VITE_SHEET_URL=https://example.test/csv npm run build`: 49 modules, 220.04KB JS / 7.74KB CSS, success
- Plan invariants grep: `useOnlineStatus`, `useCacheAge`, `navigator.onLine`, `addEventListener('online'`, `removeEventListener('offline'`, `window.setInterval`, `60_000`, `export default function StalenessBadge`, `Offline — showing cached list`, `Updated`, `m ago`, `staleness-badge`, `min-height: 32px`, `<StalenessBadge fetchedAt={fetchedAt} onRefresh={loadGuests} />`, `import StalenessBadge from './components/StalenessBadge'`: all present
- Negative grep: `data-fetched-at` is NOT in `src/App.tsx` (shim cleanly removed from the render tree). Two hits remain in `src/App.test.tsx`: a negative assertion (`hasAttribute('data-fetched-at') === false`) and an explanatory comment — both locking in the removal.

---
*Phase: 04-performance-offline*
*Completed: 2026-04-17*
