# External Integrations

**Analysis Date:** 2026-04-12

## APIs & External Services

**Google Sheets (Published CSV):**
- Purpose: Guest list data source (names, table numbers, contact info, descriptions)
- Implementation: `src/services/googleSheets.ts`
- Method: HTTP GET to a published Google Sheets CSV endpoint using native `fetch`
- URL: Hardcoded public URL in `src/services/googleSheets.ts` line 3
  - `https://docs.google.com/spreadsheets/d/e/2PACX-1vT2CjdXZd0XrE_Q9_BoNWhIqr69ElM60e7CgVvYSWIVA4QRs8CtVV-3UWqWaco9jk9iestkouEd_7en/pub?output=csv`
- Auth: None required (sheet is published to the web)
- Response format: CSV text, parsed client-side with custom `parseCSVLine()` function
- CSV columns (order matters): tableNumber, firstName, lastName, contactInfo, description
- Error handling: Throws user-friendly error message on fetch failure; logged to console

**No other external APIs are used.** The app is entirely client-side with a single external data dependency.

## Data Storage

**Databases:**
- None. No database is used.

**Primary Data Source:**
- Google Sheets published as CSV (see above)
- Data is fetched fresh on every page load into React state
- No client-side caching or persistence (no localStorage, no IndexedDB, no service worker)

**Static Configuration:**
- `src/config/floorPlan.json` - Floor plan table positions (54 tables mapped with pixel x/y coordinates)
  - `canvasWidth: 3300`, `canvasHeight: 2517` (reference dimensions for the floor plan image)
  - Each table has a numeric key ("1" through "54") with `{x, y}` pixel position

**Static Assets:**
- `src/assets/mahsompw-6074Z70_6074.jpeg` - Background image (~3.9 MB)
- `src/assets/Reception Seat Diagram.png` - Floor plan image (~1.5 MB)

**File Storage:**
- Local filesystem only (static assets bundled by Vite)

**Caching:**
- None. No caching strategy implemented.

## Authentication & Identity

**Auth Provider:**
- None. The app is fully public with no authentication.
- Accessed via QR code scan at the wedding venue
- No user accounts, sessions, or tokens

## Monitoring & Observability

**Error Tracking:**
- None. No external error tracking service (no Sentry, no LogRocket, etc.)

**Logs:**
- `console.error()` only, used in `src/services/googleSheets.ts` for fetch failures
- No structured logging

## CI/CD & Deployment

**Hosting:**
- Not configured. No deployment configuration files detected (no `vercel.json`, `netlify.toml`, `Dockerfile`, or similar)
- The `dist/` directory contains a built version, suitable for any static hosting

**CI Pipeline:**
- None configured (no `.github/workflows/`, no CI config files)

**Build Command:**
- `npm run build` produces static output in `dist/`

## Environment Configuration

**Required env vars:**
- None. The application has no environment variables.
- No `.env` files present
- The Google Sheets URL is hardcoded in source code

**Secrets location:**
- No secrets are used. The Google Sheets endpoint is a public published URL.

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Integration Risk Assessment

**Google Sheets Dependency:**
- The entire app depends on a single Google Sheets published CSV URL being available
- If the sheet is unpublished, the URL changes, or Google Sheets is down, the app shows an error with a retry button
- The URL is hardcoded in `src/services/googleSheets.ts` -- changing the data source requires a code change and rebuild
- CSV parsing is done with a custom parser (not a library), which handles quoted fields but may be fragile with edge cases

**Asset Size:**
- Background image: ~3.9 MB (not optimized)
- Floor plan image: ~1.5 MB (not optimized)
- These are bundled into `dist/assets/` by Vite and served as static files
- No CDN configured; loading speed depends entirely on hosting provider

---

*Integration audit: 2026-04-12*
