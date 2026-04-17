# Requirements: Seat-Finder

**Defined:** 2026-04-12
**Core Value:** A guest finds their table in under 10 seconds — search, see the number, see it on the map, walk there.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Search

- [ ] **SRCH-01**: Guest can search by name with fuzzy matching that handles typos and character-distance errors on mobile keyboards
- [ ] **SRCH-02**: Search results update as the guest types each character (search-as-you-type)
- [ ] **SRCH-03**: Fuzzy search returns relevant results with sensible ranking (best match first, threshold tuned to avoid false positives)
- [ ] **SRCH-04**: Search shows a clear "no results found" message when no guests match

### Map Experience

- [x] **MAP-01**: Floor plan animates with smooth pan + zoom to center on the guest's assigned table when selected
- [x] **MAP-02**: Guest can pinch-to-zoom and pan the floor plan on mobile devices
- [x] **MAP-03**: Table markers are larger and higher-contrast with visible table number labels
- [x] **MAP-04**: Animated zoom works correctly on iOS Safari without scroll bleed-through
- [x] **MAP-05**: Floor plan image is optimized for mobile (compressed, appropriate resolution)

### Data Integrity

- [ ] **DATA-01**: Table 46 and 47 have correct, distinct coordinates in floorPlan.json
- [ ] **DATA-02**: Floor plan positions use percentage-based coordinates (0-1) instead of absolute pixels, surviving image resizes
- [ ] **DATA-03**: CSV parsing uses column headers instead of positional indexes for resilience

### Performance & Offline

- [x] **PERF-01**: Guest list is cached in localStorage with stale-while-revalidate strategy (24h TTL, network-first with stale fallback)
- [x] **PERF-02**: App is installable as a PWA with offline support for static assets via service worker
- [x] **PERF-03**: Service worker precaches same-origin static assets only (never caches Google Sheets CSV URL)
- [x] **PERF-04**: Google Sheets URL is configurable via environment variable (VITE_SHEET_URL)

### Setup Tooling

- [ ] **TOOL-01**: Admin can upload a floor plan image and click on each table position to generate coordinate mappings
- [ ] **TOOL-02**: Click-to-place editor exports percentage-based coordinates compatible with the app's floorPlan config
- [ ] **TOOL-03**: Setup tool is excluded from the production guest-facing bundle (dev-only or separate route)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Search Enhancements

- **SRCH-05**: Nickname mapping for common name variations (Bob/Robert, Mike/Michael)
- **SRCH-06**: Voice search for hands-free table lookup

### Map Enhancements

- **MAP-06**: 3D/isometric venue view
- **MAP-07**: Directional arrows or path from entrance to table

### Admin

- **TOOL-04**: Auto-detect table positions from floor plan image via computer vision
- **TOOL-05**: Built-in guest list management UI (replace Google Sheets)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time seat changes | Guest list is finalized before the event |
| Multi-event support | Single wedding, not a platform |
| User accounts / authentication | Public access via QR code is the design |
| Guest check-in tracking | Not needed — this is a lookup tool, not attendance tracking |
| 3D floor plan rendering | Overkill for timeline and use case |
| Real-time sync polling | Guest list doesn't change during the event |
| Push notifications | No user accounts, no notification targets |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| SRCH-01 | Phase 2 | Pending |
| SRCH-02 | Phase 2 | Pending |
| SRCH-03 | Phase 2 | Pending |
| SRCH-04 | Phase 2 | Pending |
| MAP-01 | Phase 3 | Complete |
| MAP-02 | Phase 3 | Complete |
| MAP-03 | Phase 3 | Complete |
| MAP-04 | Phase 3 | Complete |
| MAP-05 | Phase 3 | Complete |
| PERF-01 | Phase 4 | Complete |
| PERF-02 | Phase 4 | Complete |
| PERF-03 | Phase 4 | Complete |
| PERF-04 | Phase 4 | Complete |
| TOOL-01 | Phase 5 | Pending |
| TOOL-02 | Phase 5 | Pending |
| TOOL-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 after roadmap creation*
