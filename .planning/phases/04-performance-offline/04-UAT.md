# Phase 4: Performance & Offline — User Acceptance Test (UAT)

**Gate:** All blocking items below must be checked before the phase is marked complete. Nice-to-have items are recommended but non-blocking.

**Automated coverage already verifying:**
- PERF-01: guestsCache unit tests + App integration test (vitest)
- PERF-02: build-smoke (`scripts/verify-pwa-build.mjs`) asserts `dist/` has manifest + SW + all 4 PWA icons
- PERF-03: SW Workbox config audited; runtime cache rules unit-verifiable via build output
- PERF-04: `src/services/googleSheets.test.ts` guard test + `vite.config.ts` `configResolved` guard

This UAT covers the PHYSICAL behaviors that require a real device / real network and therefore cannot be asserted in vitest or a static build check.

---

## Prerequisites

- [ ] `VITE_SHEET_URL` is set in `.env.local` (pointing to the real Mahek & Saumya sheet)
- [ ] `npm run build` completes without error — final line is `PWA build verification passed.`
- [ ] `npm run preview` serves the app at `http://localhost:4173`
- [ ] Deploy target is reachable (or use `npm run preview` over a LAN IP accessible by phone — iOS requires HTTPS for the SW to register, so either deploy to the real host or use `ngrok http 4173` / `cloudflared tunnel --url http://localhost:4173` for the LAN test)

---

## PERF-01 — Guest list cache with SWR + 24h TTL

### 1a. Fresh load on a connected device (happy path)
- [ ] Open the app in a desktop browser.
- [ ] The search box is usable within ~2 seconds.
- [ ] DevTools → Application → Local Storage shows a key `seatfinder.guests.v1` with a JSON value containing `{ fetchedAt: "<ISO>", guests: [...] }`.
- [ ] No staleness badge is visible (cache is <1h old and device is online).

### 1b. Offline fallback (BLOCKING)
- [ ] With guest list loaded, open DevTools → Network → set throttling to "Offline".
- [ ] Refresh the page.
- [ ] App loads — search still works — the navy-on-slate badge `Offline — showing cached list` appears below the welcome text.
- [ ] Tapping the badge triggers a refresh attempt (still offline → badge stays).

### 1c. Staleness badge after 1h
- [ ] In DevTools, open `localStorage` and edit the `fetchedAt` value to 90 minutes ago. Paste in the console:
      `localStorage.setItem('seatfinder.guests.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('seatfinder.guests.v1')), fetchedAt: new Date(Date.now() - 90*60*1000).toISOString() }))`
- [ ] Refresh.
- [ ] The muted `Updated 90m ago` badge appears below the welcome text.
- [ ] Tapping the badge calls the loader again (watch Network tab for a new fetch).

### 1d. 24-hour hard expiry
- [ ] Edit `fetchedAt` to 25 hours ago, set Network to "Offline", refresh.
- [ ] Error card appears with the "more than 24 hours" copy and a Retry button.
- [ ] Go back online, tap Retry → app recovers to normal state.

---

## PERF-02 — Installable PWA (real device required)

### 2a. iOS Safari — Add to Home Screen (BLOCKING)
- [ ] Open the deployed URL (or `npm run preview`'s LAN URL over HTTPS) in iOS Safari on a real iPhone.
- [ ] Tap the Share icon → "Add to Home Screen".
- [ ] Confirm the icon preview is the red teardrop pin on navy (NOT the default Safari favicon).
- [ ] Homescreen label reads `Seat Finder`.
- [ ] Tap the homescreen icon — app launches WITHOUT the Safari URL bar / tab UI (standalone mode).
- [ ] Status bar text is legible against the navy top area (black-translucent style).

### 2b. Android Chrome — Install
- [ ] Open the deployed URL in Chrome on an Android device.
- [ ] The "Install app" prompt (or address-bar install icon) appears.
- [ ] Tap Install → app appears in the launcher with the red pin icon.
- [ ] Launch from launcher → app opens standalone (no address bar).
- [ ] (OK to skip if no Android device available — iOS is the priority for the Newport News venue.)

### 2c. Lighthouse PWA audit (desktop Chrome DevTools)
- [ ] Run Lighthouse in Chrome DevTools against the deployed URL, category "Progressive Web App".
- [ ] "Installable" checks all pass (manifest has name, short_name, icons 192+512, start_url, display, background_color).
- [ ] No warning about deprecated `apple-mobile-web-app-capable` (both spellings are present in `index.html`).

---

## PERF-03 — App shell offline + user-prompted updates

### 3a. App shell works offline
- [ ] Load the app once while online (so the SW installs and precaches).
- [ ] Close the tab, go offline.
- [ ] Reopen the app URL (or launch from homescreen).
- [ ] The UI loads — loading spinner → search form appears (served from SW precache + `localStorage`).
- [ ] No network error is shown if the cached guest list is <24h old.

### 3b. SW update flow (BLOCKING)
- [ ] While the app is open, trigger a rebuild (change any file, `npm run build`, redeploy or restart `npm run preview`).
- [ ] Within ~30 seconds, the bottom toast `New version available — Tap to refresh` appears.
- [ ] If a MapView is open (a guest is selected), the toast does NOT appear until the map is closed (D-07).
- [ ] Tap the red `Tap to refresh` button → page reloads with the new bundle.
- [ ] If the toast is left alone for 10 seconds, it auto-dismisses (D-05).

### 3c. Google Sheets URL is never cached by the SW
- [ ] Open DevTools → Application → Cache Storage.
- [ ] Confirm that NO cache entry (`floor-plan-images-v1`, `static-assets-v1`, or Workbox default caches) contains a URL matching `docs.google.com`.
- [ ] The Sheets fetch always shows as a network request in the Network tab (not "(from ServiceWorker)").

---

## PERF-04 — Env var config

### 4a. Build fails without VITE_SHEET_URL
- [ ] Run `unset VITE_SHEET_URL && npm run build` (or temporarily rename `.env.local`).
- [ ] Build fails with the exact message from `vite.config.ts`: `Build failed: VITE_SHEET_URL env var is required for production build...`

### 4b. Build succeeds with VITE_SHEET_URL
- [ ] Restore `.env.local`, rerun `npm run build` — exits 0, final line `PWA build verification passed.`

### 4c. Module-level guard in dev
- [ ] Comment out the `VITE_SHEET_URL` line in `.env.local`, run `npm run dev`.
- [ ] Open the app — error card (or uncaught module-load error in console) shows the guard message: `VITE_SHEET_URL is not set. Copy .env.example to .env.local...`
- [ ] Restore the env var → refresh → app recovers.

---

## Sign-off

| Item | Verified by | Date |
|------|-------------|------|
| PERF-01 (a–d) | | |
| PERF-02 (a–c) | | |
| PERF-03 (a–c) | | |
| PERF-04 (a–c) | | |

Once every row is signed off, mark this phase complete in `.planning/STATE.md` and proceed to `/gsd-verify-work`.

## Blocking Items Summary

Minimum to clear the phase gate:
1. **PERF-01 / 1b (offline fallback)** — Offline badge + cached search work.
2. **PERF-02 / 2a (iOS Add to Home Screen)** — Red pin icon + "Seat Finder" label + standalone launch.
3. **PERF-03 / 3b (SW update flow)** — Toast appears after redeploy, reloads on tap.

Nice-to-have (recommended but non-blocking): 1c, 1d, 2b, 2c, 3a, 3c, 4a, 4b, 4c.
