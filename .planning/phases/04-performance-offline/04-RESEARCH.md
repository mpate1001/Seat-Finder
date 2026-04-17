# Phase 4: Performance & Offline — Research

**Researched:** 2026-04-17
**Domain:** PWA enablement, offline cache, update UX, icon pipeline
**Confidence:** HIGH (vite-plugin-pwa, Workbox, sharp) / MEDIUM (iOS meta-tag transition, localStorage quota on iOS private mode)

## Summary

This phase converts Seat-Finder into an installable, offline-capable PWA while keeping the existing React/Vite/TypeScript stack intact. All 19 user decisions from `04-CONTEXT.md` are locked; this document supplies only the wiring details the planner needs to create tasks for PERF-01..PERF-04.

The recommended integration is: (1) add `vite-plugin-pwa` with `registerType: 'prompt'` so we control the update toast, (2) wrap `fetchGuests()` in a localStorage-backed network-first-with-timeout wrapper, (3) mount a `<UpdateToast />` portal driven by `useRegisterSW`, (4) extend `scripts/generate-images.mjs` (or add `scripts/generate-pwa-icons.mjs`) to emit 192/512/maskable icons from an inline teardrop-pin SVG, and (5) replace the hard-coded `SHEET_URL` constant with `import.meta.env.VITE_SHEET_URL` guarded at module load.

**Primary recommendation:** Use `vite-plugin-pwa` v1.x (Vite 6 compatible) with Workbox's `generateSW` strategy, register via `virtual:pwa-register/react`'s `useRegisterSW` hook, and isolate all cache-key versioning in a single `src/services/guestsCache.ts` module.

## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim summary — do not revisit)

- **D-01** Cache storage: `localStorage` only (no IndexedDB).
- **D-02** Cache strategy: network-first with 2000 ms `AbortController` timeout; on timeout or network error → serve cached copy.
- **D-03** Cache TTL: 24 hours hard expiry. After 24h with no network, throw user-facing error reusing the existing error card UI.
- **D-04** Cache key: `seatfinder.guests.v1`. Cache shape: `{ fetchedAt: ISOString, guests: Guest[] }`.
- **D-05** Update UX: `registerType: 'prompt'`. Bottom toast "New version available — tap to refresh" with auto-dismiss after 10s.
- **D-06** Toast is suppressed (hidden) while MapView is open to avoid visual conflict with the pan/zoom canvas.
- **D-07** Offline indicator: silent when cache is fresh (<1h) and online; show "Updated Xm ago" badge when cache >1h old OR `navigator.onLine === false`.
- **D-08** No proactive install prompt — rely on browser-native install UX (address-bar icon / iOS share sheet).
- **D-09** PWA name: "Seat Finder — Mahek & Saumya". Short name: "Seat Finder".
- **D-10** Branding: red teardrop pin icon, fill `#d90429`, white stroke, reusing MapView's inline SVG shape (FloorPlan.tsx:87-104).
- **D-11** Theme color: `#2b2d42` (navy). Background color: `#2b2d42` to match splash.
- **D-12** Icon sizes: 192×192, 512×512 normal, 512×512 maskable. Apple touch: 180×180.
- **D-13** `VITE_SHEET_URL` is a build-time env var. Build MUST fail if missing.
- **D-14** `.env.example` checked into repo; `.env.local` gitignored.
- **D-15** No asset precache for floor plan images (they are already routed via CacheFirst runtime rule).
- **D-16** No per-device Apple splash PNGs — default status bar behavior is acceptable.
- **D-17** Dev mode: PWA enabled via `devOptions.enabled: true` for local testing but dev SW is non-caching.
- **D-18** Versioning: rely on `vite-plugin-pwa`'s built-in precache revision hashing; no manual version string.
- **D-19** Test coverage: vitest unit tests for cache wrapper + UpdateToast; build-time smoke test that `dist/sw.js` exists.

### Claude's Discretion (resolved in this research)

- Library: `vite-plugin-pwa` v1.x (latest stable compatible with Vite 6) — confirmed.
- Icon generator: extend sharp pipeline already used for floor plan image variants.
- Cache corruption handling: treat JSON.parse failure or schema mismatch as cache-miss (silent).

### Deferred Ideas (OUT OF SCOPE)

- IndexedDB, Background Sync, Push Notifications.
- Custom install prompt / `beforeinstallprompt` capture.
- Per-device Apple splash PNGs.
- Workbox Background Sync queue for Google Sheets fetches.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | App must be installable as a PWA on iOS and Android | `vite-plugin-pwa` manifest + icons + Apple meta tags (sections 1, 6, 7) |
| PERF-02 | Guest data must survive offline (24h TTL, network-first) | localStorage SWR wrapper with AbortController (section 4) |
| PERF-03 | App shell works offline; updates are user-prompted | Workbox precache + `useRegisterSW` prompt flow (sections 1, 2) |
| PERF-04 | Environment configuration via `VITE_SHEET_URL` with fail-fast | `import.meta.env` guard at service module load (section 8) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Service worker lifecycle (install/activate/update) | Browser / SW | Vite build (emits sw.js) | Workbox-generated SW runs in the browser; build emits it |
| App shell precache (JS/CSS/HTML) | Browser / SW | Vite build (manifest) | Workbox computes revisions at build time, serves from SW at runtime |
| Guest CSV runtime cache | Browser (localStorage) | Fetch API | App-layer decision: TTL + shape are domain-specific, not URL-generic |
| Floor plan image runtime cache | Browser / SW (Cache API) | — | `CacheFirst` via Workbox `runtimeCaching` — pure URL match |
| Update notification UX | Browser (React) | SW (postMessage) | `useRegisterSW` bridges SW `waiting` state to React state |
| Env var injection | Vite build | — | `import.meta.env.VITE_*` is inlined at build time |
| Icon asset generation | Build script (Node/sharp) | — | Run once or on-demand; output is static files in `public/` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite-plugin-pwa` | ^1.0.0 (verify latest via `npm view vite-plugin-pwa version`) | PWA plugin: manifest, SW registration, Workbox integration | Official Vite-ecosystem PWA solution; maintained by Vite team member Anthony Fu's org; used by Nuxt/Vitepress [CITED: https://vite-pwa-org.netlify.app/] |
| `workbox-window` | (transitive via vite-plugin-pwa) | SW registration & lifecycle bridge in the browser | Google-maintained; handles `waiting` → `controlling` transitions safely [CITED: https://developer.chrome.com/docs/workbox/modules/workbox-window] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sharp` | ^0.34.5 (already installed) | Rasterize SVG → PNG for PWA icons | All PWA icon generation; reuse pipeline from `scripts/generate-images.mjs` |
| `vitest` | ^4.1.4 (already installed) | Unit + component tests | Cache wrapper tests, UpdateToast component test |
| `@testing-library/react` | ^16.3.2 (already installed) | UpdateToast render tests | Mock `virtual:pwa-register/react` via `vi.mock` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vite-plugin-pwa` | Raw Workbox CLI + custom `navigator.serviceWorker.register` | More control but >200 lines of boilerplate; reinvents manifest handling; NOT recommended for this project's scope |
| `vite-plugin-pwa` `generateSW` mode | `injectManifest` mode (custom `src/sw.ts`) | `injectManifest` needed only when you write custom SW logic (push, bg-sync). We don't — `generateSW` is sufficient. [CITED: https://vite-pwa-org.netlify.app/guide/inject-manifest.html] |
| localStorage | IndexedDB (via `idb` package) | IDB is async/robust but overkill for ~500 guest records (<100KB). localStorage is synchronous and simpler. Explicitly rejected in D-01. |

**Installation:**
```bash
npm install --save-dev vite-plugin-pwa
# Workbox deps are hoisted automatically by vite-plugin-pwa.
```

**Version verification (before implementation):**
```bash
npm view vite-plugin-pwa version        # should print 1.x
npm view vite-plugin-pwa peerDependencies  # should list vite >=5 (works with 6)
```
[CITED: https://www.npmjs.com/package/vite-plugin-pwa] — confirm publish date < 90 days before committing to version.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌──────────────────────────────────────┐
                    │           Guest Device (Browser)      │
                    │                                       │
   QR scan ───────► │  ┌─────────────┐    ┌─────────────┐  │
                    │  │  index.html │───►│   main.tsx  │  │
                    │  │  (cached)   │    │ StrictMode  │  │
                    │  └──────┬──────┘    └──────┬──────┘  │
                    │         │                  │         │
                    │         ▼                  ▼         │
                    │  ┌──────────────────────────────┐    │
                    │  │    <App />                   │    │
                    │  │   ┌──────────────────────┐   │    │
                    │  │   │  <UpdateToast /> ────┼───┼────┼──► useRegisterSW ◄── SW 'waiting'
                    │  │   │  (portal to body)    │   │    │
                    │  │   └──────────────────────┘   │    │
                    │  │   ┌──────────────────────┐   │    │
                    │  │   │  SearchForm → Map    │   │    │
                    │  │   └──────────┬───────────┘   │    │
                    │  │              │               │    │
                    │  │   fetchGuestsCached(url)     │    │
                    │  └──────────────┼───────────────┘    │
                    │                 │                    │
                    │        ┌────────┴────────┐           │
                    │        ▼                 ▼           │
                    │  ┌──────────┐      ┌───────────┐     │
                    │  │  fetch() │      │localStorage│    │
                    │  │ 2s Abort │      │seatfinder. │    │
                    │  │  Ctrl    │      │ guests.v1  │    │
                    │  └────┬─────┘      └───────────┘     │
                    │       │ on timeout/error → read cache│
                    │       │                              │
                    │       ▼                              │
                    │  ┌───────────────────────────────┐   │
                    │  │  Service Worker (Workbox)     │   │
                    │  │  ┌─────────────────────────┐  │   │
                    │  │  │ Precache (app shell)    │  │   │
                    │  │  │ JS/CSS/HTML w/ revision │  │   │
                    │  │  └─────────────────────────┘  │   │
                    │  │  ┌─────────────────────────┐  │   │
                    │  │  │ Runtime: /floor-plan/*  │  │   │
                    │  │  │   → CacheFirst (30d)    │  │   │
                    │  │  │ Runtime: VITE_SHEET_URL │  │   │
                    │  │  │   → NetworkOnly         │  │   │
                    │  │  └─────────────────────────┘  │   │
                    │  └───────────────────────────────┘   │
                    └──────────────────────────────────────┘
                                    │
                                    ▼ network
                    ┌──────────────────────────────────────┐
                    │       Google Sheets CSV endpoint     │
                    │       (VITE_SHEET_URL)               │
                    └──────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── services/
│   ├── googleSheets.ts       # existing — refactor to accept url param
│   └── guestsCache.ts        # NEW — localStorage SWR wrapper
├── components/
│   └── UpdateToast.tsx       # NEW — portal-mounted toast
├── pwa/                      # NEW directory
│   ├── useAppUpdate.ts       # NEW — thin wrapper over useRegisterSW
│   └── useOnlineStatus.ts    # NEW — navigator.onLine + events hook
├── vite-env.d.ts             # UPDATE — add VITE_SHEET_URL typing
└── App.tsx                   # UPDATE — call fetchGuestsCached + mount UpdateToast

public/
├── pwa-192.png               # NEW — generated by script
├── pwa-512.png               # NEW
├── pwa-512-maskable.png      # NEW
└── apple-touch-icon.png      # NEW (180×180)

scripts/
├── generate-images.mjs       # existing — floor plan variants
└── generate-pwa-icons.mjs    # NEW — icon pipeline

.env.example                  # NEW — VITE_SHEET_URL=...
.env.local                    # gitignored
```

### Pattern 1: `vite-plugin-pwa` `registerType: 'prompt'`

**What:** SW is installed on page load, but when a new version is detected the `waiting` SW is held until the app calls `updateServiceWorker(true)`. We surface that call behind a React toast.

**When to use:** Any time the user is mid-task and an auto-reload would disrupt them (exactly our MapView case per D-06).

**Example** (source: [vite-pwa-org.netlify.app/guide/prompt-for-update.html](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html)):

```ts
import { useRegisterSW } from 'virtual:pwa-register/react';

const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } =
  useRegisterSW({
    onRegisteredSW(swUrl, r) { /* optional */ },
    onRegisterError(err) { console.error('SW register error', err); },
  });
```

### Pattern 2: Network-First-With-Timeout (app-layer, not Workbox)

**What:** For the CSV fetch we do NOT use Workbox's `NetworkFirst` strategy because we need: (a) custom 2s timeout (Workbox default is 10s), (b) control over cache shape (`{fetchedAt, guests}`), (c) 24h hard expiry with user-facing error. A Workbox runtime rule would cache the raw CSV response; we cache the parsed Guest[].

**When to use:** Any app-data endpoint whose freshness + error surface is domain-specific. Generic URL caching goes to Workbox; semantic caching goes to app layer.

### Anti-Patterns to Avoid

- **Two caches fighting:** Do NOT put the Sheets URL in Workbox `runtimeCaching` AND the localStorage wrapper. The Sheets URL is `NetworkOnly` at the SW layer so it never hits the Cache API; all caching for that URL lives in `guestsCache.ts`.
- **Reading cache on success:** After a successful network fetch, write to cache BEFORE returning; do not read-then-write.
- **Version drift:** Every breaking schema change to the cached shape MUST bump `v1` → `v2` in the key constant, so stale entries are treated as cache-miss.
- **Toast inside `.card`:** The toast must `createPortal` to `document.body` so it escapes the app's normalized card layout (same pattern MapView uses for its enlarged modal).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SW generation + precache manifest | Custom `self.addEventListener('install', ...)` SW | `vite-plugin-pwa` `generateSW` | Workbox computes file hashes; hand-rolled SWs almost always miss edge cases around `skipWaiting` / `clients.claim` sequencing [CITED: https://developer.chrome.com/docs/workbox/] |
| SW registration + update detection | `navigator.serviceWorker.register(...)` + polling for updates | `useRegisterSW` from `virtual:pwa-register/react` | Handles StrictMode double-mount, `updatefound` event, periodic checks [CITED: https://vite-pwa-org.netlify.app/frameworks/react.html] |
| Manifest.json authoring | Hand-written `manifest.webmanifest` | `VitePWA({ manifest: {...} })` | Plugin generates it, links it from index.html, and keeps icons referenced correctly [CITED: https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements.html] |
| Icon rasterization | Figma export + manual crop | `sharp(svg).resize(size).png()` in a build script | Deterministic, reruns on SVG change, handles maskable safe-zone padding |
| Online/offline detection | Custom ping loop | `navigator.onLine` + `online`/`offline` events (caveats in §5) | Native, zero-deps; our use case tolerates the captive-portal edge case (we fall back on fetch failure anyway) |

**Key insight:** Every problem in this phase has a battle-tested solution in the Vite/Workbox ecosystem. The ONLY hand-rolled logic is `guestsCache.ts` (app-semantic caching) and `UpdateToast.tsx` (project-specific branding).

## Runtime State Inventory

Phase 4 introduces stored client-side state. Explicit inventory:

| Category | Items | Action Required |
|----------|-------|------------------|
| Stored data | `localStorage['seatfinder.guests.v1']` — JSON `{fetchedAt, guests}` | New key; no prior data to migrate |
| Live service config | Google Sheets URL moves from hard-coded constant in `src/services/googleSheets.ts` to `VITE_SHEET_URL` env var | Deployment team must set env var in hosting platform (Vercel/Netlify/etc.) before first prod deploy |
| OS-registered state | Service Worker registrations at origin `/` — browser-managed | No manual cleanup; browser handles SW versioning via Workbox revision hashes |
| Secrets/env vars | `VITE_SHEET_URL` (public — Sheets CSV is already publicly published) | Add to `.env.example`, document in README |
| Build artifacts | `dist/sw.js`, `dist/workbox-*.js`, `dist/manifest.webmanifest`, `dist/pwa-*.png` | Emitted by `vite build`; no cleanup needed; verify in build smoke test |

**Migration note:** Guests who have used the app before this phase ships will not have the localStorage key set. First load post-deploy = network fetch, then seed cache. No migration code needed.

---

## Section 1 — `vite-plugin-pwa` Setup

**Source:** [vite-pwa-org.netlify.app/guide/](https://vite-pwa-org.netlify.app/guide/) [VERIFIED: plugin maintained by vite-pwa-org, v1.x line supports Vite 5+6]

Full config skeleton (to replace current `vite.config.ts`):

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Prompt UX — we drive the toast, plugin does not auto-reload
      registerType: 'prompt',

      // Keep everything in /dist; nothing copied from /public needs extra entries
      // because Vite already copies public/* to dist/.
      includeAssets: [
        'apple-touch-icon.png',
        // NOTE: floor-plan images are NOT precached (D-15); they go via runtimeCaching
      ],

      manifest: {
        name: 'Seat Finder — Mahek & Saumya',
        short_name: 'Seat Finder',
        description: "Find your table at Mahek & Saumya's wedding reception.",
        theme_color: '#2b2d42',
        background_color: '#2b2d42',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Precache app shell: index.html, JS, CSS, fonts. Plugin computes revisions.
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        // Exclude large floor-plan variants from precache — they go via runtime rules.
        globIgnores: ['**/floor-plan/**'],

        // Safety net: if the client asks for a URL we didn't precache, fall back to index.html (SPA behavior).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,           // (none today, but reserved)
          new RegExp('^' + (process.env.VITE_SHEET_URL ?? 'https://docs.google.com') + '$'),
        ],

        runtimeCaching: [
          // Floor-plan image variants (generated by scripts/generate-images.mjs)
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/floor-plan/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'floor-plan-images-v1',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // JS/CSS belt-and-suspenders for anything that slips past precache (dynamic chunks)
          {
            urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'static-assets-v1' },
          },
          // Google Sheets CSV: never cache at SW layer — app-layer localStorage handles it.
          {
            urlPattern: ({ url }) => url.hostname.endsWith('docs.google.com'),
            handler: 'NetworkOnly',
          },
        ],

        // Cleanup outdated precache entries on activate
        cleanupOutdatedCaches: true,
      },

      devOptions: {
        enabled: true,      // Allow testing PWA features in `npm run dev`
        type: 'module',     // Vite serves ES modules; SW must match
        navigateFallback: 'index.html',
      },
    }),
  ],
});
```

**Citations:**
- `registerType` options — [https://vite-pwa-org.netlify.app/guide/register-service-worker.html](https://vite-pwa-org.netlify.app/guide/register-service-worker.html) [CITED]
- `workbox.runtimeCaching` schema — [https://developer.chrome.com/docs/workbox/reference/workbox-build#type-RuntimeCaching](https://developer.chrome.com/docs/workbox/reference/workbox-build#type-RuntimeCaching) [CITED]
- `devOptions.enabled` — [https://vite-pwa-org.netlify.app/guide/development.html](https://vite-pwa-org.netlify.app/guide/development.html) [CITED]
- `generateSW` vs `injectManifest` — [https://vite-pwa-org.netlify.app/guide/inject-manifest.html](https://vite-pwa-org.netlify.app/guide/inject-manifest.html) [CITED]

**Confidence:** HIGH — all fields cited from official docs.

---

## Section 2 — React Update Toast Pattern

**Source:** [vite-pwa-org.netlify.app/frameworks/react.html](https://vite-pwa-org.netlify.app/frameworks/react.html) [CITED]

The `virtual:pwa-register/react` virtual module exports `useRegisterSW`, which returns two reactive state tuples and an `updateServiceWorker` function. It handles SW registration internally and is StrictMode-safe (see §3).

Full TSX skeleton for `src/components/UpdateToast.tsx`:

```tsx
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './UpdateToast.css';

interface UpdateToastProps {
  /** When true, suppress rendering (e.g., MapView is open — per D-06). */
  suppressed?: boolean;
}

const AUTO_DISMISS_MS = 10_000;

export default function UpdateToast({ suppressed = false }: UpdateToastProps) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      // Non-fatal — app works without SW.
      console.error('[sw] register error', err);
    },
  });

  // Auto-dismiss after 10s if the user ignores it.
  useEffect(() => {
    if (!needRefresh) return;
    const t = window.setTimeout(() => setNeedRefresh(false), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [needRefresh, setNeedRefresh]);

  if (!needRefresh || suppressed) return null;

  return createPortal(
    <div className="update-toast" role="status" aria-live="polite">
      <span className="update-toast-text">New version available</span>
      <button
        type="button"
        className="update-toast-btn"
        onClick={() => updateServiceWorker(true)}
      >
        Tap to refresh
      </button>
    </div>,
    document.body
  );
}
```

**Mount in `App.tsx`** — outside the `.card` div, at the App root. Pass `suppressed={isMapViewOpen}`:

```tsx
// src/App.tsx (partial)
return (
  <div className="app-container">
    <div className="card">{/* existing content */}</div>
    <UpdateToast suppressed={isMapViewOpen} />
  </div>
);
```

**CSS sketch** (navy theme, bottom-anchored, safe-area-aware for iOS):

```css
/* src/components/UpdateToast.css */
.update-toast {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  background: #2b2d42;
  color: #edf2f4;
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  align-items: center;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  z-index: 9999;
  animation: slideUp 0.2s ease-out;
}
.update-toast-btn {
  background: #d90429;
  color: white;
  border: 0;
  border-radius: 8px;
  padding: 6px 12px;
  font-weight: 600;
  cursor: pointer;
}
```

**Citations:**
- `useRegisterSW` API — [https://vite-pwa-org.netlify.app/frameworks/react.html](https://vite-pwa-org.netlify.app/frameworks/react.html) [CITED]
- `updateServiceWorker(reloadPage: boolean)` — [https://vite-pwa-org.netlify.app/guide/auto-update.html](https://vite-pwa-org.netlify.app/guide/auto-update.html) [CITED]
- `createPortal` — [https://react.dev/reference/react-dom/createPortal](https://react.dev/reference/react-dom/createPortal) [CITED]

**Confidence:** HIGH.

---

## Section 3 — StrictMode Resilience

**Sources:**
- React 18 StrictMode double-invoke docs — [https://react.dev/reference/react/StrictMode](https://react.dev/reference/react/StrictMode) [CITED]
- vite-plugin-pwa React framework guide — [https://vite-pwa-org.netlify.app/frameworks/react.html](https://vite-pwa-org.netlify.app/frameworks/react.html) [CITED]

**`useRegisterSW` is StrictMode-safe** — it internally tracks registration state and deduplicates double-invocation. We use it as documented, no workaround needed. [VERIFIED: vite-pwa docs explicitly target React 18 + StrictMode]

**For hand-rolled effects we add**, specifically `useOnlineStatus` (online/offline event listeners), use the standard add/remove pattern. This is NOT the ref-guard pattern (which is for one-shot init effects); for event listeners React 18 StrictMode correctly invokes the cleanup between the double-mount, so a plain add-in-mount / remove-in-cleanup works:

```ts
// src/pwa/useOnlineStatus.ts
import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
```

**Ref-guarded pattern** (only use for genuinely one-shot side effects like history.pushState, NOT needed in Phase 4 — this pattern was used in Phase 3's MapView for `history.pushState` because pushing the same entry twice would break back-button navigation):

```ts
// Reference only — NOT needed for Phase 4 listeners.
const didInitRef = useRef(false);
useEffect(() => {
  if (didInitRef.current) return;
  didInitRef.current = true;
  // one-shot side effect here
}, []);
```

For the "Updated Xm ago" badge we need a ticking timer. Use `setInterval` with proper cleanup — StrictMode will invoke the cleanup between double-mount, so no dedupe is required:

```ts
// src/pwa/useCacheAge.ts
import { useEffect, useState } from 'react';

export function useCacheAge(fetchedAt: string | null): number | null {
  const [ageMs, setAgeMs] = useState<number | null>(
    fetchedAt ? Date.now() - new Date(fetchedAt).getTime() : null
  );

  useEffect(() => {
    if (!fetchedAt) { setAgeMs(null); return; }
    const tick = () => setAgeMs(Date.now() - new Date(fetchedAt).getTime());
    tick();
    const id = window.setInterval(tick, 60_000); // 1-minute granularity
    return () => window.clearInterval(id);
  }, [fetchedAt]);

  return ageMs;
}
```

**Confidence:** HIGH (`useRegisterSW` safety), HIGH (standard listener pattern).

---

## Section 4 — localStorage SWR Cache Wrapper

**Source:** MDN — [https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) + [https://developer.mozilla.org/en-US/docs/Web/API/AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) [CITED]

Full TypeScript shape for `src/services/guestsCache.ts`:

```ts
import type { Guest } from '../types';
import { parseGuestsCsv } from './googleSheets'; // refactor googleSheets.ts to export the parser

const CACHE_KEY = 'seatfinder.guests.v1';
const NETWORK_TIMEOUT_MS = 2000;
const HARD_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedGuests {
  fetchedAt: string;   // ISO-8601
  guests: Guest[];
}

interface CacheReadResult {
  data: CachedGuests | null;
  ageMs: number | null;
  expired: boolean;
}

function readCache(): CacheReadResult {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { data: null, ageMs: null, expired: false };
    const parsed = JSON.parse(raw) as unknown;
    // Shape validation — treat any deviation as cache-miss (corruption handling).
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('fetchedAt' in parsed) ||
      !('guests' in parsed) ||
      typeof (parsed as CachedGuests).fetchedAt !== 'string' ||
      !Array.isArray((parsed as CachedGuests).guests)
    ) {
      return { data: null, ageMs: null, expired: false };
    }
    const data = parsed as CachedGuests;
    const ageMs = Date.now() - new Date(data.fetchedAt).getTime();
    const expired = ageMs > HARD_EXPIRY_MS || Number.isNaN(ageMs);
    return { data, ageMs, expired };
  } catch {
    // JSON.parse failure OR localStorage access blocked → cache miss.
    return { data: null, ageMs: null, expired: false };
  }
}

function writeCache(guests: Guest[]): CachedGuests {
  const entry: CachedGuests = { fetchedAt: new Date().toISOString(), guests };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch (err) {
    // QuotaExceededError (iOS Safari private mode) or disabled storage.
    // Non-fatal — we return the fresh data; next load will simply miss cache.
    console.warn('[guestsCache] write failed', err);
  }
  return entry;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Network-first with 2s timeout, localStorage fallback, 24h hard expiry.
 * Throws a user-facing Error if (a) network fails AND (b) cache is absent or >24h old.
 */
export async function fetchGuestsCached(url: string): Promise<CachedGuests> {
  const cache = readCache();

  try {
    const csv = await fetchWithTimeout(url, NETWORK_TIMEOUT_MS);
    const guests = parseGuestsCsv(csv);
    return writeCache(guests);
  } catch (networkErr) {
    // Network timeout or HTTP error — fall back to cache.
    if (cache.data && !cache.expired) {
      return cache.data;
    }
    if (cache.data && cache.expired) {
      throw new Error(
        'Your guest list is more than 24 hours old and we cannot reach the server. ' +
        'Please connect to the internet and try again.'
      );
    }
    throw new Error(
      'Unable to load guest list. Please check your connection and try again.'
    );
  }
}

// Exposed for UI badge ("Updated Xm ago")
export function readCachedMetadata(): { fetchedAt: string | null; ageMs: number | null } {
  const { data, ageMs } = readCache();
  return { fetchedAt: data?.fetchedAt ?? null, ageMs };
}
```

**Refactor note for `googleSheets.ts`:** Extract the internal CSV parser as an exported `parseGuestsCsv(csv: string): Guest[]` so the cache wrapper can call it without duplicating logic. Keep `fetchGuests()` as a thin wrapper for backwards compat during migration, then switch `App.tsx` to call `fetchGuestsCached(import.meta.env.VITE_SHEET_URL)`.

**Confidence:** HIGH (AbortController, localStorage API), MEDIUM (QuotaExceededError handling — iOS Safari private mode behavior is documented but depends on iOS version).

---

## Section 5 — Offline Detection

**Sources:**
- MDN `Navigator.onLine` — [https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) [CITED]
- MDN `online`/`offline` events — [https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event](https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event) [CITED]

**Key caveats:**
1. `navigator.onLine === true` does NOT prove real internet connectivity — it only means the OS has a network interface. Captive portals, firewalls, and DNS failures all yield `onLine === true` while fetches fail.
2. `navigator.onLine === false` IS reliable (no interface = definitely offline).
3. The `online`/`offline` events fire only on state transitions, not on initial page load — read `navigator.onLine` synchronously on mount to seed state.

**Recommendation** (per CONTEXT D-07):

Treat the UI "offline-ish" badge as a union of two signals:

```ts
// Pseudocode for App.tsx
const online = useOnlineStatus(); // from section 3
const { fetchedAt, ageMs } = readCachedMetadata();

const showStaleBadge =
  !online ||
  (ageMs !== null && ageMs > 60 * 60 * 1000); // cache older than 1h
```

Never use `online === true` as a green-light to skip the cache. The cache wrapper itself (§4) is the source of truth for "did the network work" — it either succeeded (fresh data) or fell back to cache (we display the badge with the cached `fetchedAt`).

**Confidence:** HIGH.

---

## Section 6 — PWA Icon Generation via sharp

**Sources:**
- W3C Maskable icon spec — [https://www.w3.org/TR/appmanifest/#icon-masks](https://www.w3.org/TR/appmanifest/#icon-masks) [CITED]
- web.dev maskable icons — [https://web.dev/articles/maskable-icon](https://web.dev/articles/maskable-icon) [CITED]
- sharp docs — [https://sharp.pixelplumbing.com/](https://sharp.pixelplumbing.com/) [CITED]

**Maskable safe zone:** The spec reserves a circular "safe zone" of diameter 0.8 × size (40% radius). Art outside the safe zone may be clipped by the platform icon mask. For a 512×512 icon the safe zone is a circle of radius ~205px centered at (256, 256). Recommended safe-zone padding ≈ 10% on each side (i.e., scale inner art to ~80% of canvas).

Full script skeleton for `scripts/generate-pwa-icons.mjs`:

```js
// scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, '../public');
mkdirSync(out, { recursive: true });

// Brand palette
const NAVY = '#2b2d42';
const RED  = '#d90429';
const WHITE = '#ffffff';

// Teardrop pin SVG — matches FloorPlan.tsx assigned pin (viewBox 0 0 36 44).
// For icons, center the pin in a square canvas with navy background.
// normalScale = inner art takes ~68% of canvas (comfortable for any icon mask)
// maskableScale = inner art takes ~60% of canvas (fits safe zone with margin)
function pinSvg({ size, innerScale, bg }) {
  const pinW = size * innerScale;
  const pinH = pinW * (44 / 36); // preserve 36×44 aspect ratio
  const x = (size - pinW) / 2;
  const y = (size - pinH) / 2;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${bg}" />
      <g transform="translate(${x} ${y}) scale(${pinW / 36})">
        <path d="M18 0 C8 0 0 8 0 18 C0 28 18 44 18 44 C18 44 36 28 36 18 C36 8 28 0 18 0 Z"
              fill="${RED}" stroke="${WHITE}" stroke-width="2" />
      </g>
    </svg>
  `);
}

async function emit(name, size, innerScale, bg) {
  const svg = pinSvg({ size, innerScale, bg });
  const dest = resolve(out, name);
  await sharp(svg).png().toFile(dest);
  console.log(`Generated ${name}`);
}

// 1) Normal 192 / 512 — pin on navy background, takes ~68% of canvas
await emit('pwa-192.png',           192, 0.68, NAVY);
await emit('pwa-512.png',           512, 0.68, NAVY);

// 2) Maskable 512 — pin INSIDE the safe zone (smaller inner art, navy bleeds to edges)
await emit('pwa-512-maskable.png',  512, 0.56, NAVY);

// 3) Apple touch icon 180 — NO rounding (iOS rounds its own corners); pin on navy
await emit('apple-touch-icon.png',  180, 0.68, NAVY);

console.log('Done: 4 PWA icons written to /public');
```

**Script registration** — add to `package.json`:
```json
"generate-pwa-icons": "node scripts/generate-pwa-icons.mjs"
```

Run once at phase implementation time; rerun only if branding changes.

**Why no rounding on apple-touch-icon:** iOS applies its own `squircle` mask. If you pre-round the corners you get a double-rounding artifact. [CITED: https://webhint.io/docs/user-guide/hints/hint-apple-touch-icons/]

**Confidence:** HIGH.

---

## Section 7 — Apple PWA Meta Tags

**Sources:**
- Apple Human Interface Guidelines (Web content) — [https://developer.apple.com/documentation/webkit/configuring-web-applications](https://developer.apple.com/documentation/webkit/configuring-web-applications) [CITED]
- web.dev iOS PWA guidance — [https://web.dev/learn/pwa/installation](https://web.dev/learn/pwa/installation) [CITED]

Exact tags to add to `index.html` `<head>`:

```html
<!-- Existing -->
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>Seat Finder — Mahek & Saumya</title>

<!-- Theme / branding -->
<meta name="theme-color" content="#2b2d42" />

<!-- Apple PWA -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />  <!-- newer spelling (see pitfall §10) -->
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Seat Finder" />

<!-- vite-plugin-pwa auto-injects manifest link, but explicit is fine too: -->
<link rel="manifest" href="/manifest.webmanifest" />
```

**Notes:**
- `viewport-fit=cover` is required for `env(safe-area-inset-*)` CSS to work; needed by our UpdateToast bottom positioning (§2 CSS).
- `black-translucent` status bar with navy theme + navy background means the status bar content (clock, battery) will render over our navy background — visually clean. The alternatives (`default` white, `black` opaque) create an ugly stripe at the top.
- No per-device splash PNGs (confirmed D-16). iOS 16+ renders a reasonable default splash from the manifest's `background_color` + largest icon. Older iOS shows a plain colored screen — acceptable for our use case.

**Confidence:** HIGH (meta tag behavior), MEDIUM (iOS default splash quality varies by iOS version).

---

## Section 8 — VITE_SHEET_URL Env Var

**Sources:**
- Vite env variables — [https://vitejs.dev/guide/env-and-mode.html](https://vitejs.dev/guide/env-and-mode.html) [CITED]

**`import.meta.env` rules:**
- Only vars prefixed `VITE_` are exposed to client code.
- Values are inlined at build time — there is NO runtime lookup. Changing the URL requires a rebuild.
- Missing vars are `undefined` at runtime, NOT a build error by default → we add a fail-fast guard.

**`src/vite-env.d.ts`** — augment type defs:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHEET_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Service module fail-fast guard** (top of `src/services/googleSheets.ts` after refactor):
```ts
const SHEET_URL = import.meta.env.VITE_SHEET_URL;

if (!SHEET_URL) {
  // Module-load-time failure. In dev this surfaces immediately; in prod build
  // this still throws (the string is inlined as undefined → !undefined → throw).
  throw new Error(
    'VITE_SHEET_URL is not set. Copy .env.example to .env.local and set the Sheets CSV URL.'
  );
}

export { SHEET_URL };
```

**Build-time enforcement** (optional stronger guard — can live in `vite.config.ts` `configResolved` hook):
```ts
// vite.config.ts plugin hook
{
  name: 'require-sheet-url',
  configResolved(config) {
    if (config.command === 'build' && !process.env.VITE_SHEET_URL) {
      throw new Error('Build failed: VITE_SHEET_URL env var is required for production build.');
    }
  },
}
```

This converts D-13's "fail build if missing" from a runtime error into a build-time error.

**`.env.example`** (commit to repo):
```
# Public Google Sheets CSV published-to-web URL.
# Example: https://docs.google.com/spreadsheets/d/e/<ID>/pub?gid=0&single=true&output=csv
VITE_SHEET_URL=https://docs.google.com/spreadsheets/d/e/REPLACE_ME/pub?output=csv
```

**`.gitignore`** — confirm these are ignored:
```
.env
.env.local
.env.*.local
```

**Confidence:** HIGH.

---

## Section 9 — Test Patterns

**Source:** Vitest docs — [https://vitest.dev/guide/mocking.html](https://vitest.dev/guide/mocking.html) [CITED], [https://vitest.dev/api/vi.html#vi-usefaketimers](https://vitest.dev/api/vi.html#vi-usefaketimers) [CITED]

### 9a — Unit test: cache wrapper

```ts
// src/services/guestsCache.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fetchGuestsCached } from './guestsCache';

const SAMPLE_CSV =
  'Table,First,Last,Contact,Description\n1,Alice,Smith,alice@x.com,\n';

describe('fetchGuestsCached', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('writes cache on successful fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_CSV) })
    );
    const result = await fetchGuestsCached('http://example/csv');
    expect(result.guests).toHaveLength(1);
    expect(localStorage.getItem('seatfinder.guests.v1')).toBeTruthy();
  });

  it('falls back to cache on network error', async () => {
    localStorage.setItem(
      'seatfinder.guests.v1',
      JSON.stringify({
        fetchedAt: new Date().toISOString(),
        guests: [{ tableNumber: 1, firstName: 'Cached', lastName: 'Guest', contactInfo: '', description: '' }],
      })
    );
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await fetchGuestsCached('http://example/csv');
    expect(result.guests[0].firstName).toBe('Cached');
  });

  it('aborts after 2s timeout and falls back to cache', async () => {
    localStorage.setItem(
      'seatfinder.guests.v1',
      JSON.stringify({ fetchedAt: new Date().toISOString(), guests: [] })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            (init?.signal as AbortSignal).addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            );
          })
      )
    );
    const p = fetchGuestsCached('http://example/csv');
    vi.advanceTimersByTime(2001);
    await expect(p).resolves.toBeDefined();
  });

  it('throws when cache is >24h old and network fails', async () => {
    const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(
      'seatfinder.guests.v1',
      JSON.stringify({ fetchedAt: dayAgo, guests: [] })
    );
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchGuestsCached('http://example/csv')).rejects.toThrow(/24 hours/);
  });

  it('treats corrupt cache as miss', async () => {
    localStorage.setItem('seatfinder.guests.v1', 'not-json{{{');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchGuestsCached('http://example/csv')).rejects.toThrow(/check your connection/);
  });
});
```

### 9b — Component test: UpdateToast

Mock `virtual:pwa-register/react` so the test doesn't need a real SW:

```ts
// src/components/UpdateToast.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpdateToast from './UpdateToast';

const updateSpy = vi.fn();
let mockNeedRefresh = false;
const setNeedRefresh = vi.fn();

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, setNeedRefresh],
    updateServiceWorker: updateSpy,
  }),
}));

describe('<UpdateToast />', () => {
  it('renders nothing when no update is pending', () => {
    mockNeedRefresh = false;
    const { container } = render(<UpdateToast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders toast and calls updateServiceWorker(true) on click', () => {
    mockNeedRefresh = true;
    render(<UpdateToast />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(updateSpy).toHaveBeenCalledWith(true);
  });

  it('respects suppressed prop', () => {
    mockNeedRefresh = true;
    const { container } = render(<UpdateToast suppressed />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

### 9c — Build-time smoke test

Option A — as a package script (simplest, runs after `npm run build`):

```json
{
  "scripts": {
    "build": "tsc && vite build && node scripts/verify-pwa-build.mjs"
  }
}
```

```js
// scripts/verify-pwa-build.mjs
import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const dist = resolve('dist');
const requiredExact = ['manifest.webmanifest', 'pwa-192.png', 'pwa-512.png', 'pwa-512-maskable.png', 'apple-touch-icon.png'];
const requiredPatterns = [/^sw\.js$/, /^workbox-[a-f0-9]+\.js$/];

const missingExact = requiredExact.filter((f) => !existsSync(resolve(dist, f)));
const files = readdirSync(dist);
const missingPatterns = requiredPatterns.filter((re) => !files.some((f) => re.test(f)));

if (missingExact.length || missingPatterns.length) {
  console.error('PWA build verification FAILED:');
  if (missingExact.length) console.error('  Missing files:', missingExact);
  if (missingPatterns.length) console.error('  Missing patterns:', missingPatterns.map(String));
  process.exit(1);
}
console.log('PWA build verification passed:', files.filter((f) => /manifest|sw\.|workbox|pwa-|apple-/.test(f)));
```

Option B — as a vitest test with `execSync` running `vite build` in a tmpdir. Option A is simpler and integrated with the existing `npm run build` pipeline, so prefer A.

**Confidence:** HIGH (vitest patterns), HIGH (existsSync smoke test).

---

## Section 10 — Pitfalls

### Pitfall 1: `vite-plugin-pwa` dev-mode SW is disabled by default
**What goes wrong:** You run `npm run dev`, open devtools Application → Service Workers, and see nothing. Conclusion: "my config is broken" — but it's not, dev mode just skips SW registration unless you opt in.
**Why it happens:** SW caching would conflict with Vite's HMR. Plugin ships safe-by-default.
**How to avoid:** Set `devOptions.enabled: true` (already in §1 skeleton). Test with `npm run build && npm run preview` for the prod experience.
**Warning signs:** `navigator.serviceWorker.controller === null` in dev console.
**Source:** [https://vite-pwa-org.netlify.app/guide/development.html](https://vite-pwa-org.netlify.app/guide/development.html) [CITED]

### Pitfall 2: Workbox precache manifest grows with every asset
**What goes wrong:** Adding large floor-plan images to precache inflates the initial SW install download, breaking 3G experience.
**Why it happens:** `globPatterns: ['**/*']` precaches everything in `dist/` by default.
**How to avoid:** Our config (§1) uses `globPatterns: ['**/*.{js,css,html,svg,ico,woff2}']` and `globIgnores: ['**/floor-plan/**']`. Floor plan images go via runtime caching.
**Warning signs:** Build log "Precaching X entries" where X > 30, or SW install taking >2s.
**Source:** [https://vite-pwa-org.netlify.app/workbox/generate-sw.html](https://vite-pwa-org.netlify.app/workbox/generate-sw.html) [CITED]

### Pitfall 3: `navigator.onLine` captive-portal false-positive
**What goes wrong:** Venue Wi-Fi shows login portal. `navigator.onLine` returns `true` but fetch gets redirected or fails. App thinks it's online, never falls back to cache.
**Why it happens:** `onLine` reflects OS-level interface, not reachability.
**How to avoid:** Never branch on `onLine === true` before attempting fetch. Our cache wrapper (§4) is fetch-first — it falls back to cache on ANY fetch error, regardless of `onLine`. Only use `onLine === false` as a UI hint.
**Warning signs:** Reports of "app froze at loading screen on venue Wi-Fi".
**Source:** [https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) [CITED]

### Pitfall 4: iOS `apple-mobile-web-app-capable` rename
**What goes wrong:** Spec renamed the meta to `mobile-web-app-capable`. Older iOS only reads the `apple-` prefix; newer devices read the bare name; some versions warn in devtools about the deprecated one. Specifying only one breaks something.
**Why it happens:** Transition period across browser engines.
**How to avoid:** Include BOTH tags (see §7). Harmless — both resolve to the same behavior.
**Warning signs:** Chrome Lighthouse warning about deprecated meta OR iOS "Add to Home Screen" launching in Safari chrome (URL bar visible) instead of standalone.
**Source:** [https://firt.dev/notes/apple-mobile-web-app-capable/](https://firt.dev/notes/apple-mobile-web-app-capable/) [CITED], [https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name/mobile-web-app-capable](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name/mobile-web-app-capable) [CITED]

### Pitfall 5: localStorage QuotaExceededError in iOS Private mode
**What goes wrong:** Guest uses Safari Private browsing at the venue; `localStorage.setItem` throws `QuotaExceededError` on the first write. Without a try/catch the whole app crashes.
**Why it happens:** iOS Safari Private mode has a 0-byte localStorage quota on older versions (pre-iOS 15); newer versions have limited quota.
**How to avoid:** Our `writeCache()` (§4) wraps in try/catch and logs a warning. Read side is also wrapped. Fetch still works — we just lose the offline safety net for that session.
**Warning signs:** User reports "loaded once then stopped working" specifically on iOS Private tabs.
**Source:** [https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem#exceptions](https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem#exceptions) [CITED]

### Pitfall 6: SW `skipWaiting` races past React state
**What goes wrong:** You call `updateServiceWorker(true)`. The new SW activates, `window.location.reload()` fires, but React's in-flight `setState` calls lose their completion. User sees a flash of stale UI then a reload.
**Why it happens:** `updateServiceWorker(true)` with `reloadPage: true` reloads the whole page immediately on SW `controllerchange`.
**How to avoid:** Accept this. A reload is the defined UX. Don't try to "gracefully" transition — the whole point of prompt-for-update is the user opted in.
**Warning signs:** None — this is the documented behavior.
**Source:** [https://vite-pwa-org.netlify.app/guide/auto-update.html](https://vite-pwa-org.netlify.app/guide/auto-update.html) [CITED]

### Pitfall 7: Env var is undefined in tests
**What goes wrong:** Vitest runs `fetchGuestsCached(import.meta.env.VITE_SHEET_URL)` and the module-level guard throws before tests even run.
**Why it happens:** Vitest uses Vite's pipeline but test env has no `.env.local`.
**How to avoid:** Tests should pass the URL explicitly (`fetchGuestsCached('http://example/csv')` as in §9a). Keep the guard inside `googleSheets.ts` (the module that actually needs the URL at runtime), NOT inside the cache wrapper. The cache wrapper accepts `url: string` — it's URL-agnostic.
**Warning signs:** Tests throw "VITE_SHEET_URL not set" before any assertion.

### Pitfall 8: Manifest `start_url` mismatch breaks install
**What goes wrong:** Manifest `start_url: '/'` but app is hosted at `/seat-finder/` subpath. PWA installs but launches to 404.
**Why it happens:** `start_url` is resolved against manifest URL; if hosting has a subpath, this must match.
**How to avoid:** For this project, hosting is at origin root so `/` is correct. If hosting ever moves to a subpath, also update Vite `base` config.
**Warning signs:** Lighthouse PWA audit fails "start_url is not accessible".

---

## Section 11 — Out-of-Scope Rejections

These are explicitly OUT of this phase; the planner MUST NOT include tasks for them:

- **Custom version-polling loop** — `vite-plugin-pwa` + Workbox already check for SW updates on every navigation and on a configurable interval. Don't hand-roll a `fetch('/sw.js')` poll. [CITED: https://vite-pwa-org.netlify.app/guide/periodic-sw-updates.html]
- **IndexedDB migration** — D-01 locked us on localStorage. ~500 guests × ~100 bytes each ≈ 50KB, well under the 5MB localStorage quota on every non-pathological browser. Adding IDB would mean async API changes throughout the app for zero user benefit.
- **Hand-authored Apple splash PNGs per iOS device** — D-16 locked this as deferred. We ship `apple-touch-icon.png` (180×180) only. iOS will render a solid-color splash using `background_color` from the manifest, which is acceptable.
- **Background sync for Sheets refresh** — Workbox Background Sync needs a POST retry queue; our use case is read-only GET, and we don't need silent background refresh during a 4-hour reception window.
- **Push notifications** — no server infra, no notification use case.
- **`beforeinstallprompt` custom install button** — D-08 locked "no proactive install prompt". Rely on the browser's native install affordance (Chrome address bar icon, Safari share sheet).
- **SW versioning via manual cache name bumps** — D-18 locked us on Workbox revision hashing. We do not write `cache-v2` by hand.
- **OfflineAmp-style app-shell HTML override** — our single index.html IS the app shell; Workbox precaches it automatically.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, scripts | ✓ | v22.14.0 | — |
| npm | package install | ✓ | (bundled with Node) | — |
| `sharp` | icon generation | ✓ | 0.34.5 (installed) | — |
| `vitest` | unit/component tests | ✓ | 4.1.4 (installed) | — |
| `vite-plugin-pwa` | PWA plugin | ✗ | — | MUST install — `npm install --save-dev vite-plugin-pwa` |
| `jsdom` | test DOM env for UpdateToast | ✓ | 26.1.0 (installed) | — |

**Missing dependencies with no fallback:** None (all installable via npm).

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 + @testing-library/react 16.3.2 (installed) |
| Config file | None present — need `vitest.config.ts` with `environment: 'jsdom'` (Wave 0 gap) |
| Quick run command | `npx vitest run src/services/guestsCache.test.ts` |
| Full suite command | `npm test` |
| Build smoke | `npm run build && node scripts/verify-pwa-build.mjs` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | App is installable (manifest + icons emitted by build) | build smoke | `npm run build && node scripts/verify-pwa-build.mjs` | ❌ Wave 0 (script + manifest config) |
| PERF-01 | Install works on iOS + Android | manual-only | Load on real devices, confirm "Add to Home Screen" works | — (manual gate before phase complete) |
| PERF-02 | Cache falls back on network failure | unit | `npx vitest run src/services/guestsCache.test.ts` | ❌ Wave 0 |
| PERF-02 | Cache enforces 24h hard expiry | unit (fake timers) | same file | ❌ Wave 0 |
| PERF-02 | Cache treats corruption as miss | unit | same file | ❌ Wave 0 |
| PERF-03 | App shell works offline | manual (devtools Network: Offline) | — | — (manual) |
| PERF-03 | Update toast appears on new SW version | component | `npx vitest run src/components/UpdateToast.test.tsx` | ❌ Wave 0 |
| PERF-03 | Update toast dismisses after 10s | component (fake timers) | same file | ❌ Wave 0 |
| PERF-03 | Toast is suppressed when MapView is open | component | same file (`suppressed` prop) | ❌ Wave 0 |
| PERF-04 | Build fails when VITE_SHEET_URL is missing | integration | `unset VITE_SHEET_URL && npm run build` (expect non-zero exit) | ❌ Wave 0 (guard in vite.config) |
| PERF-04 | Service reads env var at module load | unit | `src/services/googleSheets.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run <the file changed>`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test && npm run build && node scripts/verify-pwa-build.mjs` — all green

### Wave 0 Gaps

- [ ] `vitest.config.ts` — set `environment: 'jsdom'`, `setupFiles: ['./src/test-setup.ts']`
- [ ] `src/test-setup.ts` — import `@testing-library/jest-dom`
- [ ] `src/services/guestsCache.test.ts` — covers PERF-02
- [ ] `src/services/googleSheets.test.ts` — covers PERF-04 env var read (if not already added in prior phase)
- [ ] `src/components/UpdateToast.test.tsx` — covers PERF-03
- [ ] `scripts/verify-pwa-build.mjs` — covers PERF-01 build smoke
- [ ] Mock alias: vitest config must resolve `virtual:pwa-register/react` to a mock module, OR individual tests use `vi.mock(...)` inline (simpler — prefer this)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vite-plugin-pwa` v1.x works with Vite 6 | Standard Stack | [ASSUMED from prior search in CONTEXT scope] — verify with `npm view vite-plugin-pwa peerDependencies` before installing. Mitigation: if peer-dep conflict, pin to v0.21.x or use `--legacy-peer-deps`. |
| A2 | iOS Safari private mode still throws QuotaExceededError on iOS 17+ | Pitfall §10.5 | [ASSUMED from older docs] — behavior may have changed. Mitigation irrelevant: our try/catch covers the error if it occurs; if it doesn't occur, code path is dead but harmless. |
| A3 | `navigator.serviceWorker.controller === null` in `npm run dev` when `devOptions.enabled: false` | Pitfall §10.1 | [VERIFIED via vite-pwa docs] |
| A4 | 500-guest localStorage payload is <50KB | §11 rejection | [ASSUMED based on ~100 bytes/row] — if Guest schema grows (photos, notes), re-evaluate against 5MB quota. |
| A5 | iOS 16+ renders reasonable default splash from manifest | §7 | [ASSUMED] — test on real iPhone pre-launch. If splash looks terrible, consider generating 2-3 key apple-touch-startup-image files (reverses D-16). |

**User confirmation needed:** A1 (verify plugin version at implementation time — 1-line check). A4 (not urgent; only matters if guest list grows). Others are low-risk.

---

## Open Questions

1. **Should UpdateToast auto-dismiss timer pause while user is interacting?**
   - What we know: CONTEXT D-05 says 10s auto-dismiss.
   - What's unclear: if user hovers / touches the toast, should the timer reset?
   - Recommendation: NO — keep it simple. If user wants to refresh, they tap. Timer firing is equivalent to "ignore the update this session" which is fine (next page load will re-register and re-prompt).

2. **Should the cache wrapper serve stale data IMMEDIATELY and refresh in background (true SWR)?**
   - What we know: D-02 says network-first with 2s timeout.
   - What's unclear: CONTEXT frames this as network-first, but a true SWR (stale-while-revalidate) would serve cache instantly and refresh in parallel, showing the "Updated Xm ago" badge for a moment.
   - Recommendation: Implement strict network-first per D-02. Revisit in Phase 5+ if users report slow initial load on good connections.

3. **Does `devOptions.enabled: true` interfere with Vite HMR for regular code changes?**
   - What we know: plugin docs say dev SW is non-caching (network pass-through).
   - What's unclear: edge cases around HMR websocket handshake with SW active.
   - Recommendation: Test on a branch. If HMR flakes, set `devOptions.enabled: false` and test PWA features only via `npm run preview`.

---

## Code Examples

Copy-ready blocks are embedded above in their relevant sections:
- `vite.config.ts` — §1
- `src/components/UpdateToast.tsx` — §2
- `src/pwa/useOnlineStatus.ts` + `useCacheAge.ts` — §3
- `src/services/guestsCache.ts` — §4
- `scripts/generate-pwa-icons.mjs` — §6
- `index.html` meta tags — §7
- `src/vite-env.d.ts` + env guards — §8
- vitest suites — §9
- `scripts/verify-pwa-build.mjs` — §9c

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `navigator.serviceWorker.register('/sw.js')` + hand-written SW | `vite-plugin-pwa` + Workbox `generateSW` | Workbox 5.0 (2019), vite-plugin-pwa 0.x (2021) | 90% less code, correct precache revisioning, safe SW lifecycle |
| `apple-mobile-web-app-capable` only | BOTH `apple-*` AND `mobile-web-app-capable` | MDN deprecation notice ~2023 | Forward-compat; both must coexist during transition |
| Manual bitmap icons per size | SVG source → sharp rasterize → PNGs | Ongoing | Single source of truth; rebrand = edit one SVG |
| PWA detection heuristics (Lighthouse < v10) | Lighthouse "Installable" audit uses clear manifest rules | Lighthouse 10+ (2023) | We target the checklist: name, short_name, icons 192+512, start_url, display, theme_color, background_color, service worker |

**Deprecated/outdated:**
- `navigator.serviceWorker.ready` polling for updates — use Workbox `Workbox.addEventListener('waiting', ...)` via `useRegisterSW`.
- Hand-rolled `online`/`offline` + ping heuristic — acceptable for our scope; fall back on fetch error is the definitive signal.

---

## Project Constraints (from CLAUDE.md)

These are directives the planner MUST honor:

- **Tech stack locked:** React 18 + Vite 6 + TypeScript 5.6 — no framework rewrite.
- **Data source locked:** Google Sheets CSV via public "publish to web" URL.
- **Hosting:** Static only — no backend server. All PWA logic must run in browser.
- **Mobile-first:** Performance on cellular/WiFi is critical → keep precache bundle small (§1 `globIgnores`).
- **Naming conventions (enforced):**
  - Components: PascalCase `.tsx` files (e.g., `UpdateToast.tsx`)
  - Services: camelCase `.ts` files (e.g., `guestsCache.ts`)
  - Event handlers: `handle*` prefix
  - Props interfaces: `{ComponentName}Props`
  - CSS: kebab-case class names with component prefix (e.g., `update-toast-btn`)
  - Default export for components; named exports for services/types
- **Function declarations** (not arrow functions) for React components.
- **No global state library** — continue pattern of lifting state to `App.tsx`.
- **No path aliases** — relative imports throughout.
- **Error handling style:** try/catch + `instanceof Error` narrowing + error stored in `useState<string | null>(null)` + retry button. The cache wrapper's thrown errors plug directly into the existing error card UI.
- **Testing tool:** vitest + @testing-library/react (already installed).
- **ESLint strict:** `--max-warnings 0` means no lint warnings can slip in; new code must be clean.
- **GSD workflow enforced:** All file edits in this phase happen via GSD commands (already running `/gsd-research-phase` / `/gsd-execute-phase`).

---

## Sources

### Primary (HIGH confidence)
- `vite-plugin-pwa` official docs — [https://vite-pwa-org.netlify.app/](https://vite-pwa-org.netlify.app/)
  - Configuration: [/guide/](https://vite-pwa-org.netlify.app/guide/)
  - Prompt for update: [/guide/prompt-for-update.html](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html)
  - React framework: [/frameworks/react.html](https://vite-pwa-org.netlify.app/frameworks/react.html)
  - Development mode: [/guide/development.html](https://vite-pwa-org.netlify.app/guide/development.html)
  - Periodic SW updates: [/guide/periodic-sw-updates.html](https://vite-pwa-org.netlify.app/guide/periodic-sw-updates.html)
- Workbox reference — [https://developer.chrome.com/docs/workbox/](https://developer.chrome.com/docs/workbox/)
- Vite env variables — [https://vitejs.dev/guide/env-and-mode.html](https://vitejs.dev/guide/env-and-mode.html)
- W3C App Manifest (maskable icons) — [https://www.w3.org/TR/appmanifest/#icon-masks](https://www.w3.org/TR/appmanifest/#icon-masks)
- web.dev maskable icons — [https://web.dev/articles/maskable-icon](https://web.dev/articles/maskable-icon)
- MDN `Navigator.onLine` — [https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine)
- MDN `AbortController` — [https://developer.mozilla.org/en-US/docs/Web/API/AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- React StrictMode — [https://react.dev/reference/react/StrictMode](https://react.dev/reference/react/StrictMode)
- React createPortal — [https://react.dev/reference/react-dom/createPortal](https://react.dev/reference/react-dom/createPortal)
- Vitest — [https://vitest.dev/guide/mocking.html](https://vitest.dev/guide/mocking.html)
- sharp — [https://sharp.pixelplumbing.com/](https://sharp.pixelplumbing.com/)

### Secondary (MEDIUM confidence)
- firt.dev iOS PWA notes — [https://firt.dev/notes/apple-mobile-web-app-capable/](https://firt.dev/notes/apple-mobile-web-app-capable/)
- Apple web configuration — [https://developer.apple.com/documentation/webkit/configuring-web-applications](https://developer.apple.com/documentation/webkit/configuring-web-applications)
- webhint Apple touch icon — [https://webhint.io/docs/user-guide/hints/hint-apple-touch-icons/](https://webhint.io/docs/user-guide/hints/hint-apple-touch-icons/)

### Tertiary (LOW confidence)
- None. All claims either verified via MDN/vite-pwa docs or clearly flagged `[ASSUMED]` in the Assumptions Log.

---

## Metadata

**Confidence breakdown:**
- Standard stack (`vite-plugin-pwa`, Workbox, sharp): HIGH — all APIs cited from official docs.
- Cache wrapper architecture: HIGH — `AbortController`, localStorage, JSON.parse patterns are decades-stable.
- iOS-specific behavior (splash, private mode quota): MEDIUM — platform specifics drift; verify on real hardware.
- Toast UX (StrictMode interaction, auto-dismiss timer): HIGH — React 18 hook patterns are settled.
- Icon generation (maskable safe zone math): HIGH — W3C spec explicit on safe zone diameter.

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days) for `vite-plugin-pwa` version — re-check `npm view vite-plugin-pwa version` if implementation starts after this date.
