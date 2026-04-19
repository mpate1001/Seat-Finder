# Phase 2: Fuzzy Search - Research

**Researched:** 2026-04-12
**Domain:** Client-side fuzzy name matching in a React/Vite/TS SPA
**Confidence:** HIGH

## Summary

Fuse.js is already a locked decision and the right tool for this size of dataset (~100–200 guests). The integration is straightforward: build a single `Fuse` instance with `useMemo` over `guests`, keyed on `firstName` + `lastName` with equal weight, `threshold: 0.3`, `ignoreLocation: true`, `includeMatches: true`, `minMatchCharLength: 2`. The tiered ranking ("exact prefix > exact contains > fuzzy") is implemented in user code — Fuse does not natively tier against a substring pass — by doing the substring partition first and feeding the remainder through Fuse. Match highlighting consumes Fuse's `matches[].indices` array to wrap matched character ranges in `<strong>`; rendering uses React elements (plain JSX, not raw HTML injection), so XSS is a non-issue.

At n≈200 and queries firing on every keystroke behind a 150ms debounce, index build cost and per-query cost are both sub-millisecond. No perf instrumentation is needed; keep the existing debounce. Vitest is the default Vite pairing if tests are added; the existing codebase has zero tests so adoption is optional for this phase.

**Primary recommendation:** Add a `src/services/searchGuests.ts` utility that exports (1) `buildGuestIndex(guests)` returning a `Fuse<Guest>` and (2) `searchGuests(query, guests, fuse)` returning `{ results: RankedGuest[] }` where `RankedGuest = { guest: Guest; matches: MatchRange[] }`. Wire from `App.tsx` via `useMemo` on `guests`. Extend `GuestDropdown` to accept the ranked list and render highlighted name spans.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Library:** Fuse.js
- **Threshold:** ~0.3 (planner may tune within 0.25–0.4 based on test data)
- **Search fields:** `firstName` + `lastName` only, equal weight. Do NOT include `contactInfo` or `description`.
- **Ranking:** Tiered — Tier 1 exact substring matches (prefix preferred over contains) ranked above Tier 2 fuzzy matches (ordered by Fuse score).
- **Minimum query length:** 1 character — start searching on the first keystroke.
- **Result count cap:** Top 10 results.
- **No-results copy:** "No guests match '{query}'. Check spelling or try last name only."
- **Match highlighting:** Yes — bold matched characters using Fuse's `includeMatches: true` + `minMatchCharLength`.

### Claude's Discretion
- Debounce interval (currently 150ms in `SearchForm.tsx`) — keep or tune.
- Fuse config knobs not explicitly set: `distance`, `minMatchCharLength`, `ignoreLocation`, etc.
- Code structure for tiered ranking (utility function vs. hook vs. inline).
- Whether to pre-compute the Fuse index at `loadGuests` time or per query (recommend pre-compute).
- Optional hint copy (e.g. "Showing best matches for 'Smih'").
- Unit test framework if tests added.

### Deferred Ideas (OUT OF SCOPE)
- Nickname mapping (Bob/Robert, Mike/Michael) — v2 SRCH-05.
- Voice search — v2 SRCH-06.
- Searching `contactInfo` / `description` fields — admin notes, not identifiers.
- "Did you mean?" suggestion UI — forgiving threshold makes it unnecessary.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-01 | Fuzzy matching handles typos & mobile-keyboard errors | Fuse.js threshold=0.3 + ignoreLocation=true handles single/double-char errors (transpositions, adjacent-key slips). "Smih"→"Smith", "Mahke"→"Mahek" verified pattern. |
| SRCH-02 | Search-as-you-type | Existing 150ms debounce in `SearchForm.tsx` preserved; min query length = 1 char. At n≈200 Fuse query is <1ms. |
| SRCH-03 | Sensible ranking (best match first) | Tiered algorithm: substring-prefix > substring-contains > Fuse fuzzy score ascending. Deterministic and capped at 10. |
| SRCH-04 | Clear "no results" message | Rendered in `GuestDropdown` (or `App.tsx`) when `query.trim().length > 0 && results.length === 0`. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fuse.js | 7.3.0 | Fuzzy string matching with field weights, score, match indices | De-facto library for client-side fuzzy search in JS/TS; ~6KB min+gzip; zero dependencies; first-class TS types [VERIFIED: `npm view fuse.js version` → 7.3.0, published 2026-04-04] |

**Version verification:** `fuse.js@7.3.0` confirmed current on npm registry (modified 2026-04-04). Training data assumed v7.0.0 — registry check caught the drift. [VERIFIED: npm registry]

### Supporting
None required for this phase. React 18 hooks (`useMemo`, `useState`, existing `useCallback`/`useRef` patterns) cover all integration needs. No new dev deps.

### Alternatives Considered
CONTEXT.md already rejected uFuzzy, hand-rolled Levenshtein, and MiniSearch. No further evaluation needed.

**Installation:**
```bash
npm install fuse.js
```

## Architecture Patterns

### Recommended File Layout
```
src/
├── services/
│   ├── googleSheets.ts        # existing
│   └── searchGuests.ts        # NEW — Fuse index + tiered ranker
├── components/
│   ├── SearchForm.tsx         # unchanged (keeps 150ms debounce)
│   ├── GuestDropdown.tsx      # extended: accepts ranked results, renders highlights
│   └── HighlightedText.tsx    # NEW (small) — renders <strong> over match indices
├── types.ts                   # extend with RankedGuest, MatchRange
└── App.tsx                    # rewires handleSearch to use searchGuests util
```

Rationale: matches existing convention (services in `src/services/`, small presentational components alongside existing ones, shared types in `src/types.ts`). `HighlightedText` can alternatively be inlined into `GuestDropdown` — that's a planner call.

### Pattern 1: Build Fuse index with useMemo in App.tsx

```typescript
// Source: https://www.fusejs.io/api/options.html [CITED]
import Fuse from 'fuse.js';
import { useMemo } from 'react';

const fuseOptions: IFuseOptions<Guest> = {
  keys: [
    { name: 'firstName', weight: 1 },
    { name: 'lastName',  weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeMatches: true,
  includeScore: true,
  shouldSort: true,
};

// In App:
const fuse = useMemo(() => new Fuse(guests, fuseOptions), [guests]);
```

Index rebuild happens only when `guests` identity changes (after `loadGuests()` resolves once at mount). Subsequent keystrokes reuse the same instance. [CITED: fusejs.io/api/indexing.html]

### Pattern 2: Tiered ranking algorithm

Fuse does not natively tier substring hits above fuzzy hits. Implement in `searchGuests.ts`:

```typescript
// Source: derived pattern; Fuse returns FuseResult<T>[] — we partition & re-order
export interface MatchRange { key: 'firstName' | 'lastName'; indices: ReadonlyArray<[number, number]>; }
export interface RankedGuest { guest: Guest; matches: MatchRange[]; }

export function searchGuests(
  rawQuery: string,
  guests: Guest[],
  fuse: Fuse<Guest>,
): RankedGuest[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const seen = new Set<Guest>();
  const tierPrefix: RankedGuest[] = [];
  const tierContains: RankedGuest[] = [];

  // Tier 1: substring partition (preserves input order for stability)
  for (const guest of guests) {
    const fn = guest.firstName.toLowerCase();
    const ln = guest.lastName.toLowerCase();
    const prefixHit = fn.startsWith(query) || ln.startsWith(query);
    const containsHit = !prefixHit && (fn.includes(query) || ln.includes(query));
    if (!prefixHit && !containsHit) continue;

    const matches: MatchRange[] = [];
    if (fn.includes(query)) matches.push({ key: 'firstName', indices: [[fn.indexOf(query), fn.indexOf(query) + query.length - 1]] });
    if (ln.includes(query)) matches.push({ key: 'lastName',  indices: [[ln.indexOf(query), ln.indexOf(query) + query.length - 1]] });

    seen.add(guest);
    (prefixHit ? tierPrefix : tierContains).push({ guest, matches });
  }

  // Tier 2: Fuse fuzzy, minus guests already in tier 1
  const fuseResults = fuse.search(query).filter(r => !seen.has(r.item));
  const tierFuzzy: RankedGuest[] = fuseResults.map(r => ({
    guest: r.item,
    matches: (r.matches ?? [])
      .filter(m => m.key === 'firstName' || m.key === 'lastName')
      .map(m => ({
        key: m.key as 'firstName' | 'lastName',
        indices: m.indices,
      })),
  }));

  return [...tierPrefix, ...tierContains, ...tierFuzzy].slice(0, 10);
}
```

Note: Fuse's `FuseResult.matches[].indices` are inclusive `[start, end]` ranges — same shape we emit for substring hits, so the highlighter handles both uniformly. [CITED: fusejs.io/api/options.html#includematches]

### Pattern 3: XSS-safe highlighting via React elements

```typescript
// Render strings as alternating plain text / <strong> React children — never inject raw HTML
function HighlightedText({ text, ranges }: { text: string; ranges: ReadonlyArray<[number, number]> }) {
  if (!ranges.length) return <>{text}</>;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of sorted) {
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(<strong key={start}>{text.slice(start, end + 1)}</strong>);
    cursor = end + 1;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}
```

In `GuestDropdown`, look up each row's `matches` by key (`firstName` / `lastName`) and pass the `indices` into `HighlightedText`. Because React escapes text children by default, this is XSS-safe.

### Anti-Patterns to Avoid
- **Rebuilding Fuse on every keystroke.** Kills JIT caching and is wasteful. Use `useMemo([guests])`.
- **Injecting highlighted HTML strings.** Do not construct an HTML string and feed it to React's raw-HTML escape hatch — names could theoretically contain `<` or `&`. Use React children (see Pattern 3) so React handles escaping automatically.
- **Searching a concatenated "fullName" field.** CONTEXT.md explicitly locks per-field (firstName + lastName separately). A concatenated field would silently break the tiered substring logic and the highlighter (index offsets drift).
- **Setting `threshold: 0` or `>0.5`.** 0 = exact-only (defeats the purpose); >0.5 floods results with noise.
- **Including `contactInfo` / `description` in `keys`.** Locked decision — admin notes are not identifiers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typo-tolerant name matching | Levenshtein / bitap from scratch | Fuse.js | Fuse implements Bitap with per-field weights, scoring, match indices. Hand-rolled versions miss edge cases (unicode, multi-field scoring). |
| Match-index computation for highlighting | Manual character-walk after fuzzy match | `includeMatches: true` | Fuse returns exact `[start, end]` ranges used during matching — you can't reconstruct these accurately from the score alone. |
| Debouncing | Third-party hook / lodash.debounce | Existing `useRef` + `setTimeout` | Already implemented in `SearchForm.tsx`; don't add a dep. |

**Key insight:** The fuzzy math is solved. The work in this phase is glue code: wiring Fuse into React state flow, the tiered partition, and highlight rendering. Keep the surface area small.

## Common Pitfalls

### Pitfall 1: `ignoreLocation` default
**What goes wrong:** By default Fuse weights matches near the start of the string and requires matches within `distance: 100` chars of `location: 0`. For short strings (first/last names <20 chars) this is usually fine, but it causes surprising misses on longer inputs.
**Why:** Defaults optimize for "find needle near the start of haystack".
**How to avoid:** Set `ignoreLocation: true`. For name matching we don't care where in the word the match happens.
**Warning sign:** "Smith" fails to match when query is "mith" (position-weighted score falls below threshold). [CITED: fusejs.io/api/options.html#ignorelocation]

### Pitfall 2: Single-character queries flood results
**What goes wrong:** `minMatchCharLength: 1` (default) means every guest whose name contains the letter returns a match. Combined with threshold 0.3, a single keystroke can return 50+ results.
**How to avoid:** Set `minMatchCharLength: 2`. Because CONTEXT.md requires `minimum query length = 1`, the first-keystroke UX relies on the Tier-1 substring pass (which does run at 1 char — a single letter "m" shows all prefix-"m" guests). Fuse itself only contributes results once query length ≥ 2.
**Trade-off:** This is a deliberate asymmetry — substring is cheap and deterministic at 1 char; fuzzy is noisy at 1 char.

### Pitfall 3: iOS Safari autocorrect & capitalization
**What goes wrong:** iOS auto-capitalizes the first letter and may autocorrect "mahek" → "make". With `autocomplete="off"` already set, autocorrect/autocapitalize may still run.
**How to avoid:** Add `autoCorrect="off"`, `autoCapitalize="off"`, `spellCheck={false}` to the search input. Case is already normalized via `.toLowerCase()` so capitalization alone is harmless, but autocorrect can silently rewrite input.

### Pitfall 4: Unicode / diacritics (Indian names with accents)
**What goes wrong:** Fuse compares raw code points. "Saumyā" (with macron) will not match "Saumya" and vice-versa.
**How to avoid:** If guest data or user input contains diacritics, normalize both sides with `.normalize('NFD').replace(/[\u0300-\u036f]/g, '')` before indexing and querying. The guest data in this project (sampled from `googleSheets.ts` flow) is plain ASCII, so this is likely a no-op — but add the normalization layer defensively; it costs nothing at n=200. [ASSUMED: guest list ASCII-only — worth a quick grep confirmation during implementation]

### Pitfall 5: `FuseResult.matches[].indices` shape surprise
**What goes wrong:** Fuse returns match ranges as `ReadonlyArray<[number, number]>` where each pair is `[start, end]` **inclusive** (not half-open). Off-by-one in the highlighter is the most common bug.
**How to avoid:** Use `text.slice(start, end + 1)`. Test with a single-character match to catch the off-by-one. [CITED: fusejs.io/api/options.html#includematches]

### Pitfall 6: Stale index after guest list reload
**What goes wrong:** If `loadGuests` is retried after an error, `guests` state updates but a non-memoized Fuse instance would persist with old data.
**How to avoid:** `useMemo(() => new Fuse(guests, options), [guests])`. Reference-equal `guests` array ⇒ same instance; new array ⇒ new index.

### Pitfall 7: Empty-query behavior
**What goes wrong:** `fuse.search('')` returns all items in some versions; calling it via debounce when the user clears the input can flash the full list.
**How to avoid:** Short-circuit in `searchGuests`: `if (!query) return [];`. Already in the pattern above.

## Runtime State Inventory

Not applicable — this is a greenfield feature addition to a static SPA. No stored data, live service config, OS registrations, secrets, or build artifacts carry search-related state. Fuse index is built in-memory at runtime and discarded on reload.

## Code Examples

### Wiring from App.tsx

```typescript
// Source: adaptation of existing App.tsx + fusejs.io patterns [CITED]
import Fuse, { type IFuseOptions } from 'fuse.js';
import { useMemo, useState, useEffect } from 'react';
import { searchGuests, type RankedGuest } from './services/searchGuests';

const fuseOptions: IFuseOptions<Guest> = {
  keys: [
    { name: 'firstName', weight: 1 },
    { name: 'lastName',  weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeMatches: true,
  includeScore: true,
  shouldSort: true,
};

function App() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RankedGuest[]>([]);

  const fuse = useMemo(() => new Fuse(guests, fuseOptions), [guests]);

  function handleSearch(searchTerm: string) {
    setQuery(searchTerm);
    setResults(searchGuests(searchTerm, guests, fuse));
  }

  // ... render: pass `results` + `query` to GuestDropdown; show no-results message when
  // query.trim() && results.length === 0.
}
```

### Extending GuestDropdown

```typescript
// Accept ranked results; render highlighted first/last name; show no-results card.
interface GuestDropdownProps {
  results: RankedGuest[];
  query: string;
  onSelect: (guest: Guest) => void;
}

export default function GuestDropdown({ results, query, onSelect }: GuestDropdownProps) {
  if (query.trim() && results.length === 0) {
    return (
      <div className="guest-dropdown">
        <div className="no-results">
          No guests match '{query}'. Check spelling or try last name only.
        </div>
      </div>
    );
  }
  // ... existing list rendering, but replace `{guest.firstName} {guest.lastName}`
  // with <HighlightedText> components keyed by matches.key
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Array.filter(includes)` | Fuse.js fuzzy + tiered substring pass | N/A (project change) | Handles typos/transpositions; same perf envelope at n=200 |
| Fuse 6.x `id`-based index | Fuse 7.x typed generics `Fuse<T>` | v7.0.0 (2023) | Full TS inference on `keys`; no more string-path quoting |

**Deprecated/outdated:**
- Fuse 6.x `createIndex` manual serialization — not needed at n=200; the `new Fuse(list, opts)` constructor is fast enough.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Guest list is plain ASCII — Unicode normalization is a precautionary no-op | Pitfall 4 | If names contain accents, search will miss them. Mitigation is cheap: add NFD normalization unconditionally. |
| A2 | n ≈ 100–200 guests — index build & per-query cost is sub-millisecond, no perf work needed | Summary, Pitfall 6 | At n>1000 the per-keystroke full sort could become noticeable. Not applicable here (single wedding, finite guest list). |
| A3 | CONTEXT.md's "1 char minimum query length" applies to triggering any search UI, but it's acceptable for Fuse itself to only fire at ≥2 chars (via `minMatchCharLength: 2`), with substring tier covering 1-char queries | Pitfall 2 | If the planner wants Fuse to fire at 1 char too, drop `minMatchCharLength` to 1 — but expect noisier results. Flag for planner. |

## Open Questions

1. **Should the "no results" message live in `GuestDropdown` or `App.tsx`?**
   - What we know: Current `App.tsx` only renders `<GuestDropdown>` when `searchResults.length > 0`. The no-results state therefore doesn't currently render anything.
   - What's unclear: UX preference — does the no-results card look like a dropdown row (same container) or a separate card?
   - Recommendation: Render inside `GuestDropdown` when `query.trim() && results.length === 0`. Keeps `App.tsx` state flow identical (still renders dropdown component), changes the conditional to `query.trim().length > 0` instead of `results.length > 0`. Minimal churn.

2. **Should search queries be surfaced into App state, or kept inside SearchForm?**
   - What we know: Currently `SearchForm` owns `searchTerm` locally and only emits via `onSearch`.
   - What's unclear: The no-results message needs the query text. Either (a) pass the query through `onSearch` → `App` state → `GuestDropdown`, or (b) include the query inside the `results` payload itself.
   - Recommendation: (a) — add a `query: string` state in `App.tsx` set inside `handleSearch`. Small, clear, matches existing lifting-state-up pattern.

3. **Should `minMatchCharLength` be 1 or 2?** See Assumption A3. Planner decision.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Dev server, build | ✓ | v22.14.0 | — |
| npm | Package install | ✓ | (with Node 22) | — |
| fuse.js | Fuzzy search | ✗ (not yet installed) | target 7.3.0 | None — required by phase |

**Missing dependencies with no fallback:** fuse.js must be installed (`npm install fuse.js`) as the first task in the plan.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed. Recommend Vitest ^2.x (default Vite pairing, Jest-compatible API) |
| Config file | none — see Wave 0 |
| Quick run command | `npx vitest run src/services/searchGuests.test.ts` (once added) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-01 | "Smih" → "Smith" returns correct guest; "Mahke" → "Mahek" returns correct guest | unit (searchGuests) | `npx vitest run src/services/searchGuests.test.ts -t "typo tolerance"` | ❌ Wave 0 |
| SRCH-02 | Debounce wires Fuse call; `handleSearch('m')` returns prefix-"m" guests immediately | unit + manual smoke (debounce timing is trivial to miss in unit tests; verify via dev server) | `npx vitest run src/services/searchGuests.test.ts -t "prefix query"` + manual | ❌ Wave 0 |
| SRCH-03 | "Mah" ranks "Mahek Patel" (prefix) above "Rhea Mahal" (contains) above fuzzy-matched "Max Patel" | unit | `npx vitest run src/services/searchGuests.test.ts -t "tier ordering"` | ❌ Wave 0 |
| SRCH-04 | Empty query → empty results; "xyz" → no-results message rendered | unit + component render | `npx vitest run src/services/searchGuests.test.ts -t "no results"` | ❌ Wave 0 |

Manual-only (justified): Highlighting visual correctness, iOS Safari autocorrect behavior, mobile-keyboard typo UX — require real device or DOM render inspection. Cover in human UAT.

### Sampling Rate
- **Per task commit:** `npx vitest run src/services/searchGuests.test.ts` (pure function, <1s)
- **Per wave merge:** `npx vitest run` (entire suite — only one file for now)
- **Phase gate:** Full suite green + `npm run lint` + `npm run build` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Install Vitest: `npm install -D vitest` — only if planner chooses to add tests. Tests are **optional** for this phase given the app has zero test infrastructure today; planner may defer the Vitest install to a later phase and rely on manual UAT for SRCH-01..04 validation.
- [ ] `vitest.config.ts` — minimal config (node environment is fine; searchGuests is pure and DOM-free)
- [ ] `src/services/searchGuests.test.ts` — unit tests for the pure `searchGuests()` function (highest-value; fastest to add; no DOM needed)

*Recommendation: add just `searchGuests.test.ts` + Vitest with the **node** environment. This is ~10 minutes of setup and produces the highest-leverage tests. Skip component/DOM tests for this phase.*

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** React/Vite/TypeScript — no framework swap. ✓ Fuse.js is a plain dep, compatible.
- **No global state lib:** Use `useState` at `App.tsx`. ✓ Matches recommended integration.
- **Naming:** PascalCase components (`HighlightedText.tsx`), camelCase services (`searchGuests.ts`), `handle*` event handlers, `on*` callback props, 2-space indent, single quotes, semicolons.
- **Component pattern:** `function` declarations (not arrow), default export, props destructured in signature, `{ComponentName}Props` interface above component.
- **CSS:** Plain co-located CSS files; no CSS modules/Tailwind. If new styles needed for no-results card or bold highlights, add to `GuestDropdown.css`.
- **Imports:** Relative paths only, no `@/` aliases. Omit `.tsx` extensions on local imports (except `main.tsx`).
- **Error handling:** try/catch + `console.error` + re-throw user-friendly messages. `searchGuests` is pure/synchronous — no async error surface.
- **GSD workflow:** All edits must flow through GSD commands. This research is for `/gsd-plan-phase 2`.
- **ESLint strict:** `--max-warnings 0`. New code must pass `npm run lint`.
- **TypeScript strict:** `noUnusedLocals`, `noUnusedParameters`, `strict: true`. All new types fully annotated; no `any`.

## Sources

### Primary (HIGH confidence)
- [VERIFIED] `npm view fuse.js version` → `7.3.0` (modified 2026-04-04)
- [CITED] https://www.fusejs.io/api/options.html — threshold, keys, weight, ignoreLocation, minMatchCharLength, includeMatches, includeScore, shouldSort
- [CITED] https://www.fusejs.io/api/indexing.html — constructor signature, index reuse
- [VERIFIED from codebase] `src/App.tsx`, `src/components/SearchForm.tsx`, `src/components/GuestDropdown.tsx`, `src/types.ts`, `package.json`

### Secondary (MEDIUM confidence)
- React 18 hooks usage patterns (`useMemo` for derived index) — consistent with official React docs https://react.dev/reference/react/useMemo

### Tertiary (LOW confidence)
- None. All recommendations trace to verified sources or direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — library locked by CONTEXT, version verified on npm
- Architecture: HIGH — pattern matches existing codebase conventions 1:1
- Pitfalls: HIGH — all pitfalls cited from Fuse.js official docs or standard web/iOS knowledge; Unicode flagged as ASSUMED (A1)
- Validation: MEDIUM — Vitest is the canonical choice but project has no existing test infrastructure; planner must decide whether to bootstrap it this phase

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (Fuse.js API is stable; 30-day window safe)
