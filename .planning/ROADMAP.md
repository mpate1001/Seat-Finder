# Roadmap: Seat-Finder

## Overview

Starting from a working React/Vite app with basic search and a static floor plan, this roadmap polishes Seat-Finder into an event-ready guest experience. Phases progress from fixing data integrity bugs through fuzzy search, an animated map, offline resilience, and finally a click-to-place setup tool that eliminates manual coordinate mapping for future floor plan changes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Integrity** - Fix the table coordinate bug and harden data parsing so all downstream features build on a correct foundation
- [ ] **Phase 2: Fuzzy Search** - Replace `.includes()` with fuzzy matching so guests find their name despite typos and mobile keyboard errors
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
**Plans**: TBD

### Phase 3: Map Experience
**Goal**: Selecting a guest animates the floor plan to center on their table, and the map is usable on mobile
**Depends on**: Phase 1
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05
**Success Criteria** (what must be TRUE):
  1. After selecting a name, the floor plan smoothly pans and zooms to place the guest's table near the center of the screen
  2. A guest on an iPhone can pinch to zoom and drag to pan the floor plan without triggering page scroll
  3. Table markers show their table number as a readable label and are large enough to tap accurately on a phone screen
  4. The animated zoom works correctly on iOS Safari — no scroll bleed-through or layout jump occurs
  5. The floor plan image loads quickly on a mobile device — visibly compressed without quality loss on phone screens
**Plans**: TBD
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
**Plans**: TBD

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
| 1. Data Integrity | 0/3 | Not started | - |
| 2. Fuzzy Search | 0/TBD | Not started | - |
| 3. Map Experience | 0/TBD | Not started | - |
| 4. Performance & Offline | 0/TBD | Not started | - |
| 5. Setup Tooling | 0/TBD | Not started | - |
