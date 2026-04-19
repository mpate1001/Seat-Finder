---
phase: 04-performance-offline
plan: 02
subsystem: data-layer
tags: [cache, localStorage, swr, abort-controller, network-first, PERF-01]

requires:
  - phase: 04-performance-offline
    plan: 01
    provides: "SHEET_URL + parseGuestsCsv named exports from googleSheets.ts (04-01 refactor)"
provides:
  - "fetchGuestsCached(url) — network-first SWR wrapper with 2s AbortController timeout + 24h localStorage TTL (PERF-01)"
  - "readCachedMetadata() — read-only cache metadata accessor returning { fetchedAt, ageMs } for plan 04-04's StalenessBadge"
  - "CachedGuests interface + CACHE_KEY constant ('seatfinder.guests.v1') as the versioned cache contract (D-02)"
  - "App-level fetchedAt: string | null state threaded through .card[data-fetched-at] as a plan-04-04 handoff"
  - "D-10 error copy ('Can't reach the guest list. Ask staff for directions...') surfaced on stale-and-offline path"
affects: [04-04-staleness-badge, 04-05-sw-precache]

tech-stack:
  added: []  # No new deps
  patterns:
    - "Network-first SWR via inline decision tree: try network (2s abort) -> success writes cache; failure falls back to cache if fresh, D-10 throw if stale, 'connection' throw if no cache"
    - "AbortController-based timeout via window.setTimeout + ctrl.abort() inside a try/finally that clears the timer"
    - "Schema-guarded localStorage read: typeof/in checks convert JSON.parse output into either a typed CachedGuests or a silent cache-miss"
    - "Storage.prototype.setItem spy pattern for simulating iOS Private Mode QuotaExceededError in jsdom tests"
    - "vi.advanceTimersByTimeAsync (not the sync variant) to drain microtask queue so AbortSignal fires inside fetch(...) await before awaiting the outer promise"

key-files:
  created:
    - "src/services/guestsCache.ts"
    - "src/services/guestsCache.test.ts"
  modified:
    - "src/App.tsx"
    - "src/App.test.tsx"

key-decisions:
  - "Dropped plan's legacy /24 hours/ grep from the stale-fallback test; substring-match the D-10 copy instead (see Deviations §1) — the D-10 string is the single source of truth per execute-phase success_criteria"
  - "Threaded fetchedAt through .card data-fetched-at attribute as the 04-04 handoff — keeps the state variable referenced by the render tree (no unused-var lint) and gives 04-04 a stable selector to delete"
  - "Mocked ./services/guestsCache and ./services/googleSheets separately in App.test.tsx — keeps the new cache-integration tests isolated without perturbing the existing preload-link spec"

requirements-completed: [PERF-01]

duration: ~10min
completed: 2026-04-17
---

# Phase 4 Plan 02: localStorage SWR Cache Wrapper Summary

**PERF-01 delivered via src/services/guestsCache.ts — network-first fetch with 2s AbortController timeout, falling back to a 24h-TTL localStorage cache under key 'seatfinder.guests.v1'. App.tsx now consumes fetchGuestsCached(SHEET_URL) on every mount and exposes fetchedAt as state for plan 04-04's StalenessBadge.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-17T13:06Z
- **Tasks:** 3
- **Files:** 4 touched (2 created, 2 modified)
- **Test delta:** +8 vitest specs (6 cache + 2 cache-integration in App) — total suite now 21 passing across 4 files

## Accomplishments

- **PERF-01 shipped:** `fetchGuestsCached(url)` implements the exact decision tree from 04-RESEARCH.md §4 / 04-CONTEXT.md D-01..D-04. Network success writes the cache and returns fresh data; network failure with a fresh cache returns the cached entry silently; network failure with a >24h-stale cache throws the D-10 copy; network failure with no cache throws a "check your connection" message carrying the underlying error detail.
- **App wiring clean:** the only observable caller change is `loadGuests()` now awaits `fetchGuestsCached(SHEET_URL)` instead of `fetchGuests()`. The retry/error UI, preload useEffect, and full render tree are untouched.
- **fetchedAt plumbing ready for 04-04:** App stores `fetchedAt: string | null` and writes it to `.card[data-fetched-at]`. Plan 04-04 can either read the attribute during a transition period or simply delete it and drop a `<StalenessBadge fetchedAt={fetchedAt} onRefresh={loadGuests} />` into the same card.
- **Multi-layer correctness tests:** 6 cache specs (success, net-error fallback, 2s-timeout fallback, stale+offline throw, corrupt-JSON miss, QuotaExceededError swallow) plus 2 App-level tests (renders on cache-wrapper success; shows D-10 copy on cache-wrapper error).

## Task Commits

1. **Task 1 (Module):** `d0ef748` — `feat(04-02): add guestsCache SWR wrapper with 2s timeout and 24h TTL`
2. **Task 2 (Tests):** `8c730e7` — `test(04-02): add 6 vitest specs for guestsCache SWR semantics`
3. **Task 3 (App wiring):** `6a3e55e` — `feat(04-02): wire fetchGuestsCached into App + cache-path tests`

## Files Created/Modified

- **Created** `src/services/guestsCache.ts` (117 lines) — the SWR wrapper module. `CACHE_KEY = 'seatfinder.guests.v1'`, `NETWORK_TIMEOUT_MS = 2000`, `HARD_EXPIRY_MS = 24 * 60 * 60 * 1000`. Exports `fetchGuestsCached`, `readCachedMetadata`, `CachedGuests`, `CACHE_KEY`. Uses `window.setTimeout` + `AbortController` (per plan's ESLint note). QuotaExceededError swallowed via try/catch on `writeCache`; JSON.parse failure and schema mismatch return a silent cache-miss from `readCache`.
- **Created** `src/services/guestsCache.test.ts` (135 lines) — six vitest specs covering the six SWR invariants. Uses `vi.stubGlobal('fetch', ...)` for network mocks, `vi.useFakeTimers()` + `advanceTimersByTimeAsync(2001)` for the abort test, and `vi.spyOn(Storage.prototype, 'setItem')` for the quota test.
- **Modified** `src/App.tsx` — swapped `import { fetchGuests }` for `import { SHEET_URL }` + `import { fetchGuestsCached }`; added `fetchedAt` state; `loadGuests()` now destructures `{ guests, fetchedAt }` from the cache wrapper and calls `setFetchedAt(fetchedAtIso)`; main-branch `.card` element gets `data-fetched-at={fetchedAt ?? ''}`.
- **Modified** `src/App.test.tsx` — added a `./services/guestsCache` mock via module factory + local `fetchGuestsCachedMock` function; augmented the `./services/googleSheets` mock with a `SHEET_URL` sentinel and the newly-exported `parseGuestsCsv`; added `beforeEach` to the existing `describe('App')` so the preload test defaults to a resolved cache payload; appended a new `describe('<App /> cache integration')` with the two plan-mandated specs.

## Decisions Made

- **D-10 copy wins over the plan's `/24 hours/` test assertion.** The plan's Task 1 code (copied verbatim from RESEARCH.md §4) throws the D-10 string on stale-and-offline — which does NOT contain "24 hours". The plan's Task 2 test template then asserts `/24 hours/`, contradicting both the plan's own code AND the executor's success_criteria. Resolved in favor of the D-10 copy (Rule 1 bug fix — see Deviations). The 24h TTL behavior itself is enforced by the `HARD_EXPIRY_MS = 24 * 60 * 60 * 1000` constant and the expired-branch dispatch, independent of any user-facing string.
- **Storage.prototype.setItem spy (not a global localStorage replacement) for the quota test.** Works cleanly in jsdom 26.1.0 — `vi.spyOn(Storage.prototype, 'setItem')` with `.mockImplementation(function (this: Storage, key, value) { ... })` gives per-key control and auto-cleans on `vi.restoreAllMocks()` in the `afterEach`. No Storage-prototype-level cleanup dance needed.
- **fetchedAt exposed via `.card` data attribute instead of a void-reference or underscore alias.** The plan author flagged two alternatives for keeping the state referenced: `void fetchedAt;` or a dead prop. A `data-fetched-at` attribute is strictly better because (a) it doesn't violate the "side-effect-free render" invariant, (b) it already satisfies plan 04-04's assumed read pattern, and (c) it's a visible DOM handoff that tests can assert on without coupling to React-internal state.
- **Global test suite confirmed unaffected.** Full `vitest run` (4 files, 21 tests) passed after the edits — the pre-existing `searchGuests.test.ts`, `googleSheets.test.ts`, and the `App` preload spec all still green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan's stale-cache test asserted `/24 hours/` against a D-10-copy throw that contains no '24 hours' substring**

- **Found during:** Task 2 `vitest run` (first attempt failed 1/6 tests).
- **Issue:** The plan's `must_haves.truths` said the stale-and-offline error must contain "24 hours", and the plan's Task 2 test block asserted `rejects.toThrow(/24 hours/)`. But the plan's literal Task 1 code (which the plan instructed to copy verbatim) throws the D-10 copy: `"Can't reach the guest list. Ask staff for directions or try again in a moment."` — no "24 hours" substring. The executor's prompt `<success_criteria>` also explicitly required: `Error copy matches D-10: "Can't reach the guest list. Ask staff for directions or try again in a moment."`. Three sources of truth, one contradiction.
- **Fix:** Changed the test assertion from `/24 hours/` to `/Can't reach the guest list\. Ask staff for directions/`. Renamed the spec from `"throws when cache is >24h old and network fails"` to `"throws D-10 error when cache is >24h old and network fails"` and added a comment explaining that 24h behavior is enforced by `HARD_EXPIRY_MS`, independent of the error string.
- **Files modified:** `src/services/guestsCache.test.ts`
- **Verification:** After the fix, all 6 cache specs pass; full suite 21/21 green; lint + tsc clean.
- **Committed in:** `8c730e7` (the test-authoring commit — fix landed in the same commit that introduced the test file, since the test never made it to main in a broken state).

### Auth Gates

None. No authentication work in this plan.

---

**Total deviations:** 1 auto-fixed (1 bug) — the plan-internal contradiction between the legacy test grep and the decision-document's canonical error string.
**Impact on plan:** Preserved the plan's stale-cache behavior (24h TTL enforced by `HARD_EXPIRY_MS` constant) and aligned the test assertion with the D-10 user-facing copy. No observable user-facing behavior change vs. the plan's intent — just the test string.

## Issues Encountered

- **Worktree setup:** the worktree was branched from an empty initial commit (`f57f68e`) and had no `node_modules` or `.env.local`. Resolved by hard-resetting to `dev` (per the worktree_branch_check protocol), symlinking `node_modules` from the main repo, and copying `.env.local`. This was a pre-existing orchestrator gap, not a plan defect — recording it here in case later worktrees hit the same state.

## Known Stubs

None. All code paths are wired to real data sources. The `data-fetched-at` attribute is a plan-04-04 handoff, not a stub — the state flows through, and plan 04-04 will upgrade the attribute to a visible `<StalenessBadge />` component without changing the state plumbing.

## Infrastructure Notes (from plan's output spec)

- **Exact error strings surfaced to App's error card:**
  - `"Can't reach the guest list. Ask staff for directions or try again in a moment."` — thrown when cache exists and is >24h old AND network fails (D-10, canonical).
  - `"Unable to load guest list. Please check your connection and try again. ({underlying error})"` — thrown when there is no cache at all AND network fails. The trailing `({underlying error})` is the raw network error message (e.g. `"network down"`, `"HTTP 500 Internal Server Error"`, `"aborted"` for timeout). Consumed by `App.tsx` `err instanceof Error ? err.message : 'Failed to load guests'` in the same error card.
  - The successful path emits no error string — the cache wrapper returns `{ fetchedAt, guests }` and App stores both.
- **Quota test implementation:** required `vi.spyOn(Storage.prototype, 'setItem')` with a `mockImplementation(function (this: Storage, key, value) { ... })` that `throw`s a `new Error('QuotaExceededError')` with `e.name = 'QuotaExceededError'` ONLY when the key matches `CACHE_KEY`, otherwise delegates to the original `setItem`. Using `globalThis.localStorage` directly would also work but the prototype spy is cleaner and auto-cleans on `vi.restoreAllMocks()`. No jsdom-specific gotchas — jsdom 26.1.0 honors the spy transparently.
- **AbortSignal test implementation:** `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(2001)` — the async variant drains the microtask queue so the `ctrl.abort()` fires inside the awaited `fetch(...)` call BEFORE the outer `await fetchGuestsCached(...)` resumes. Using `vi.advanceTimersByTime` (sync) leaves the promise in a pending state and the test hangs. The fetch mock itself listens for `init?.signal?.addEventListener('abort', ...)` and rejects with a `DOMException('aborted', 'AbortError')` to simulate the native behavior.

## Next Plan Readiness

- **Plan 04-03 (service worker precache):** No blockers. The cache wrapper is pure localStorage — it does not touch the service worker or `runtimeCaching` config. Plan 04-03 / 04-05 should register `NetworkOnly` for the Google Sheets host (per RESEARCH.md Anti-Patterns "Two caches fighting") so the SW doesn't shadow this wrapper's 2s timeout.
- **Plan 04-04 (StalenessBadge):** `readCachedMetadata()` is exported and typed. App.tsx already stores `fetchedAt` in state and renders it via `.card[data-fetched-at]`. Plan 04-04 can (a) delete the `data-fetched-at` attribute from App.tsx and (b) drop `<StalenessBadge fetchedAt={fetchedAt} onRefresh={loadGuests} />` inside the same `.card` — both pieces of wiring are already in place.
- **Plan 04-05 (PWA manifest):** No dependency on this plan.
- **No blockers.**

## Self-Check: PASSED

File existence:
- FOUND: src/services/guestsCache.ts
- FOUND: src/services/guestsCache.test.ts
- FOUND: src/App.tsx
- FOUND: src/App.test.tsx

Commits (worktree branch):
- FOUND: d0ef748 (Task 1 — feat: guestsCache module)
- FOUND: 8c730e7 (Task 2 — test: 6 vitest specs)
- FOUND: 6a3e55e (Task 3 — feat: App wiring + tests)

Gates:
- `npx tsc --noEmit`: clean (exit 0)
- `npm run lint`: clean (exit 0, max-warnings 0)
- `npx vitest run`: 4 files, 21 tests, all passing
- `npx vitest run src/services/guestsCache.test.ts`: 6/6 pass
- `npx vitest run src/App.test.tsx`: 3/3 pass (1 preload + 2 cache integration)
- Plan invariants grep (CACHE_KEY, NETWORK_TIMEOUT_MS, AbortController, parseGuestsCsv, fetchGuestsCached, readCachedMetadata, CachedGuests, SHEET_URL, setFetchedAt, data-fetched-at): all present

---
*Phase: 04-performance-offline*
*Completed: 2026-04-17*
