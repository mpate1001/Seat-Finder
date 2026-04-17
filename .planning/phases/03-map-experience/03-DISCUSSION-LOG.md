# Phase 3: Map Experience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `03-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 03-map-experience
**Areas discussed:** Interaction surface, Pan/zoom library, Markers & labels, Image optimization

---

## Interaction surface

### Q1: Where should the animated zoom-to-table map live?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen on select (Recommended) | Selecting a guest opens a full-viewport animated map as the primary payoff. Skips the current Welcome modal — or folds a small greeting badge onto the map. Fewest taps to 'see it on the map'. Requires restructuring TableModal. | ✓ |
| Progressive reveal | Current TableModal opens first (Welcome, {firstName}! + table number + description), then after ~600–800ms auto-expands to a full-viewport animated map. Preserves the personal greeting moment before the map takes over. | |
| Inline animate, same modal | Keep the existing TableModal chrome. Only the small inline floor plan animates zoom-to-table. Lowest risk, smallest UX jump. | |

**User's choice:** Full-screen on select

---

### Q2: What happens to the 'Welcome, {firstName}!' greeting and description?

| Option | Description | Selected |
|--------|-------------|----------|
| Overlay card on the map (Recommended) | Small non-intrusive card pinned at the top of the full-screen map: 'Welcome, Mahek! — Table 7'. Description below. Map is hero; personal touch survives. | ✓ |
| Brief intro → fade | Show greeting as a ~1.2s full-bleed intro, then fade into the map. Dramatic but adds a beat. | |
| Drop greeting, map only | No greeting card. Table number as badge. Fastest, but loses personal moment. | |

**User's choice:** Overlay card on the map

---

### Q3: How should the guest exit the full-screen map?

| Option | Description | Selected |
|--------|-------------|----------|
| Close X + back gesture (Recommended) | Visible × button in a top corner, plus Android/iOS hardware back / browser-back also closes. Discoverable + native-feeling. | ✓ |
| Close X only | Just the top-corner × button. Simplest, most predictable. | |
| Swipe-down + X | iOS-style swipe-down plus × button. Feels native but gesture-conflict risk with pan/zoom. | |

**User's choice:** Close X + back gesture

---

### Q4: Full viewport on desktop, or bounded?

| Option | Description | Selected |
|--------|-------------|----------|
| Always full viewport (Recommended) | Fills the whole browser window on any size. Consistent. Resolves Phase 1 UAT carry-forward. | ✓ |
| Full on mobile, centered card on desktop | Full viewport up to some breakpoint, max-width centered overlay on desktop. | |

**User's choice:** Always full viewport

---

## Pan/zoom library

### Q1: Which pan/zoom library should power the map?

| Option | Description | Selected |
|--------|-------------|----------|
| react-zoom-pan-pinch (Recommended) | Most popular React option. Built-in `zoomToElement`. Handles iOS Safari correctly. ~15KB. | ✓ |
| @use-gesture/react + Framer Motion | Lower-level. Maximum control. ~25KB combined. More code to write. | |
| Hand-rolled with CSS transforms + Pointer Events | Zero deps. Most risk on iOS edge cases. Largest engineering surface. | |

**User's choice:** react-zoom-pan-pinch

---

### Q2: Where does the animation start?

| Option | Description | Selected |
|--------|-------------|----------|
| Overview → zoom in (Recommended) | Opens with full floor plan visible and the table pulse already active. After ~250ms, smoothly animates zoom-in over ~700ms. Spatial context first, then focus. | ✓ |
| Open already zoomed on table | Skip the overview beat. Fastest. Loses spatial orientation. | |
| Overview only, user zooms manually | No auto-zoom. Safest. Loses the SRCH→MAP 'wow' and adds a gesture step. | |

**User's choice:** Overview → zoom in

---

### Q3: How tightly should auto-zoom land?

| Option | Description | Selected |
|--------|-------------|----------|
| Tight on table + neighbors (Recommended) | ~2.5–3× zoom. Assigned table is prominent; neighbors visible for reference. | ✓ |
| Very tight on table | ~4–5× zoom. Unmistakable but loses spatial reference. | |
| Whole-room anchored | ~1.5–2× zoom. Maximum context; lowest 'wow'. | |

**User's choice:** Tight on table + neighbors

---

## Markers & labels (MAP-03)

### Q1: Which tables display number labels?

| Option | Description | Selected |
|--------|-------------|----------|
| All tables, adaptive by zoom (Recommended) | At overview zoom: only the assigned table's label. As user zooms in, neighbor labels fade in. Scannable context without overwhelming overview. | ✓ |
| All tables always labeled | Every label always visible. Overlaps on phone at overview. | |
| Only the guest's table | Only assigned table labeled; others unlabeled dots. Loses orientation context. | |

**User's choice:** All tables, adaptive by zoom

---

### Q2: What does the 'you are here' marker look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Red pin with number (Recommended) | Pin/teardrop in #d90429 with number centered in white bold. Subtle pulse. Iconic, tappable. | ✓ |
| Red circle + floating badge | Current red pulsing circle + floating '#7' badge above. Label DOM separate. | |
| Glowing ring around table | Soft red glow encircling the table. Gentler, harder to see at small zoom. | |

**User's choice:** Red pin with number

---

### Q3: How should OTHER tables look?

| Option | Description | Selected |
|--------|-------------|----------|
| Muted dots, same footprint (Recommended) | Small desaturated circles (#8d99ae), same 44×44 tap target. Adaptive labels per Q1. Clear hierarchy. | ✓ |
| Outlined circles only | Thin outlined rings. Most recessive. Lower contrast. | |
| Hidden until zoomed in | No markers at overview. Cleanest overview; no neighboring-table context. | |

**User's choice:** Muted dots, same footprint

---

## Image optimization (MAP-05)

### Q1: Which image format?

| Option | Description | Selected |
|--------|-------------|----------|
| AVIF → WebP → PNG fallback (Recommended) | `<picture>` with AVIF primary, WebP mid-tier, PNG final fallback. 50–70% savings vs PNG. | ✓ |
| WebP with PNG fallback | Simpler two-tier. ~30–45% savings. Universal support. | |
| Compressed PNG only | oxipng lossless. 20–30% savings. Zero format-negotiation complexity. | |

**User's choice:** AVIF → WebP → PNG fallback

---

### Q2: Multiple sizes?

| Option | Description | Selected |
|--------|-------------|----------|
| srcset: phone + tablet + desktop (Recommended) | 3 sizes via srcset + sizes. Phones download the 900px asset. Biggest mobile bandwidth win. | ✓ |
| Single optimized asset | One file sized for largest viewport. Simplest. | |

**User's choice:** srcset: phone + tablet + desktop

---

### Q3: When to fetch?

| Option | Description | Selected |
|--------|-------------|----------|
| Preload on app mount (Recommended) | Fetch during initial guest-list load. Zero delay on map reveal. | ✓ |
| Lazy — only after guest selected | Don't fetch until selected. Minimal first paint. Risk of visible loading. | |
| Preload on first search interaction | Halfway — fetch on first keystroke. | |

**User's choice:** Preload on app mount

---

## Claude's Discretion

- Exact animation timings (overview beat, zoom-in duration, easing curve) within the ~250ms / ~700ms targets
- Min/max user-controlled zoom bounds
- Adaptive label fade-in threshold
- Exact srcset breakpoints (900/1600/2400 is a recommendation)
- Whether to add a one-time "pinch to zoom" first-time hint
- Haptic feedback on arrival (likely skipped)

## Deferred Ideas

- Tap-a-marker to select that guest (out of phase scope)
- Directional arrows / path-from-entrance (v2 MAP-07)
- 3D / isometric venue view (v2 MAP-06)
- Background photo optimization (Phase 4 perf item)
- First-time hint toast (Claude's Discretion)
- Family grouping (backlog 999-01, parked during Phase 2 UAT)
