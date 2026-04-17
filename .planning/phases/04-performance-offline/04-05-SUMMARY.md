---
phase: 04-performance-offline
plan: 05
subsystem: pwa
tags: [pwa, service-worker, workbox, manifest, update-toast, PERF-01, PERF-02, PERF-03]

requires:
  - phase: 04-performance-offline
    plan: 01
    provides: "requireSheetUrl Vite plugin (still alongside VitePWA; both plugins co-exist in vite.config.ts)"
  - phase: 04-performance-offline
    plan: 02
    provides: "fetchGuestsCached localStorage SWR layer — docs.google.com requests flow through it and the SW treats that host as NetworkOnly (no double-caching)"
  - phase: 04-performance-offline
    plan: 03
    provides: "public/pwa-192.png, public/pwa-512.png, public/pwa-512-maskable.png, public/apple-touch-icon.png — manifest icons and apple-touch-icon <link> now reference these files"
  - phase: 04-performance-offline
    plan: 04
    provides: "<StalenessBadge /> inside .card — <UpdateToast /> ships alongside it as the second PWA-surface component (badge for data staleness; toast for code updates)"
provides:
  - "vite-plugin-pwa@^1.2.0 devDependency pinned"
  - "VitePWA({...}) plugin registration in vite.config.ts — prompt-mode, manifest (name/short_name/theme/bg/3 icons), workbox (globPatterns/globIgnores/3 runtimeCaching rules/navigateFallbackDenylist), devOptions.enabled:true"
  - "index.html PWA head block — theme-color, apple-touch-icon <link>, apple-mobile-web-app-capable + mobile-web-app-capable, status-bar-style black-translucent, apple-mobile-web-app-title, viewport-fit=cover"
  - "src/components/UpdateToast.tsx — default-export function component; useRegisterSW hook; createPortal(document.body); 10s auto-dismiss; suppressed prop"
  - "src/components/UpdateToast.css — navy+red-CTA bottom toast, safe-area-aware, prefers-reduced-motion respected, mobile breakpoint"
  - "src/components/UpdateToast.test.tsx — 4 vitest specs (idle, click, suppressed, auto-dismiss)"
  - "src/test/pwa-register-react-stub.ts — vitest alias target so `virtual:pwa-register/react` resolves at test-import time"
  - "App.tsx renders <UpdateToast suppressed={selectedGuest !== null} /> in the success branch, outside .card"
  - "dist/sw.js + dist/workbox-*.js + dist/manifest.webmanifest at build time (contract for plan 04-06 to verify)"
affects: [04-06-build-verification]

tech-stack:
  added:
    - "vite-plugin-pwa@^1.2.0 (devDependency; peer-compat with Vite 6)"
  patterns:
    - "Virtual-module handling in tests: alias the specifier to an on-disk stub in vitest.config.ts so import-analysis resolves, then override with vi.mock(...) for assertions"
    - "Portal + suppression prop pattern: component renders a portal to document.body unconditionally except when `suppressed` is true or the underlying state-machine says idle — App-level suppression driven by selectedGuest !== null (D-07)"
    - "VitePWA registerType: 'prompt' with app-controlled reload — D-05 locks user-initiated reload via updateServiceWorker(true)"
    - "Workbox runtime caching stack: CacheFirst for long-lived images, StaleWhileRevalidate for code chunks, NetworkOnly for the origin-disclosed data endpoint"
    - "Type-aware virtual modules: /// <reference types='vite-plugin-pwa/client' /> pulls ambient declarations for the plugin's virtual specifiers"

key-files:
  created:
    - "src/components/UpdateToast.tsx"
    - "src/components/UpdateToast.css"
    - "src/components/UpdateToast.test.tsx"
    - "src/test/pwa-register-react-stub.ts"
  modified:
    - "package.json"
    - "package-lock.json"
    - "vite.config.ts"
    - "index.html"
    - "vitest.config.ts"
    - "src/vite-env.d.ts"
    - "src/App.tsx"

key-decisions:
  - "Aliased `virtual:pwa-register/react` in vitest.config.ts to an on-disk stub (src/test/pwa-register-react-stub.ts). Rationale: Vitest's import-analysis runs before the vi.mock() factory fires, so a virtual specifier with no on-disk counterpart crashes the test file before the mock can apply. The inline mock alone (from the plan's Step C) is insufficient under vitest 4.1.4 — the stub + alias is the minimum viable config. vi.mock(...) still drives the render tree; the stub is a no-op fallback."
  - "Added /// <reference types='vite-plugin-pwa/client' /> to src/vite-env.d.ts. Rationale: without the reference, TS2307 fires on `import … from 'virtual:pwa-register/react'`. The plugin ships client.d.ts with react/preact/vue/solid/svelte/vanilla subfiles and the virtual-module ambient decls."
  - "Kept UpdateToast outside .card but inside .app-container (JSX tree location). The portal mounts to document.body regardless, so the JSX parent is cosmetic — placing it alongside the preload <img> at the tail of .app-container keeps the render tree legible. Placing it OUTSIDE .app-container would have been equivalent but less discoverable when reading App.tsx top-to-bottom."
  - "onRegisterError typed as (err: unknown) instead of leaving it implicit. Rationale: tsconfig has `strict: true` + `noImplicitAny: true` (via strict). The plan's snippet relied on inference from the callback's declared signature, but the useRegisterSW type inference from the stub in test mode widens it — explicit `unknown` is safer under strict."

patterns-established:
  - "src/test/ directory for non-setup test utilities (pwa-register-react-stub.ts joins setup.ts here)"
  - "PWA client-type reference pattern: any future virtual: module from a Vite plugin gets its triple-slash reference added to src/vite-env.d.ts"

requirements-completed: [PERF-02, PERF-03]  # PERF-01 was the Phase 4 umbrella: cache (04-02), env (04-01), badge (04-04), toast (04-05) — all now landed.

duration: ~5min (17:21:40Z → 17:26:23Z UTC, approximately 283 seconds wall clock)
completed: 2026-04-17
---

# Phase 4 Plan 05: Service Worker + PWA Manifest + Update Toast Summary

**PERF-02/PERF-03 landed — vite-plugin-pwa@^1.2.0 wired into the build emits a Workbox service worker (precache 9 entries, 233 KB) with CacheFirst for floor-plan images, SWR for code chunks, and NetworkOnly for docs.google.com (no double-caching with the localStorage layer). <UpdateToast /> portals to document.body via the Phase 3 precedent, ships with 4 passing tests, and suppresses itself while MapView is open (D-07). index.html gained the Apple PWA meta stack + theme-color + viewport-fit=cover. The app is now installable to home-screen on iOS/Android with offline static-asset support.**

## Performance

- **Duration:** ~5 min (wall clock 13:21 → 13:26 EDT / 17:21:40Z → 17:26:23Z UTC, ~283 seconds)
- **Started:** 2026-04-17T17:21:40Z
- **Completed:** 2026-04-17T17:26:23Z
- **Tasks:** 3 (all committed atomically)
- **Files:** 11 touched (4 created, 7 modified — `package.json` + `package-lock.json` + `vite.config.ts` + `index.html` + `vitest.config.ts` + `src/vite-env.d.ts` + `src/App.tsx`)
- **Test delta:** +4 vitest specs (UpdateToast.test.tsx) — total suite now 37 passing across 8 files (up from 33/7 in plan 04-04)
- **Build delta:** pre-PWA bundle (plan 04-04) was 49 modules / ~220 KB JS; post-PWA is 54 modules / 223.20 KB JS (72.84 KB gzip) + 5.76 KB workbox-window + 1.97 KB sw.js + 22.64 KB workbox-291597b4.js + 0.50 KB manifest.webmanifest + 8.64 KB CSS. Net delta ~30 KB ungzipped for the entire PWA layer.

## Accomplishments

- **PERF-02 landed.** `npm run build` now emits `dist/sw.js` (1,968 B), `dist/workbox-291597b4.js` (22,641 B), and `dist/manifest.webmanifest` (504 B with all required fields — name, short_name, theme_color #2b2d42, background_color #edf2f4, 3 icons including 512-maskable). Build log confirms `PWA v1.2.0 mode generateSW precache 9 entries (233.04 KiB)`.
- **PERF-03 landed.** Workbox config precaches ONLY `**/*.{js,css,html,svg,ico,woff2}` and `globIgnores` excludes `**/floor-plan/**`. Runtime caching stack: (1) CacheFirst for `/floor-plan/*` (30 day TTL, 20 max entries), (2) StaleWhileRevalidate for `request.destination === 'script' || 'style'` (belt-and-suspenders for any chunk that slips past precache), (3) NetworkOnly for `docs.google.com` (the only caching layer for the sheet CSV is the localStorage SWR from plan 04-02 — no two caches fighting). `navigateFallbackDenylist` prevents the SPA fallback from intercepting failed Sheets fetches and serving index.html as a "CSV response".
- **PERF-01 UX capstone.** The Update Toast is the third of three PERF-01 surfaces: (1) localStorage cache (plan 04-02), (2) StalenessBadge (plan 04-04, silent when fresh, "Updated Xm ago" when stale, "Offline — showing cached list" when offline), (3) UpdateToast (this plan — visible only when a new service worker version is waiting AND no MapView is open). Each is silent by default and only surfaces on real state changes.
- **StrictMode-safe.** The useRegisterSW hook is provided by vite-plugin-pwa and is itself StrictMode-safe; the only React effect inside UpdateToast is a single setTimeout with paired clearTimeout in its cleanup. No double-registration risk. Tested via vitest with `vi.useFakeTimers()` + `vi.advanceTimersByTime(10_000)` to prove the 10s auto-dismiss fires exactly once.
- **Portal + suppression pattern applied cleanly.** `createPortal(..., document.body)` mirrors the Phase 3 MapView precedent — the toast escapes the `.card`'s `backdrop-filter` containing block and sits on the viewport, above both the card and the MapView overlay (z-index 9999). The `suppressed` prop gates rendering at the JSX level (component returns null while MapView is open), so the portal DOM node is NOT in the body while suppressed — no invisible-but-present node competing for the `aria-live` region with MapView's `aria-live="polite"`.
- **iOS PWA meta block is complete.** Both `apple-mobile-web-app-capable` AND `mobile-web-app-capable` are shipped (RESEARCH.md Pitfall 4 — Apple's deprecated + the W3C replacement coexist for older iOS). `black-translucent` status bar matches the navy card palette (D-14). `viewport-fit=cover` is set so `env(safe-area-inset-bottom)` on the toast and future content works below the iOS home-indicator.
- **All gates green:** `npx tsc --noEmit` exit 0, `npm run lint` exit 0 (`--max-warnings 0`), `npx vitest run` 8 files / 37 tests passing, `VITE_SHEET_URL=… npm run build` exits 0 with all expected artifacts in `dist/`.

## Task Commits

Each task was committed atomically on branch `dev`:

1. **Task 1 (Vite + HTML):** `689b4a1` — `feat(04-05): register VitePWA plugin + add Apple PWA meta tags`
2. **Task 2 (Component):** `8ad974c` — `feat(04-05): add <UpdateToast /> portal component + vitest virtual-module stub`
3. **Task 3 (App wiring):** `aa9790c` — `feat(04-05): wire <UpdateToast /> into App.tsx with MapView suppression`

## Files Created/Modified

- **Created** `src/components/UpdateToast.tsx` (44 lines) — default-export function component. Reads `useRegisterSW` from `virtual:pwa-register/react`. Returns null when `!needRefresh` OR `suppressed === true`. Otherwise `createPortal(<div.update-toast>…, document.body)` with `role="status" aria-live="polite"`. The red CTA button's onClick fires `updateServiceWorker(true)` — the `true` is load-bearing (SW skipWaiting + window.location.reload). Single `useEffect(() => {…}, [needRefresh, setNeedRefresh])` sets a 10s `window.setTimeout` when `needRefresh` is true and clears it on cleanup (D-05 auto-dismiss).
- **Created** `src/components/UpdateToast.css` (70 lines) — `.update-toast { position: fixed; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom)); transform: translateX(-50%); background: #2b2d42; color: #edf2f4; z-index: 9999; … }`. `.update-toast-btn { background: #d90429; … min-height: 32px; }` honors the 32px tap-target minimum from CONTEXT line 77. `@keyframes slideUpToast` gives a 0.2s fade-in-from-below; `@media (prefers-reduced-motion: reduce)` kills it; `@media (max-width: 600px)` shrinks type.
- **Created** `src/components/UpdateToast.test.tsx` (60 lines) — 4 vitest specs: (1) renders-nothing-when-idle, (2) click-fires-updateServiceWorker(true), (3) suppressed-prop-hides-toast-and-portal, (4) auto-dismiss-after-10s (fake timers). Module-scope `updateSpy`/`setNeedRefresh` vi.fn()s are read lazily by the `vi.mock('virtual:pwa-register/react', …)` factory, so hoisting works cleanly. Each test resets spies in `beforeEach`. `afterEach` calls `vi.useRealTimers()`.
- **Created** `src/test/pwa-register-react-stub.ts` (27 lines) — on-disk stub for `virtual:pwa-register/react`. Exports a no-op `useRegisterSW` with the correct signature (`needRefresh: [boolean, setter]`, `offlineReady: [boolean, setter]`, `updateServiceWorker: (reloadPage?: boolean) => Promise<void>`). NEVER runs at production runtime — vite-plugin-pwa injects the real module. Only activates when `vi.mock(...)` is missing in a test file (as a safety net, not a test path).
- **Modified** `package.json` (+1 line) — added `"vite-plugin-pwa": "^1.2.0"` to `devDependencies`.
- **Modified** `package-lock.json` (regenerated) — 281 packages added, 16 changed, 572 audited. No security advisories block the install; 11 vulnerabilities (2 moderate, 9 high) exist transitively from `@rollup/plugin-commonjs`/etc. — tracked but not blocking PERF-02.
- **Modified** `vite.config.ts` — kept `requireSheetUrl()` plugin from plan 04-01; added `VitePWA({...})` with the full config from RESEARCH.md §1: `registerType: 'prompt'`, `includeAssets: ['apple-touch-icon.png']`, manifest (name/short_name/description/theme_color/background_color/display/orientation/start_url/scope/3 icons), workbox (globPatterns/globIgnores/navigateFallback+Denylist/3 runtimeCaching rules/cleanupOutdatedCaches), devOptions.enabled:true.
- **Modified** `index.html` — head now has: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`, title updated to "Seat Finder — Mahek & Saumya" (matches manifest.name), `<meta name="theme-color" content="#2b2d42">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`, `<meta name="apple-mobile-web-app-title" content="Seat Finder">`. No hand-written `<link rel="manifest">` — the plugin injects it automatically during build to avoid duplication.
- **Modified** `vitest.config.ts` — added `resolve.alias` mapping `virtual:pwa-register/react` → `src/test/pwa-register-react-stub.ts`. Kept `plugins: [react()]`, `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'] }`.
- **Modified** `src/vite-env.d.ts` — added `/// <reference types="vite-plugin-pwa/client" />` as line 2.
- **Modified** `src/App.tsx` (+2 lines) — `import UpdateToast from './components/UpdateToast';` next to the StalenessBadge import; `<UpdateToast suppressed={selectedGuest !== null} />` at the tail of the success-branch JSX, inside `.app-container`, outside `.card`, after the hidden preload `<img>`.

## Decisions Made

- **Combined test + implementation commits per task (same as plan 04-04).** Plan frontmatter is `type: execute`; per-task `tdd="true"` on Task 2 treated RED+GREEN as a single `feat(…)` commit. RED was validated via the runtime sequence: first `npx vitest run` showed `Error: Failed to resolve import "virtual:pwa-register/react"` (the import-analysis failure described in plan's Mocking notes — bigger than a real test failure, proving the inline `vi.mock(...)` alone was insufficient). Second run after the `resolve.alias` fix passed 2/4 specs with 2 cleanup-related DOM errors (`NotFoundError: The node to be removed is not a child of this node`). Third run after removing the manual `clearPortaledToasts()` passed 4/4.
- **Did not use `test.deps.inline` for `virtual:pwa-register/react`** — the RESEARCH.md Mocking notes suggested `inline` as an alternative, but `resolve.alias` is strictly simpler (one line of config + one stub file), has tighter type-safety (the stub's TypeScript signature pins the hook's shape), and works without vi.hoisted() gymnastics. Confirmed no runtime effect: the alias only applies under vitest, not under `npm run dev` or `npm run build` (those use Vite's own plugin resolution, which the VitePWA plugin hooks into first).
- **Did not promote `onRegisterError(err: unknown)` into the production codebase via an eslint rule.** The plan's snippet had `onRegisterError(err) { … }` with implicit `any` — fine under the plugin's inferred types in real use, but the test-time stub's simplified type signature widens to the point where strict mode complains. Added `err: unknown` inline as a one-off; did NOT add `// @ts-expect-error` or similar. Clean, honest typing.
- **Kept the inline navigateFallback: 'index.html' in devOptions.** The plan says `devOptions.navigateFallback: 'index.html'` and that's what shipped. This is specifically for the dev-mode SW so `npm run dev` under the plugin still routes unknown URLs through the SPA shell.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `virtual:pwa-register/react` unresolvable at tsc and vitest import-analysis**

- **Found during:** Task 2, first `npx tsc --noEmit` + first `npx vitest run` after writing UpdateToast.tsx.
- **Issue:** Two separate blocking failures in the same root cause:
  - `tsc`: `src/components/UpdateToast.tsx(3,31): error TS2307: Cannot find module 'virtual:pwa-register/react' or its corresponding type declarations.`
  - `vitest`: `Error: Failed to resolve import "virtual:pwa-register/react" from "src/components/UpdateToast.tsx". Does the file exist?` — Vite's import-analysis runs before vi.mock() factories apply, so the virtual specifier must resolve to SOMETHING on disk before the mock can override it.
- **Fix (two parts):**
  - Added `/// <reference types="vite-plugin-pwa/client" />` to `src/vite-env.d.ts` line 2. This pulls in the plugin's ambient module declarations (`node_modules/vite-plugin-pwa/client.d.ts` → `react.d.ts`) so `tsc` understands the virtual specifier.
  - Created `src/test/pwa-register-react-stub.ts` (27 lines, no-op `useRegisterSW`) and aliased the virtual specifier to it in `vitest.config.ts` via `resolve.alias`. Tests still call `vi.mock(...)` for behavior assertions; the alias exists only to satisfy import-analysis.
- **Files modified:** `src/vite-env.d.ts` (+1 line), `vitest.config.ts` (+13 lines), `src/test/pwa-register-react-stub.ts` (new, 27 lines).
- **Verification:** Second `npx tsc --noEmit` clean. Second `npx vitest run src/components/UpdateToast.test.tsx` ran the tests (previously crashed at import).
- **Committed in:** `8ad974c` (bundled with Task 2's component — inseparable).
- **Plan coverage:** The plan's Mocking notes mention this scenario ("If vitest complains it can't resolve `virtual:pwa-register/react` even with the mock (hoisting edge case), add it to `vitest.config.ts` `test.deps.inline` or use the `vi.hoisted(() => ...)` pattern. Try the plain mock first."). The plain mock was tried and insufficient; I opted for `resolve.alias` instead of `test.deps.inline` because it's a clearer expression of intent (the module is virtual; point tests at a stub) and has tighter typing via the on-disk stub.

**2. [Rule 1 — Bug] Implicit-any on `onRegisterError(err)` callback parameter**

- **Found during:** Task 2, the first tsc run after writing UpdateToast.tsx.
- **Issue:** `src/components/UpdateToast.tsx(18,21): error TS7006: Parameter 'err' implicitly has an 'any' type.` The plan's snippet has `onRegisterError(err) { … }` which relies on the callback's declared signature from the plugin's types — but under the test-time stub's simplified signature, that inference widens and strict mode complains.
- **Fix:** Changed the parameter to `onRegisterError(err: unknown)` — explicit typing is cheap and correct (the SW registration error is truly `unknown` from the component's point of view).
- **Files modified:** `src/components/UpdateToast.tsx` (1 line).
- **Verification:** tsc clean after the change; `console.error('[sw] register error', err)` works fine with `unknown` because `console.error` accepts any arg list.
- **Committed in:** `8ad974c`.

**3. [Rule 1 — Bug] Test-suite `NotFoundError` from manual portal cleanup in afterEach**

- **Found during:** Task 2, second `npx vitest run src/components/UpdateToast.test.tsx` — 2 specs passed, 2 failed with `NotFoundError: The node to be removed is not a child of this node.`
- **Issue:** My initial test draft included a `clearPortaledToasts()` helper in `afterEach` that ran `document.querySelectorAll('.update-toast').forEach((n) => n.remove())`. testing-library's own `afterEach` (registered via its auto-cleanup feature + the `setupFiles` pattern) ALSO unmounts the rendered tree, which triggers React's portal cleanup — so by the time my helper ran, the DOM node was already being removed or had been queued for removal. React's commit-phase then tried to remove a node that was no longer a child of its parent → DOMException.
- **Fix:** Removed the `clearPortaledToasts()` helper from both `beforeEach` and `afterEach`. testing-library's automatic cleanup handles the portal correctly. Kept the `document.querySelector('.update-toast')` assertions in the test bodies — they still work because each test's render mounts a fresh toast and the auto-cleanup tears it down before the next test.
- **Files modified:** `src/components/UpdateToast.test.tsx` (-7 lines).
- **Verification:** Third run passed 4/4 specs; full suite `npx vitest run` passed 37/37 across 8 files.
- **Committed in:** `8ad974c`.

### Auth Gates

None. No authentication work in this plan.

---

**Total deviations:** 3 auto-fixed (1 blocking + 2 bugs) — all caught by the gate sequence (tsc → vitest → full suite). No architectural changes, no user consultation required.
**Impact on plan:** Zero user-facing delta. The plan's component shape, CSS, and App.tsx wiring are verbatim what shipped. The three deviations were infrastructural issues the plan anticipated ("If vitest complains…") or strict-mode typing tightenings that the plan's snippet didn't explicitly call out but that tsconfig.json's `strict: true` demands.

## Issues Encountered

- **npm install surfaced 11 transitive vulnerabilities (2 moderate, 9 high).** These are from the Workbox toolchain's transitive deps (`@rollup/plugin-commonjs`, etc.) — not from `vite-plugin-pwa` itself. Out of scope for this plan (Rule "SCOPE BOUNDARY: Only auto-fix issues DIRECTLY caused by the current task's changes"). `npm audit fix` would require breaking changes in the rollup toolchain; defer to a phase-boundary housekeeping plan or upstream resolution.
- **npm deprecation warnings** for `sourcemap-codec@1.4.8`, `glob@11.1.0`, `source-map@0.8.0-beta.0` — all transitive from the same toolchain. Same resolution as above: deferred.
- **`.omc/` directory is untracked** (pre-existing from before this plan). Not touched; not committed. Should be added to `.gitignore` or cleaned up as housekeeping in a later plan — flagged to `deferred-items.md` (but the file doesn't exist yet in this phase, so noting here).

## Known Stubs

**1. `src/test/pwa-register-react-stub.ts`** — by design. This is a **test-only** stub that exists because `virtual:pwa-register/react` has no on-disk counterpart for Vitest's import-analysis to resolve. It never runs in `npm run dev` or `npm run build` — Vite/VitePWA's plugin resolver injects the real module before this stub would apply. This is NOT a UI stub or a functionality gap; it is the canonical testing pattern for Vite virtual modules. Clearly documented in the file's header comment.

Nothing else is stubbed. The toast copy is real (plan-locked verbatim), the SW is real (Workbox-generated), the manifest is real (VitePWA-generated with real values from vite.config.ts), and the icons are real (plan 04-03 generated them from a source SVG).

## Build output sizes (per plan's output spec)

- `dist/sw.js`: **1,968 B** (1.97 KB)
- `dist/workbox-291597b4.js`: **22,641 B** (22.64 KB) — the Workbox runtime that sw.js imports
- `dist/assets/workbox-window.prod.es5-BIl4cyR9.js`: 5,756 B (5.76 KB / 2.37 KB gzip) — the page-side Workbox client shipped to the main bundle
- `dist/manifest.webmanifest`: **504 B**
- Total PWA-layer footprint at build time: ~31 KB ungzipped (~12 KB gzipped) on top of the plan 04-04 baseline of 220 KB JS / 7.74 KB CSS.

## Dev-mode SW registration (per plan's output spec)

`devOptions.enabled: true` is set in `vite.config.ts` per D-17. Did NOT run `npm run dev` as part of plan execution (the plan's verify automated block didn't include it, and dev-mode SW is a manual browser-devtools verification, not a CI gate). Expected behavior: on `npm run dev`, the plugin generates a dev SW at `/dev-sw.js?dev-sw` and the page registers it; Chrome DevTools → Application → Service Workers should show "activated and is running". No HMR workarounds needed — the plugin's dev SW is non-caching (documented in vite-plugin-pwa README), so Vite's HMR is untouched. If the wedding-day deploy surfaces any HMR flakes, the fallback is to set `devOptions.enabled: false` and run `npm run preview` for SW testing instead. Plan 04-06 (build verification) will exercise the real production SW.

## virtual:pwa-register/react mock config (per plan's output spec)

- **Required config beyond inline `vi.mock(...)`:** YES. Two additions:
  1. `resolve.alias['virtual:pwa-register/react'] = resolve(__dirname, 'src/test/pwa-register-react-stub.ts')` in `vitest.config.ts`.
  2. `/// <reference types="vite-plugin-pwa/client" />` in `src/vite-env.d.ts`.
- **Did NOT need `test.deps.inline` or `vi.hoisted(…)`.** The `resolve.alias` approach is simpler and type-cleaner.
- **Stub import is safe at production:** the stub only loads under the `vitest` resolution path; `npm run dev` / `npm run build` use Vite's own resolution which goes through vite-plugin-pwa's virtual-module handler first.

## Next Plan Readiness

- **Plan 04-06 (PWA manifest + installability validation):** All PWA build artifacts exist at `dist/sw.js`, `dist/workbox-*.js`, `dist/manifest.webmanifest`, and 4 icon PNGs at `dist/pwa-192.png` / `dist/pwa-512.png` / `dist/pwa-512-maskable.png` / `dist/apple-touch-icon.png`. The manifest contains name/short_name/theme_color #2b2d42/background_color #edf2f4/3 icons/standalone/portrait/start_url:'/'/scope:'/'. Ready for plan 04-06 to validate the installability contract (Chrome DevTools → Application → Manifest + Lighthouse PWA score + real-device install test).
- **No blockers.**

## Self-Check: PASSED

File existence:
- FOUND: src/components/UpdateToast.tsx
- FOUND: src/components/UpdateToast.css
- FOUND: src/components/UpdateToast.test.tsx
- FOUND: src/test/pwa-register-react-stub.ts
- FOUND: package.json (modified)
- FOUND: package-lock.json (modified)
- FOUND: vite.config.ts (modified)
- FOUND: index.html (modified)
- FOUND: vitest.config.ts (modified)
- FOUND: src/vite-env.d.ts (modified)
- FOUND: src/App.tsx (modified)

Commits (dev branch):
- FOUND: 689b4a1 (Task 1 — feat: VitePWA + Apple meta tags)
- FOUND: 8ad974c (Task 2 — feat: UpdateToast portal component + vitest stub)
- FOUND: aa9790c (Task 3 — feat: App.tsx wiring)

Gates:
- `npx tsc --noEmit`: clean (exit 0)
- `npm run lint`: clean (exit 0, `--max-warnings 0`)
- `npx vitest run`: 8 files, 37 tests, all passing
- `npx vitest run src/components/UpdateToast.test.tsx`: 4/4 pass
- `VITE_SHEET_URL=… npm run build`: 54 modules → 223.20 KB JS / 8.64 KB CSS, PWA v1.2.0 generateSW mode, 9 precache entries / 233.04 KiB
- Plan invariants grep (Task 1): `VitePWA`, `registerType: 'prompt'`, `'Seat Finder — Mahek & Saumya'`, `theme_color: '#2b2d42'`, `background_color: '#edf2f4'`, `globPatterns: ['**/*.{js,css,html,svg,ico,woff2}']`, `CacheFirst`, `StaleWhileRevalidate`, `NetworkOnly`, `devOptions:`, `apple-touch-icon`, `theme-color`, `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `viewport-fit=cover` — all present
- Plan invariants grep (Task 2): `virtual:pwa-register/react`, `createPortal`, `New version available`, `updateServiceWorker(true)`, `AUTO_DISMISS_MS = 10_000`, `suppressed`, `.update-toast`, `env(safe-area-inset-bottom)` — all present
- Plan invariants grep (Task 3): `import UpdateToast from './components/UpdateToast'`, `<UpdateToast suppressed={selectedGuest !== null} />` — both present
- Build artifacts: `dist/sw.js`, `dist/manifest.webmanifest`, `dist/pwa-192.png`, `dist/pwa-512.png`, `dist/pwa-512-maskable.png`, `dist/apple-touch-icon.png` — all present

---
*Phase: 04-performance-offline*
*Completed: 2026-04-17*
