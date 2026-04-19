---
id: 02-01
phase: 02-fuzzy-search
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - src/types.ts
  - src/services/searchGuests.ts
  - src/App.tsx
autonomous: true
requirements:
  - SRCH-01
  - SRCH-02
  - SRCH-03
  - SRCH-04
objective: "Install Fuse.js, build tiered ranking search utility, and wire it into App.tsx replacing the existing substring handleSearch."

must_haves:
  truths:
    - "Typing 'Smih' returns 'Smith' in the top results (typo tolerance)"
    - "Typing 'Mah' returns 'Mahek Patel' ranked above any fuzzy-only match (tiered ranking)"
    - "Results update on each keystroke with no blocking work over ~1ms"
    - "Empty/whitespace-only query yields empty result set"
    - "Result set is capped at 10 entries"
    - "Only firstName and lastName are searched — contactInfo/description are ignored"
  artifacts:
    - path: "src/services/searchGuests.ts"
      provides: "Pure tiered-ranking fuzzy search utility + buildGuestIndex + searchGuests"
      exports: ["buildGuestIndex", "searchGuests", "type RankedGuest", "type MatchRange"]
    - path: "src/types.ts"
      provides: "Guest (existing) + re-export or companion types for RankedGuest/MatchRange (may live in searchGuests.ts)"
      contains: "Guest"
    - path: "src/App.tsx"
      provides: "Memoized Fuse index + handleSearch using searchGuests"
      contains: "useMemo"
    - path: "package.json"
      provides: "fuse.js dependency declared"
      contains: "fuse.js"
  key_links:
    - from: "src/App.tsx"
      to: "src/services/searchGuests.ts"
      via: "import { searchGuests, buildGuestIndex, RankedGuest }"
      pattern: "from '\\./services/searchGuests'"
    - from: "src/App.tsx"
      to: "Fuse instance"
      via: "useMemo over guests"
      pattern: "useMemo\\(\\(\\) => buildGuestIndex|new Fuse"
    - from: "src/App.tsx (handleSearch)"
      to: "GuestDropdown"
      via: "searchResults state passed as results prop + query prop"
      pattern: "searchResults|query"
---

<objective>
Replace the current `.includes()`-based `handleSearch` in `App.tsx` with a fuzzy search
powered by Fuse.js, using the locked config (threshold 0.3, ignoreLocation, minMatchCharLength 2,
includeMatches, includeScore, equal-weight firstName+lastName). Add a pure utility
`src/services/searchGuests.ts` implementing tiered ranking (prefix > contains > fuzzy, capped at 10).
Lift the current query text into App state so downstream UI (Plan 02) can render the no-results copy
and highlight matches.

Purpose: SRCH-01 (typo tolerance), SRCH-02 (search-as-you-type plumbing), SRCH-03 (tiered ranking),
and the data path for SRCH-04 (no-results) all depend on this wiring.

Output: fuse.js installed; `searchGuests.ts` pure util; App.tsx wired with memoized Fuse instance,
`query` state, and `RankedGuest[]` results passed to GuestDropdown.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-fuzzy-search/02-CONTEXT.md
@.planning/phases/02-fuzzy-search/02-RESEARCH.md
@.planning/phases/02-fuzzy-search/02-VALIDATION.md
@CLAUDE.md
@src/App.tsx
@src/components/SearchForm.tsx
@src/components/GuestDropdown.tsx
@src/types.ts
@package.json

<interfaces>
<!-- Existing Guest type that searchGuests operates on. -->

From src/types.ts:
```typescript
export interface Guest {
  tableNumber: string;
  firstName: string;
  lastName: string;
  contactInfo: string;
  description: string;
}
```

New exports this plan MUST create from src/services/searchGuests.ts:
```typescript
import Fuse from 'fuse.js';
import type { Guest } from '../types';

export interface MatchRange {
  key: 'firstName' | 'lastName';
  indices: ReadonlyArray<readonly [number, number]>; // inclusive [start, end]
}

export interface RankedGuest {
  guest: Guest;
  matches: MatchRange[];
}

export function buildGuestIndex(guests: Guest[]): Fuse<Guest>;
export function searchGuests(
  rawQuery: string,
  guests: Guest[],
  fuse: Fuse<Guest>
): RankedGuest[];
```

Fuse options (locked by RESEARCH.md):
```typescript
{
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
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Fuse.js and define shared types</name>
  <files>package.json, package-lock.json, src/services/searchGuests.ts</files>
  <action>
1. Run `npm install fuse.js` from the repo root. Expect fuse.js@^7.3.0 in `dependencies` (RESEARCH.md verified 7.3.0 current on npm 2026-04-04). Do NOT pin exact; use caret so patch updates flow.
2. Verify `package.json` now lists `"fuse.js"` under `dependencies` (not devDependencies).
3. Create `src/services/searchGuests.ts` with:
   - Default import: `import Fuse, { type IFuseOptions, type FuseResult } from 'fuse.js';`
   - Import Guest: `import type { Guest } from '../types';`
   - Exported `MatchRange` interface with `key: 'firstName' | 'lastName'` and `indices: ReadonlyArray<readonly [number, number]>`.
   - Exported `RankedGuest` interface with `guest: Guest` and `matches: MatchRange[]`.
   - Module-level `const fuseOptions: IFuseOptions&lt;Guest&gt; = { ... }` using the exact config in the interfaces block above.
   - Exported `buildGuestIndex(guests: Guest[]): Fuse&lt;Guest&gt;` that returns `new Fuse(guests, fuseOptions)`.
   - Stub `searchGuests(rawQuery: string, guests: Guest[], fuse: Fuse&lt;Guest&gt;): RankedGuest[]` returning `[]` for now — real logic lands in Task 2. Keep the signature so App.tsx import does not break mid-wave.
4. Follow CLAUDE.md conventions: 2-space indent, single quotes, semicolons, `function` declarations for the exported functions (not arrow), no `any`.
5. Do NOT modify App.tsx yet.
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <done>
- `fuse.js` present in `package.json` dependencies.
- `src/services/searchGuests.ts` compiles with strict TS; exports `buildGuestIndex`, `searchGuests`, `RankedGuest`, `MatchRange`.
- `npm run build` green (tsc + vite).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement tiered ranking algorithm in searchGuests</name>
  <files>src/services/searchGuests.ts</files>
  <behavior>
Per RESEARCH.md Pattern 2 and CONTEXT.md locked decisions:
- Empty / whitespace query → returns `[]`.
- Tier 1 (prefix): guests where `firstName.toLowerCase().startsWith(query)` OR `lastName.toLowerCase().startsWith(query)`. Preserve input order for stability.
- Tier 1 (contains, below prefix): guests where a name field `includes(query)` but does NOT start with it.
- Tier 2 (fuzzy): `fuse.search(query)` results, excluding guests already in Tier 1 (dedupe by Guest object identity via a `Set<Guest>`). Keep Fuse's score ordering.
- Each tier's entries carry `matches: MatchRange[]`:
  - Substring tiers: compute `indexOf(query)` on each field that contains it, push `{ key, indices: [[start, start + query.length - 1]] }` (inclusive range). Include both firstName and lastName entries when both contain the query.
  - Fuzzy tier: map `FuseResult.matches` (filtered to `key === 'firstName' | 'lastName'`) into `MatchRange[]`. Fuse's `indices` are already inclusive `[start, end]` tuples — pass through.
- Concatenate tiers in order: `[...tierPrefix, ...tierContains, ...tierFuzzy]` then `.slice(0, 10)`.
- Lowercase query for substring compare via `rawQuery.trim().toLowerCase()`. Do not lowercase the Guest fields in the returned `RankedGuest` — the UI renders the original-case name; only the comparison is case-insensitive. Index offsets from lowercase compare are valid against the original string because `.toLowerCase()` preserves length for ASCII (A1 assumption in RESEARCH.md).

Verification cases (manually reasoned; no test harness added this phase):
  - `searchGuests('', guests, fuse)` → `[]`
  - `searchGuests('   ', guests, fuse)` → `[]`
  - `searchGuests('Mah', [Mahek Patel, Rhea Mahal, Max Patel], fuse)` → `[Mahek Patel, Rhea Mahal, Max Patel]` (prefix, contains, fuzzy)
  - `searchGuests('Smih', [Smith, ...], fuse)` → Smith appears in results (fuzzy tier) with `matches` containing firstName or lastName indices
  - Result length never exceeds 10.
  </behavior>
  <action>
1. Replace the Task-1 stub body of `searchGuests` with the tiered algorithm from RESEARCH.md Pattern 2 (lines ~118-164 of 02-RESEARCH.md). Fidelity points:
   - Use `const query = rawQuery.trim().toLowerCase(); if (!query) return [];` as the guard.
   - Use a `Set<Guest>` (`seen`) to track Tier-1 inclusion; dedupe Fuse results by `!seen.has(r.item)`.
   - For the substring `matches`: compute indices against the lowercased field but return them as inclusive `[indexOf, indexOf + query.length - 1]` — they are valid on the original string because lowercase preserves length for ASCII data (A1 from RESEARCH.md).
   - When both firstName and lastName contain the query, emit two `MatchRange` entries (one per key). When only one contains it, emit one.
   - For Fuse matches, cast `m.key` to `'firstName' | 'lastName'` after the filter; do not leak any other keys.
   - Final `.slice(0, 10)`.
2. Do NOT add diacritic normalization (A1: ASCII-only assumption in RESEARCH.md holds; flagged for future if needed). Do NOT change the Fuse config.
3. Keep the module pure — no React imports, no side effects.
4. Ensure the file passes `tsc --strict`: no `any`, no unused locals, no non-null assertions without cause.
  </action>
  <verify>
    <automated>npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <done>
- `searchGuests.ts` implements tiered ranking per RESEARCH.md Pattern 2.
- Build + lint green (no warnings, ESLint `--max-warnings 0`).
- Function is pure, synchronous, exports match interfaces block.
- Result cap of 10 enforced via `.slice(0, 10)` on the concatenated tier list.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire Fuse index + searchGuests into App.tsx</name>
  <files>src/App.tsx</files>
  <action>
1. Imports:
   - Add `import { useMemo } from 'react';` (merge with existing React import).
   - Add `import { buildGuestIndex, searchGuests, type RankedGuest } from './services/searchGuests';`
   - Remove the `Guest` import usage if it is only used for the old `searchResults` typing — keep it for `selectedGuest` typing (still needed).
2. State changes in `App`:
   - Replace `const [searchResults, setSearchResults] = useState&lt;Guest[]&gt;([]);` with `const [searchResults, setSearchResults] = useState&lt;RankedGuest[]&gt;([]);`.
   - Add `const [query, setQuery] = useState('');`.
3. Memoized Fuse instance (below state, above handlers):
   ```tsx
   const fuse = useMemo(() => buildGuestIndex(guests), [guests]);
   ```
4. Replace `handleSearch` entirely:
   ```tsx
   function handleSearch(searchTerm: string) {
     setQuery(searchTerm);
     setSearchResults(searchGuests(searchTerm, guests, fuse));
   }
   ```
   Delete the old lowercasing / fullName / reverseFullName logic. Do not preserve the old behavior.
5. Render changes — prepare the data path for Plan 02:
   - The existing render currently does `{searchResults.length > 0 && <GuestDropdown guests={searchResults} ... />}`. Change the condition to render the dropdown whenever there is an active query OR results:
     ```tsx
     {query.trim().length > 0 && (
       <GuestDropdown
         results={searchResults}
         query={query}
         onSelect={handleGuestSelect}
       />
     )}
     ```
   - NOTE: `GuestDropdown` does not yet accept `results` / `query` props — it still accepts `guests`. This will cause a type error until Plan 02 updates the component. To keep this plan's build green in isolation, Plan 02 is a Wave 2 dependency that MUST run before build is re-verified at the phase gate. For this plan's own verify step, temporarily keep the old prop shape AND add the new state — see Task 3 build-green strategy below.
6. **Build-green strategy for Wave 1:** To avoid shipping a broken build at end of Wave 1, pass the legacy shape to `GuestDropdown` in this task by mapping `searchResults.map(r => r.guest)`:
   ```tsx
   {query.trim().length > 0 && searchResults.length > 0 && (
     <GuestDropdown
       guests={searchResults.map(r => r.guest)}
       onSelect={handleGuestSelect}
     />
   )}
   ```
   Plan 02 will replace this with the `results` + `query` props when it updates `GuestDropdown`'s interface. The `query` state is already live, ready for Plan 02.
   (Do NOT render the no-results message yet — Plan 02 owns that UI inside `GuestDropdown`.)
7. Keep all other App.tsx behavior unchanged: loading state, error state, `handleGuestSelect`, `closeModal`, `TableModal` render, background image, headings.
  </action>
  <verify>
    <automated>npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <done>
- App.tsx imports and uses `buildGuestIndex` + `searchGuests`.
- `useMemo(() => buildGuestIndex(guests), [guests])` is present.
- `query` state exists and is set inside `handleSearch`.
- Old substring filter logic (fullName / reverseFullName / `.includes`) is fully deleted.
- `searchResults` state is `RankedGuest[]`.
- Build + lint green. The app still renders the dropdown for matching guests (legacy shape via `.map(r => r.guest)`), but now backed by fuzzy matching + tiered ranking.
- Manual smoke (developer, not automated): `npm run dev`, type "Smih" → Smith appears; type "Mah" → Mahek Patel ranked first.
  </done>
</task>

</tasks>

<verification>
- `npm run build` passes (tsc strict + vite).
- `npm run lint` passes with `--max-warnings 0`.
- Manual: dev server loads; search for "Smih" returns Smith; search for "Mah" ranks Mahek first; empty input yields empty dropdown; result list never exceeds 10 entries.
- `contactInfo` / `description` text (e.g. "bride's side") does NOT return any guest when searched.
</verification>

<success_criteria>
- SRCH-01: Fuzzy search returns the correct guest for 1-2 char typos (verified manually via "Smih" → "Smith", "Mahke" → "Mahek").
- SRCH-02: `handleSearch` is invoked per keystroke behind the existing 150ms debounce and completes sub-millisecond at n≈200.
- SRCH-03 (data layer): Tiered algorithm in `searchGuests.ts` guarantees prefix > contains > fuzzy ordering with 10-result cap. Visible ranking in UI confirmed in Plan 02.
- SRCH-04 (data path): `query` state is available in App for Plan 02 to render the no-results copy. This plan intentionally does not render the copy itself.
</success_criteria>

<risk>
- Wave 1 in isolation does not yet render match highlights or the no-results message — those are Plan 02. The legacy prop shape (`guests={...}`) is temporarily retained in App.tsx so the build stays green between waves. Plan 02 MUST update both `GuestDropdown` and App.tsx's render conditional together.
- Unicode / diacritics are NOT normalized (A1 in RESEARCH.md). Acceptable for current ASCII-only guest data; revisit if CSV adds accented names.
</risk>

<output>
After completion, create `.planning/phases/02-fuzzy-search/02-01-SUMMARY.md` documenting:
- Fuse.js version installed
- Final `searchGuests.ts` signature and tier algorithm notes
- Any deviations from RESEARCH.md Pattern 2
- Manual smoke test results (Smih, Mah, empty, xyz)
</output>
