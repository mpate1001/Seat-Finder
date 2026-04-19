---
id: 02-02
phase: 02-fuzzy-search
plan: 02
type: execute
wave: 2
depends_on:
  - 02-01
files_modified:
  - src/components/HighlightedText.tsx
  - src/components/GuestDropdown.tsx
  - src/components/GuestDropdown.css
  - src/App.tsx
autonomous: false
requirements:
  - SRCH-02
  - SRCH-03
  - SRCH-04
objective: "Add HighlightedText component, extend GuestDropdown to render ranked results with bold match highlights and a no-results message, and finalize App.tsx's dropdown wiring. Close Phase 2 with manual UAT."

must_haves:
  truths:
    - "Query 'mah' renders 'Mahek Patel' with bold on the 'Mah' prefix in the dropdown"
    - "Query 'xyz' (no matches) renders: No guests match 'xyz'. Check spelling or try last name only."
    - "Empty / whitespace query shows no dropdown (no empty card flash)"
    - "Dropdown shows up to 10 results with best match first"
    - "Results visibly update per keystroke (via existing 150ms debounce)"
  artifacts:
    - path: "src/components/HighlightedText.tsx"
      provides: "Pure presentational component that renders text with <strong> around inclusive [start,end] ranges using React children (XSS-safe, no raw HTML injection)"
      exports: ["default HighlightedText"]
    - path: "src/components/GuestDropdown.tsx"
      provides: "Updated to accept results: RankedGuest[] + query: string, renders HighlightedText for name, renders no-results card"
      contains: "HighlightedText"
    - path: "src/components/GuestDropdown.css"
      provides: "Styles for .no-results card and .guest-name strong highlight weight"
      contains: "no-results"
  key_links:
    - from: "src/components/GuestDropdown.tsx"
      to: "src/components/HighlightedText.tsx"
      via: "import + render per firstName/lastName match key"
      pattern: "HighlightedText"
    - from: "src/App.tsx"
      to: "GuestDropdown"
      via: "results={searchResults} query={query} onSelect={handleGuestSelect}"
      pattern: "results=\\{searchResults\\}"
    - from: "GuestDropdown no-results condition"
      to: "SRCH-04 copy"
      via: "render when query.trim() && results.length === 0"
      pattern: "No guests match"
---

<objective>
Finish Phase 2 by rendering the fuzzy search output. Create a reusable `HighlightedText`
component, extend `GuestDropdown` to accept `RankedGuest[]` + `query` and render bold match
highlights plus a locked no-results message, and update App.tsx's render call-site to pass
the new props. Close with a human-verification checkpoint covering SRCH-01..04 on desktop
and mobile.

Purpose: SRCH-03 (visible best-match-first ranking + match highlighting) and SRCH-04
(no-results copy) are user-visible here. SRCH-02 is the final UX validation (search-as-
you-type feel on mobile).

Output: New `HighlightedText.tsx`, updated `GuestDropdown.tsx` + `.css`, App.tsx render
call-site finalized, manual UAT pass.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02-fuzzy-search/02-CONTEXT.md
@.planning/phases/02-fuzzy-search/02-RESEARCH.md
@.planning/phases/02-fuzzy-search/02-VALIDATION.md
@.planning/phases/02-fuzzy-search/02-01-SUMMARY.md
@CLAUDE.md
@src/App.tsx
@src/components/GuestDropdown.tsx
@src/services/searchGuests.ts
@src/types.ts

<interfaces>
<!-- From Plan 01 (src/services/searchGuests.ts) — already in the codebase by Wave 2: -->

```typescript
export interface MatchRange {
  key: 'firstName' | 'lastName';
  indices: ReadonlyArray<readonly [number, number]>; // inclusive [start, end]
}
export interface RankedGuest {
  guest: Guest;
  matches: MatchRange[];
}
```

<!-- New props contract this plan establishes for GuestDropdown: -->

```typescript
interface GuestDropdownProps {
  results: RankedGuest[];
  query: string;
  onSelect: (guest: Guest) => void;
}
```

<!-- New HighlightedText component: -->

```typescript
interface HighlightedTextProps {
  text: string;
  ranges: ReadonlyArray<readonly [number, number]>; // inclusive
}
export default function HighlightedText(props: HighlightedTextProps): JSX.Element;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create HighlightedText component</name>
  <files>src/components/HighlightedText.tsx</files>
  <action>
1. Create `src/components/HighlightedText.tsx` as a new default-exported component following project conventions (function declaration, props destructured in signature, `{ComponentName}Props` interface above the component).
2. Signature:
   ```tsx
   interface HighlightedTextProps {
     text: string;
     ranges: ReadonlyArray<readonly [number, number]>;
   }
   export default function HighlightedText({ text, ranges }: HighlightedTextProps) { ... }
   ```
3. Implementation (XSS-safe — use React children only; do NOT use any raw-HTML escape hatch / innerHTML-style prop):
   - If `ranges.length === 0`, return `<>{text}</>`.
   - Sort a local copy of ranges by start index ascending.
   - Walk the sorted ranges, accumulating alternating plain-text slices and `<strong key={start}>{text.slice(start, end + 1)}</strong>` segments. Indices are **inclusive** (RESEARCH.md Pitfall 5) — use `end + 1` in `slice`.
   - Append trailing plain text after the last range.
   - Return `<>{out}</>`.
4. Do NOT import any CSS. Weight styling is applied via the `strong` tag inheriting from `.guest-name strong` in `GuestDropdown.css` (Task 2).
5. Handle overlapping/adjacent ranges defensively: if a sorted range's `start` is <= the previous range's `end`, clamp `start = Math.max(start, previousEnd + 1)`; skip if `start > end` after clamp. This prevents React key collisions and duplicate text when Fuse emits overlapping match segments.
6. No `any`. All types fully annotated. Single quotes, semicolons, 2-space indent. Rely on React's default text-child escaping — no raw-HTML props anywhere in this file.
  </action>
  <verify>
    <automated>npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <done>
- `HighlightedText.tsx` exists, exports default component.
- Passes tsc strict + ESLint `--max-warnings 0`.
- Rendering uses React children only (no raw-HTML escape hatch).
- Inclusive range semantics (uses `slice(start, end + 1)`).
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend GuestDropdown for ranked results, highlights, and no-results</name>
  <files>src/components/GuestDropdown.tsx, src/components/GuestDropdown.css</files>
  <action>
1. Rewrite `src/components/GuestDropdown.tsx`:
   - Imports: `import { Guest } from '../types';`, `import { type RankedGuest } from '../services/searchGuests';`, `import HighlightedText from './HighlightedText';`, `import './GuestDropdown.css';`.
   - New props interface (replaces old `guests: Guest[]`):
     ```tsx
     interface GuestDropdownProps {
       results: RankedGuest[];
       query: string;
       onSelect: (guest: Guest) => void;
     }
     ```
   - Body logic:
     - `const trimmed = query.trim();`
     - If `trimmed.length === 0`, return `null` (parent should already guard this, but belt-and-suspenders).
     - If `results.length === 0`, render a no-results card inside `<div className="guest-dropdown">`:
       ```tsx
       <div className="no-results">
         No guests match '{trimmed}'. Check spelling or try last name only.
       </div>
       ```
       Copy MUST match CONTEXT.md exactly, including the straight single quotes around `{trimmed}` and the period at the end. (D-locked decision.)
     - Otherwise render the dropdown header (`'1 guest found'` / `'${n} guests found'`) and map over `results`:
       ```tsx
       {results.map((r, index) => {
         const fnMatch = r.matches.find(m => m.key === 'firstName');
         const lnMatch = r.matches.find(m => m.key === 'lastName');
         return (
           <button
             key={`${r.guest.firstName}-${r.guest.lastName}-${r.guest.tableNumber}-${index}`}
             className="guest-item"
             onClick={() => onSelect(r.guest)}
           >
             <div className="guest-name">
               <HighlightedText text={r.guest.firstName} ranges={fnMatch?.indices ?? []} />{' '}
               <HighlightedText text={r.guest.lastName} ranges={lnMatch?.indices ?? []} />
             </div>
             <div className="guest-identifier">
               {r.guest.contactInfo || r.guest.description}
             </div>
           </button>
         );
       })}
       ```
   - Keep the outer `<div className="guest-dropdown">` and `<div className="dropdown-list">` structure. Preserve existing class names so current CSS continues to apply.
2. Update `src/components/GuestDropdown.css` (append, do not remove existing rules):
   - `.no-results { padding: 16px; text-align: center; color: #2b2d42; font-size: 0.95rem; line-height: 1.4; }` — adjust to match existing color palette (`#2b2d42` / `#8d99ae`) and border-radius conventions from CLAUDE.md.
   - `.guest-name strong { font-weight: 700; }` — ensures highlighted segments visibly stand out against the default name weight. If the existing `.guest-name` is already 700, use 800 or keep 700 plus a subtle `color: #d90429` accent per the project palette — planner's call, but it MUST be visually distinguishable.
3. Do NOT change `SearchForm.tsx`; the existing 150ms debounce stays.
4. Lint/strict compliance: no unused props, no `any`, exhaustive destructuring.
  </action>
  <verify>
    <automated>npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <done>
- `GuestDropdown` accepts `{ results, query, onSelect }` (old `guests` prop removed).
- No-results copy renders exactly: `No guests match '{query}'. Check spelling or try last name only.`
- Highlights render via `HighlightedText` with firstName/lastName match indices.
- CSS has `.no-results` rule and a visible weight (or color) for `.guest-name strong`.
- Build + lint green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Finalize App.tsx render call-site</name>
  <files>src/App.tsx</files>
  <action>
1. Locate the GuestDropdown render block added in Plan 01 Task 3 (the interim `guests={searchResults.map(r => r.guest)}` shape).
2. Replace with the final call-site:
   ```tsx
   {query.trim().length > 0 && (
     <GuestDropdown
       results={searchResults}
       query={query}
       onSelect={handleGuestSelect}
     />
   )}
   ```
   Note: the condition is `query.trim().length > 0` (NOT `searchResults.length > 0`) — this is what makes the no-results card render. `GuestDropdown` internally handles the empty-results case.
3. Remove the `.map(r => r.guest)` transform — `GuestDropdown` now takes `RankedGuest[]` directly.
4. Leave all other App.tsx behavior unchanged (loading, error, TableModal, handleGuestSelect, closeModal, Fuse useMemo, handleSearch).
5. Sanity-check imports: `RankedGuest` is already imported from Plan 01; `Guest` still needed for `selectedGuest`. Remove any now-dead imports flagged by `noUnusedLocals`.
  </action>
  <verify>
    <automated>npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <done>
- App.tsx passes `results` + `query` to GuestDropdown; the `.map(r => r.guest)` interim shim is gone.
- Dropdown render condition is `query.trim().length > 0`.
- Build + lint green.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Human UAT — SRCH-01..04 on desktop + mobile</name>
  <what-built>
Complete fuzzy search pipeline:
- Fuse.js-powered matching with threshold 0.3, equal-weighted firstName+lastName.
- Tiered ranking: substring-prefix > substring-contains > fuzzy, capped at 10.
- Match highlighting: bold on matched character ranges in dropdown rows.
- No-results message with locked copy when query has text but zero matches.
- 150ms debounce (existing, unchanged) drives the per-keystroke updates.
  </what-built>
  <how-to-verify>
Start dev server: `npm run dev`. Verify each case on desktop (Chrome) AND one mobile context (iOS Safari on a real iPhone or Chrome DevTools iPhone emulation if no device available).

**SRCH-01 (typo tolerance):**
  1. Type `Smih` — a guest named "Smith" (or closest) appears in the dropdown within 10 results.
  2. Type `Mahke` — "Mahek Patel" appears.
  3. Type `Saumy` — "Saumya" appears in the top 3.

**SRCH-02 (search-as-you-type):**
  4. Clear the input, then type `M`, `Ma`, `Mah`, `Mahe`, `Mahek` one character at a time. Results update visibly at each keystroke (debounced 150ms — expect a barely-perceptible delay, not a freeze).
  5. On mobile: no noticeable lag typing a 5-char name on a real phone over WiFi.

**SRCH-03 (ranking + highlighting):**
  6. Type `Mah` — "Mahek Patel" (prefix match) appears ABOVE any "Rhea Mahal"-style contains match and any fuzzy-only match like "Max Patel".
  7. The letters `Mah` are visibly bolded inside the rendered name. Both first- and last-name hits bold correctly when applicable.
  8. Dropdown never shows more than 10 entries even for broad queries like `a`.

**SRCH-04 (no results):**
  9. Type `xyz` — the dropdown renders exactly: `No guests match 'xyz'. Check spelling or try last name only.`
  10. Clear the input — the dropdown disappears (no empty card flash).

**Scope guards:**
  11. Type text from a guest's `description` or `contactInfo` field (e.g. `bride` or a phone-number fragment) — NO results should appear on that basis alone. (If a guest happens to have `bride` in their firstName/lastName, that is fine; the test is that description/contactInfo alone does not match.)

**iOS Safari specifics (if reachable):**
  12. Autocorrect does not silently rewrite `Smih` into a wrong word that breaks matching. If iOS aggressively corrects, confirm `autoCorrect="off"` / `autoCapitalize="off"` / `spellCheck={false}` attributes are present on the input (Research Pitfall 3). If missing, file as a follow-up rather than a phase blocker.
  </how-to-verify>
  <resume-signal>Type "approved" to finalize Phase 2, or describe any failing case.</resume-signal>
</task>

</tasks>

<verification>
- `npm run build` and `npm run lint` both pass after Task 3.
- Human UAT (Task 4) covers SRCH-01..04 explicitly with concrete inputs.
- No-results copy matches CONTEXT.md character-for-character.
- No raw-HTML injection APIs used anywhere in the phase diff (React children only).
</verification>

<success_criteria>
- **SRCH-01:** Typos like `Smih`, `Mahke`, `Saumy` return the correct guest (human-verified).
- **SRCH-02:** Results update per keystroke with no perceptible lag on a real phone (human-verified).
- **SRCH-03:** Best match appears first; prefix > contains > fuzzy ordering visible; matched chars bolded via React-children HighlightedText (human-verified + build-verified).
- **SRCH-04:** `xyz` query renders the exact locked copy; empty input renders nothing (human-verified).
</success_criteria>

<risk>
- If a user's device autocorrects "Smih" to something else entirely, matching may shift unpredictably. Mitigation: research-flagged `autoCorrect="off"` on the input — SearchForm.tsx does NOT currently set these attributes; a one-line patch there may be warranted during UAT, but is not required to close SRCH-01..04 given the forgiving threshold.
- Overlapping match indices from Fuse can produce awkward bold runs; the range-clamp in HighlightedText Task 1 step 5 mitigates the visual artifact.
</risk>

<output>
After completion, create `.planning/phases/02-fuzzy-search/02-02-SUMMARY.md` with:
- Final GuestDropdown props shape
- HighlightedText range-handling notes (clamp behavior for overlaps)
- UAT results per SRCH-01..04
- Any follow-ups (e.g. iOS autocorrect attribute patch on SearchForm.tsx if discovered)
</output>
