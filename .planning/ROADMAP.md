# Roadmap: Seat-Finder

## Overview

Starting from a working React/Vite app with basic search and a static floor plan, this roadmap polishes Seat-Finder into an event-ready guest experience. Phases progress from fixing data integrity bugs through fuzzy search, an animated map, offline resilience, and finally a click-to-place setup tool that eliminates manual coordinate mapping for future floor plan changes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Integrity** - Fix the table coordinate bug and harden data parsing so all downstream features build on a correct foundation
- [x] **Phase 2: Fuzzy Search** - Replace `.includes()` with fuzzy matching so guests find their name despite typos and mobile keyboard errors
- [ ] **Phase 3: Map Experience** - Add animated pan+zoom, pinch-to-zoom, and improved markers so guests can visually navigate to their table
- [ ] **Phase 4: Performance & Offline** - Cache the guest list and install a PWA service worker so the app works reliably on venue WiFi and poor cellular
- [ ] **Phase 5: Setup Tooling** - Build a click-to-place floor plan editor so future table coordinate mapping requires no manual pixel work

## Phase Details

### Phase 1: Data Integrity
**Goal**: All table positions are correct and data parsing is resilient to format changes
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. Tables 46 and 47 appear in visually distinct positions on the floor plan — they no longer overlap
  2. Resizing the browser window or changing the floor plan image does not shift any table marker off its correct position
  3. A guest list CSV with reordered or renamed columns still parses correctly without code changes
**Plans**: 3 plans
- [ ] 01-01-PLAN.md — Migrate floorPlan.json to percentage coords and fix table 47 (DATA-01, DATA-02)
- [ ] 01-02-PLAN.md — Rewrite FloorPlan.tsx scaling math with ResizeObserver, drop canvas fields (DATA-02)
- [ ] 01-03-PLAN.md — Header-indexed CSV parsing in googleSheets.ts (DATA-03)

### Phase 2: Fuzzy Search
**Goal**: Guests can find their name even with typos, partial names, or mobile autocorrect errors
**Depends on**: Phase 1
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04
**Success Criteria** (what must be TRUE):
  1. Typing a name with one or two character errors (e.g. "Smih" for "Smith") still returns the correct guest
  2. Results update visibly after each keystroke with no perceptible lag
  3. The best-matching name appears first in the results list
  4. Searching a string that matches no guest shows a clear "no results found" message rather than a blank list
**Plans**: 2 plans
- [x] 02-01-PLAN.md — Install Fuse.js, build tiered-ranking searchGuests util, wire into App.tsx (SRCH-01, SRCH-02, SRCH-03, SRCH-04)
- [x] 02-02-PLAN.md — HighlightedText component, GuestDropdown highlights + no-results card, UAT (SRCH-02, SRCH-03, SRCH-04)

### Phase 3: Map Experience
**Goal**: Selecting a guest animates the floor plan to center on their table, and the map is usable on mobile
**Depends on**: Phase 1
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05
**Carried forward from Phase 1 UAT**: Enlarged floor plan modal is constrained to phone-width container (wallpaper shows around it) — should fill viewport when enlarged
**Success Criteria** (what must be TRUE):
  1. After selecting a name, the floor plan smoothly pans and zooms to place the guest's table near the center of the screen
  2. A guest on an iPhone can pinch to zoom and drag to pan the floor plan without triggering page scroll
  3. Table markers show their table number as a readable label and are large enough to tap accurately on a phone screen
  4. The animated zoom works correctly on iOS Safari — no scroll bleed-through or layout jump occurs
  5. The floor plan image loads quickly on a mobile device — visibly compressed without quality loss on phone screens
**Plans**: 5 plans
- [x] 03-01-PLAN.md — Install test + runtime deps (vitest, sharp, react-zoom-pan-pinch); create vitest config + test stubs (foundation for all Phase 3 plans)
- [x] 03-02-PLAN.md — Write scripts/generate-images.mjs and emit 9 committed image variants to public/floor-plan/ (MAP-05)
- [x] 03-03-PLAN.md — Create MapView.tsx + MapView.css: full-screen overlay, TransformWrapper, 250ms/700ms zoom sequence, Escape + popstate dismissal (MAP-01, MAP-02, MAP-04)
- [x] 03-04-PLAN.md — Refactor FloorPlan.tsx + FloorPlan.css: <picture> srcset, percentage markers, pin-assigned teardrop + pin-dot + adaptive labels (MAP-03, MAP-05)
- [x] 03-05-PLAN.md — Wire MapView into App.tsx, add preload link + hidden img, delete TableModal, author tests, run full vitest/lint/build gate (MAP-01..MAP-05)
**UI hint**: yes

### Phase 4: Performance & Offline
**Goal**: The app loads fast and works reliably at the venue regardless of network conditions
**Depends on**: Phase 2
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. A guest who loaded the app earlier can still search for their name when venue WiFi drops — the cached guest list is served from localStorage
  2. The app can be added to a phone's home screen and opens without a browser URL bar
  3. Static assets (JS, CSS, images) load from the service worker cache on repeat visits — no network round trip needed
  4. The Google Sheets URL is not hardcoded — changing it requires only an environment variable update, not a code edit
**Plans**: 6 plans
- [x] 04-01-PLAN.md — Env var plumbing: VITE_SHEET_URL, .env.example, vite-env.d.ts, fail-fast guards, extract parseGuestsCsv (PERF-04)
- [x] 04-02-PLAN.md — guestsCache.ts SWR wrapper (2s timeout, 24h TTL, localStorage), wire into App.tsx with fetchedAt state (PERF-01)
- [x] 04-03-PLAN.md — scripts/generate-pwa-icons.mjs + sharp; emit 4 PWA icons to public/ (PERF-02 prerequisite)
- [x] 04-04-PLAN.md — useOnlineStatus + useCacheAge hooks; StalenessBadge component; wire into App.tsx (PERF-01 UX)
- [x] 04-05-PLAN.md — vite-plugin-pwa install + config (manifest, workbox, devOptions), Apple meta tags, UpdateToast portal component with suppression (PERF-01, PERF-02, PERF-03)
- [x] 04-06-PLAN.md — verify-pwa-build.mjs smoke test, README + CLAUDE.md docs, 04-UAT.md checklist, human-verify checkpoint (PERF-01..PERF-04)

### Phase 5: Setup Tooling
**Goal**: An admin can map all table positions on a new floor plan by clicking on the image — no pixel coordinate calculation needed
**Depends on**: Phase 1
**Requirements**: TOOL-01, TOOL-02, TOOL-03
**Success Criteria** (what must be TRUE):
  1. An admin can upload a floor plan image in the editor, click on each table location, and assign a table number to that position
  2. The editor exports a JSON file with percentage-based coordinates that can be dropped directly into the app's floorPlan config
  3. The setup tool is completely absent from the production guest-facing build — it does not appear in any guest-facing route or bundle
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Integrity | 3/3 | Complete | 2026-04-12 |
| 2. Fuzzy Search | 2/2 | Complete | 2026-04-16 |
| 3. Map Experience | 0/5 | Planning complete | - |
| 4. Performance & Offline | 0/6 | Planning complete | - |
| 5. Setup Tooling | 0/TBD | Not started | - |
