# Phase 4: Performance & Offline — Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Discuss mode:** User delegated all 4 gray areas — "You make a decision on these, I don't care too much about it." Decisions below are Claude's calls, optimized for a one-weekend wedding event and minimal guest-side friction.

<domain>
## Phase Boundary

Ship PERF-01 through PERF-04 from REQUIREMENTS.md:

- **PERF-01** — Guest list cached in localStorage via stale-while-revalidate (24h TTL, network-first with stale fallback).
- **PERF-02** — App is installable as a PWA with offline support for static assets via service worker.
- **PERF-03** — Service worker precaches same-origin static assets only (never the Google Sheets CSV).
- **PERF-04** — Google Sheets URL is configurable via `VITE_SHEET_URL` (build-time env var).

Success criteria (from ROADMAP.md):
1. A guest who loaded the app earlier can still search for their name when venue WiFi drops — the cached guest list is served from localStorage.
2. The app can be added to a phone's home screen and opens without a browser URL bar.
3. Static assets (JS, CSS, images) load from the service worker cache on repeat visits — no network round trip.
4. The Google Sheets URL is not hardcoded — changing it requires only an environment variable update.

**Not in scope** (belongs to other phases or the backlog):
- Background sync of guest data
- Push notifications / "your table moved" alerts
- Compressing or paginating the CSV payload
- Admin tooling for editing the sheet (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Guest-list cache (PERF-01)
- **D-01:** Algorithm = network-first with 2s timeout, fall back to localStorage cache. On success, refresh the cache even before the 24h TTL. Hard expiry at 24h (if cache is older than 24h AND network fails, surface an error with retry).
- **D-02:** Cache key = `seatfinder.guests.v1`. Version bump (`v2` etc.) is the escape hatch for breaking-schema changes — the old entry is ignored, not migrated.
- **D-03:** Stored shape = `{ fetchedAt: ISO8601 string, guests: Guest[] }`. `fetchedAt` drives the TTL check and the "last updated" display.
- **D-04:** Cache writes happen in `services/googleSheets.ts` after the successful `fetchGuests()` call; cache reads happen in `App.tsx` `loadGuests()` as the fast-path before starting the fetch.

### Update UX when a new deploy lands
- **D-05:** When the service worker detects a new version in the waiting state, show a slim toast pinned to the bottom of the screen: "New version available — tap to refresh." Tapping calls `SKIP_WAITING` then `window.location.reload()`. Toast auto-dismisses after 10 seconds.
- **D-06:** Toast styling follows the existing brand palette: navy background (`#2b2d42`), white text, red accent (`#d90429`) for the tap target. Radius 10px matching the overlay card. Slides up from below with the existing `mapSlideDown` timing (inverted) so it feels part of the app.
- **D-07:** During check-in flow (when a `MapView` is open), suppress the toast until the map is closed — don't interrupt a guest mid-lookup. Re-queue once `selectedGuest` is null.

### Offline / stale-data indicator
- **D-08:** Silent by default while fresh and online. If the cached guest list is >1h old OR the most recent fetch failed, show a muted "Updated Xm ago" badge in the card header next to "Welcome!". Tapping the badge triggers an explicit refetch.
- **D-09:** When `navigator.onLine === false`, change the badge to "Offline — showing cached list" in muted slate (`#8d99ae`). No modal, no blocker — search continues to work against the cached list.
- **D-10:** If a fetch is attempted and all cached data is >24h old, surface the existing error card (from Phase 1) with copy: "Can't reach the guest list. Ask staff for directions or try again in a moment." — same Retry button wiring.

### Install-to-homescreen prompt UX
- **D-11:** No proactive install prompt. Rely on browser-native "Add to Home Screen" via the share sheet / menu. Reason: most guests scan the QR once and use once; an install prompt is noise. The PWA manifest still enables install for guests who want it.
- **D-12:** Do include an iOS-friendly meta config (`apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`) so that guests who DO add to homescreen get a proper app-like experience (no Safari chrome, themed status bar).

### PWA branding
- **D-13:** App name = `"Seat Finder — Mahek & Saumya"`. Short name (homescreen label) = `"Seat Finder"`.
- **D-14:** Theme color = `#2b2d42` (navy). Background color = `#edf2f4` (light gray). Matches the existing app card + overlay card palette.
- **D-15:** Icon = flat red teardrop pin (matching the assigned-table pin used in `MapView`) on a white rounded-square background with proper maskable safe zone. Required sizes: 192×192, 512×512, maskable 512×512. Script the generation from a single source SVG (`scripts/generate-pwa-icons.mjs` using `sharp`, which is already installed from Phase 3). Apple touch icon = 180×180 derived from the same source, centered with no mask (iOS handles its own rounding).
- **D-16:** Splash screens on iOS are derived from `apple-touch-icon` + background color — do not hand-author per-device splash PNGs.

### Env var (PERF-04)
- **D-17:** `VITE_SHEET_URL` is a build-time env var. The existing hardcoded URL in `services/googleSheets.ts` is replaced with `import.meta.env.VITE_SHEET_URL`. Ship a `.env.example` checked into the repo documenting the variable; real `.env` stays gitignored.
- **D-18:** If the env var is missing at build time, fail the build with a clear error (`throw new Error('VITE_SHEET_URL is required')` in the service module). Don't silently fall back to a default.
- **D-19:** No runtime override. A sheet-URL change requires a redeploy. Acceptable for a one-event app.

### Claude's Discretion
- Service worker implementation library: the researcher should evaluate `vite-plugin-pwa` (Vite-native Workbox wrapper) as the default choice; an alternative would be surprising. Planner picks exact cache strategies (CacheFirst for images, StaleWhileRevalidate for JS/CSS, NetworkOnly for the Google Sheets URL).
- Toast component: hand-rolled, no new dependency. Follows existing brand patterns from `MapView.css` and `App.css`.
- Icon source SVG: Claude may draft it inline in the PNG-generation script or as a committed `.svg` file; either is fine.
- Test approach: the existing vitest infrastructure from Phase 3 stays. Add tests for the cache module (stale fallback, TTL expiry, version-bump invalidation) and for the update-toast render/click behavior. Service worker registration is integration-tested via `npm run build` + a smoke test that the manifest + SW file ship in `dist/`.

</decisions>

<specifics>
## Specific Ideas

- **Toast affordance**: like the "New version available — tap to refresh" pattern on [web.dev/service-worker-lifecycle](https://web.dev/service-worker-lifecycle/) — slim, non-blocking, pinned bottom-center, tap-to-update.
- **Cache staleness badge**: tiny and muted — "Updated 12m ago" in the same visual family as the placeholder text in `SearchForm.css`. Tap target ≥ 32px even if the visual is smaller.
- **Icon aesthetic**: single-concept — the red teardrop pin from the map, because that's the phase-3 visual language the app is building on. Don't design a separate logo from scratch.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/REQUIREMENTS.md` — PERF-01 through PERF-04 exact wording (the contract).
- `.planning/ROADMAP.md` — Phase 4 success criteria (truths that must hold after this phase).
- `.planning/PROJECT.md` — Project-level constraints: React/Vite/TS, static hosting, mobile-first, 1-2 month timeline, wedding on 2026-05-24.

### Existing code this phase builds on
- `src/services/googleSheets.ts` — PERF-01 and PERF-04 modify this file. Already has try/catch + re-throw error pattern — preserve it, layer caching on top.
- `src/App.tsx` — Owns `loadGuests()` and the loading/error UI. Cache fast-path lives here; update-toast mounts here.
- `src/App.css` + `src/components/MapView.css` — Brand palette (`#2b2d42`, `#d90429`, `#8d99ae`, `#edf2f4`), radii (10/20px), animation curves. Toast + badge must live inside this palette.
- `index.html` — PWA manifest `<link>` tag + Apple meta tags mount here.
- `scripts/generate-images.mjs` — Phase 3 precedent for a sharp-based asset generation script. Mirror its shape for `scripts/generate-pwa-icons.mjs`.
- `vite.config.ts` — Minimal today; Phase 4 adds `vite-plugin-pwa` config here.

### Phase 3 lessons still active in Phase 4
- `src/main.tsx` — `StrictMode` stays enabled. Any effects Phase 4 adds (SW registration, update listeners) must survive StrictMode's mount → cleanup → mount cycle. Use ref-guarded patterns like `MapView.tsx` already does.
- `src/components/MapView.tsx` — Portal pattern used to escape `.card`'s `backdrop-filter` containing block. If the update-toast uses `position: fixed`, either portal it to `document.body` or render it outside the `.card` in `App.tsx`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sharp` — already installed (Phase 3). Powers PWA icon generation without adding a dep.
- `vitest` + `@testing-library/react` + `jsdom` — already wired (Phase 3). Cache module + toast tests use this.
- Brand CSS tokens — locked by UI-SPEC. Phase 4 reuses them directly.
- Error-card UI in `App.tsx` — already handles the "couldn't load" path; Phase 4's stale-hard-fail routes to the same component.

### Established Patterns
- Service functions in `src/services/` return parsed domain types (`Guest[]`) and throw user-facing `Error` messages. Cache wrapper must preserve this contract.
- `main.tsx` uses `<StrictMode>`. SW registration effect must be idempotent under StrictMode double-invoke.
- `index.html` has a single entry point, no router. SPA shape works with precache + runtime-cache SW strategies without complex navigation handling.
- Vite build outputs everything to `dist/`; deploy is whatever static host the user picks. SW registration must use `import.meta.env.BASE_URL` to stay host-agnostic.

### Integration Points
- `services/googleSheets.ts` — inject localStorage SWR layer around `fetchGuests()`.
- `App.tsx:22` `useEffect(() => loadGuests(), [])` — replace with cache-first fast-path; trigger background refresh in parallel.
- `App.tsx` return tree — mount `<UpdateToast />` alongside the card + MapView portal, suppressed when `selectedGuest` is non-null.
- `index.html` head — add `<link rel="manifest">`, apple-touch-icon, theme-color meta.
- `vite.config.ts` — register `VitePWA` plugin with `registerType: 'prompt'` (not `autoUpdate`) so D-05's toast controls the moment of reload.
- `public/` (new `public/pwa/` subdirectory) — generated icon assets land here.
- `.env.example` — new file, documents `VITE_SHEET_URL`.
- `package.json` scripts — add `generate-pwa-icons` mirroring `generate-images`.

</code_context>

<deferred>
## Deferred Ideas

Captured for the roadmap backlog (`.planning/phases/999-backlog/`) — explicitly out of scope for Phase 4:

- **Runtime sheet URL override** (e.g., `?sheet=...` query param) — not needed for a single-event app; revisit if Seat Finder ever gets reused.
- **Admin force-refresh UI** — day-of edit flow is handled by D-08's tap-to-refresh badge; a dedicated admin mode is overkill for one weekend.
- **Background sync / push notifications for table changes** — cool but requires a backend. Reception-day safety net is "ask staff at the door," per the D-10 fallback copy.
- **Per-row cache diffing / last-modified header** — would be an optimization if the guest list ever hits hundreds of rows; current CSV is small enough that full-list refresh is fine.
- **Compression or pagination of the CSV payload** — premature; the file is <100KB today.
- **Install-prompt CTA** — rejected in D-11 for UX noise; could be revisited for a future reusable version of the app.
- **Per-device iOS splash screens** — rejected in D-16 in favor of the auto-generated minimal splash; revisit only if the default looks broken on an iPhone in the wild.

</deferred>

---

*Phase: 04-performance-offline*
*Authored: 2026-04-17 by Claude (decisions delegated by user)*
