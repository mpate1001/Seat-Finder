# Phase 2: Fuzzy Search - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning
**Source:** Interactive discuss-phase

<domain>
## Phase Boundary

Replace the current plain substring search in `App.tsx` (`handleSearch`) with a fuzzy
matching system that tolerates typos, mobile-keyboard errors, and partial names so
guests can find their entry even with imperfect input.

**In scope:**
- Fuzzy matcher integration (lib selection, config, indexing)
- Ranked results with best-match-first ordering
- Search-as-you-type responsiveness (debounce tuning retained)
- "No results" messaging
- Match highlighting in dropdown results
- Result count cap

**Out of scope:**
- Nickname mapping (Bob/Robert) — deferred to v2 SRCH-05
- Voice search — deferred to v2 SRCH-06
- Searching contactInfo/description fields — explicitly excluded
- Map animations on selection — Phase 3

**Requirement IDs:** SRCH-01, SRCH-02, SRCH-03, SRCH-04

</domain>

<decisions>
## Implementation Decisions

### Fuzzy library
- **Fuse.js** is the selected library.
- Rationale: battle-tested, handles threshold + per-field weights + match
  highlighting out of the box. ~12KB is negligible for ~100-200 guests on a
  static-hosted app. uFuzzy and hand-rolled Levenshtein rejected for
  lower marginal value.

### Match strictness
- **Moderate-forgiving** — Fuse `threshold` ≈ `0.3` (planner may tune within
  `0.25`–`0.4` based on test data).
- Rationale: wedding context — tired, mobile-typing guests. Prefer showing
  2 candidates over showing zero. Guest names are unique enough that
  false positives are low-risk.
- Acceptance: "Smih" → "Smith", "Saumy" → "Saumya", "Mahke" → "Mahek" all
  return the correct guest in top-3.

### Search fields
- Search over `firstName` and `lastName` **only**, weighted equally.
- Do NOT include `contactInfo` or `description` — those are admin notes,
  not identifiers. Searching "bride" should not match 40 guests whose
  description includes "bride's side".

### Results ranking — tiered (substring-first)
- **Tier 1:** Exact substring matches (prefix preferred over contains)
  always rank above fuzzy matches.
- **Tier 2:** Fuse fuzzy matches below substring hits, ordered by Fuse score.
- Rationale: guest typing "Mah" should see "Mahek Patel" before any
  fuzzy-matched "Max Patel". Protects against surprising fuzzy ranking.

### Minimum query length
- **1 character** — start searching immediately on the first keystroke.
- Rationale: SRCH-02 requires search-as-you-type; min=2/3 feels laggy.

### Result count cap
- **Top 10** results displayed, ranked best-first.
- Rationale: at 1-char queries a guest could match 30+ names; 10 is
  scrollable on mobile and avoids overwhelming the dropdown.

### No-results UX
- Message: **"No guests match '{query}'. Check spelling or try last name only."**
- Clean message with actionable hint. No separate "did you mean" suggestion —
  Fuse's forgiving threshold surfaces close matches *before* a user hits
  the no-results state.

### Match highlighting
- **Yes** — bold the matched characters inside each dropdown row.
- Fuse's `includeMatches: true` + `minMatchCharLength` provides match
  indices; render with `<strong>` around matched chars.
- Rationale: helps the guest visually confirm they picked the right person.
  Low cost, high UX value.

### Claude's Discretion
- Debounce interval (currently 150ms in `SearchForm.tsx`) — keep or tune.
- Fuse configuration knobs not explicitly decided above (`distance`,
  `minMatchCharLength`, `ignoreLocation`, etc.).
- How to structure the "substring-first tier" code — utility function,
  hook, or inline in `handleSearch`.
- Whether to pre-compute the Fuse index once at `loadGuests` time or
  recreate per query (planner should choose pre-compute for perf).
- Display copy for the top-result hint if desired (e.g. "Showing best
  matches for 'Smih'").
- Unit test structure — planner chooses framework if tests are added.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, requirement mapping
- `.planning/REQUIREMENTS.md` — SRCH-01 through SRCH-04 definitions and v2 deferred items (SRCH-05, SRCH-06)
- `.planning/PROJECT.md` — Core value (10-second lookup), mobile-first, tech stack constraints

### Existing code (must integrate, not replace wholesale)
- `src/App.tsx` — `handleSearch` function to replace; state flow `guests → searchResults → GuestDropdown`
- `src/components/SearchForm.tsx` — debounced input; callback contract `onSearch(term: string)`
- `src/components/GuestDropdown.tsx` — result rendering; needs extension for match highlighting
- `src/types.ts` — `Guest` interface (firstName, lastName, tableNumber, contactInfo, description)

### Conventions to follow
- `./CLAUDE.md` — Naming, import style, component patterns, error handling
- Existing debounce pattern in `SearchForm.tsx` (150ms via `useRef` timer)

### External docs
- Fuse.js: https://www.fusejs.io/api/options.html (threshold, keys, includeMatches)

</canonical_refs>

<specifics>
## Specific Ideas

- Test cases to validate against:
  - "Smih" → "Smith" found
  - "Saumy" → "Saumya" found in top-3
  - "Mah" → "Mahek Patel" ranked #1 (substring-first)
  - "xyz" (no match) → clean "No guests match 'xyz'..." message
  - Empty input → empty dropdown (current behavior preserved)

- Highlighting example: if query is "mah" and result is "Mahek Patel",
  render as **Mah**ek Patel with bold on matched chars only.

</specifics>

<deferred>
## Deferred Ideas

- **Nickname mapping** (Bob/Robert, Mike/Michael) — v2 SRCH-05
- **Voice search** — v2 SRCH-06
- **Search contactInfo/description fields** — not in v1 scope; admin notes are not identifiers
- **"Did you mean?" suggestion UI** — forgiving threshold makes this unnecessary for now

</deferred>

---

*Phase: 02-fuzzy-search*
*Context gathered: 2026-04-12 via /gsd-discuss-phase*
