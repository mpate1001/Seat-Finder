# Seat-Finder

## What This Is

A mobile-first wedding guest seating app for Mahek & Saumya's reception in Newport News, VA. Guests scan a QR code, search for their name, see their table number, and get an animated visual guide showing exactly where their table is on the venue floor plan. The app prioritizes speed and simplicity during high-throughput check-in.

## Core Value

A guest finds their table in under 10 seconds — search, see the number, see it on the map, walk there.

## Requirements

### Validated

- ✓ Guest can search by name and see matching results — existing
- ✓ Guest can view their assigned table number — existing
- ✓ Guest can see their table highlighted on a floor plan — existing
- ✓ Guest list is sourced from Google Sheets CSV — existing
- ✓ Floor plan uses JSON-configured table positions — existing

### Active

- [ ] Animated zoom-to-table map experience (smooth pan + zoom to highlighted table)
- [ ] Auto-detect table positions from uploaded floor plan image
- [ ] Fuzzy search for name variations and typos on mobile keyboards
- [ ] Guest data caching for offline/fast repeat access
- [ ] Fix duplicate table 46/47 coordinate bug
- [ ] Improved floor plan readability (labels, color coding, clearer markers)
- [ ] Faster initial page load on mobile devices
- [ ] Environment-based configuration (sheet URL not hardcoded)

### Out of Scope

- Built-in guest management UI — Google Sheets workflow works fine
- 3D/isometric venue rendering — overkill for timeline and use case
- Real-time seat changes — guest list is finalized before the event
- Multi-event support — this is for one wedding
- User accounts or authentication — public access via QR code is the design

## Context

- Existing React 18 SPA built with Vite, TypeScript, no backend
- Floor plan is a custom image drawn by the couple, with table coordinates manually mapped in JSON
- The biggest pain point is the floor plan setup: creating the image AND mapping every table's pixel coordinates by hand
- Search currently uses basic `.includes()` — needs fuzzy matching for the stress of check-in (typos, nicknames)
- Tables 46 and 47 share identical coordinates (bug in floorPlan.json)
- No data caching — every page load re-fetches from Google Sheets
- Wedding is approximately 1-2 months out (from 2026-04-12), so there's time to polish
- Mobile-first: most guests will use phones at the venue

## Constraints

- **Tech stack**: React/Vite/TypeScript — keep the existing stack, don't rewrite
- **Data source**: Google Sheets CSV — working well, no reason to change
- **Hosting**: Static site — no backend server, keep it simple
- **Timeline**: ~1-2 months to ship polished version
- **Primary device**: Mobile phones at the venue — performance on cellular/WiFi is critical
- **Floor plan input**: User-drawn image (Canva, Figma, etc.) — auto-detection must work with various image styles

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep Google Sheets as data source | Works well, familiar, easy to update guest list | ✓ Good |
| Keep React/Vite stack | Existing app works, no reason to rewrite | ✓ Good |
| Static hosting, no backend | Simplicity and reliability for a one-day event | ✓ Good |
| Auto-detect table positions from image | Manual pixel mapping is the #1 setup pain point | — Pending |
| Animated zoom-to-table | Best balance of polish and feasibility for timeline | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after initialization*
