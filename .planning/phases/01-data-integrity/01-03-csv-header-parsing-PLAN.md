---
phase: 01-data-integrity
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/googleSheets.ts
autonomous: true
requirements: [DATA-03]

must_haves:
  truths:
    - "CSV parsing looks up columns by header name (case-insensitive, trimmed), not positional index"
    - "A CSV with reordered columns still produces correct Guest objects"
    - "A CSV missing any of the 5 required headers throws a loud error naming the missing column(s)"
    - "Existing parseCSVLine helper is retained unchanged"
  artifacts:
    - path: "src/services/googleSheets.ts"
      provides: "Header-indexed CSV parser for guest list"
      exports: ["fetchGuests"]
  key_links:
    - from: "src/services/googleSheets.ts"
      to: "src/App.tsx"
      via: "fetchGuests() import"
      pattern: "fetchGuests"
---

<objective>
Replace positional CSV indexing in `src/services/googleSheets.ts` with a header-index map that tolerates column reordering and case/whitespace variation.

Purpose: Close DATA-03 — guest parsing must survive Google Sheets column renames/reorders without code changes.
Output: Updated `fetchGuests` that builds a `Record<string, number>` header-to-index map from row 0, validates all 5 canonical headers exist, and maps each data row by canonical name.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-data-integrity/01-CONTEXT.md
@.planning/phases/01-data-integrity/01-RESEARCH.md
@src/services/googleSheets.ts
@src/types.ts

<interfaces>
Guest shape (from src/types.ts — unchanged):
```typescript
export interface Guest {
  tableNumber: string;
  firstName: string;
  lastName: string;
  contactInfo: string;
  description: string;
}
```

Canonical header names (from D-07, lowercased form for matching):
  tableNumber  -> 'table number'
  firstName    -> 'first name'
  lastName     -> 'last name'
  contactInfo  -> 'contact info'
  description  -> 'guest description'

Existing helper to reuse unchanged:
  function parseCSVLine(line: string): string[]  // handles quoted fields with "" escapes
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace positional CSV parsing with header-indexed lookup</name>
  <files>src/services/googleSheets.ts</files>
  <read_first>
    - src/services/googleSheets.ts (entire file — retain parseCSVLine helper)
    - src/types.ts (Guest interface)
    - .planning/phases/01-data-integrity/01-RESEARCH.md (sections: "Header-Based CSV Parsing", "Error Handling", "Pitfall 3/4")
    - .planning/phases/01-data-integrity/01-CONTEXT.md (D-06, D-07, D-08)
  </read_first>
  <action>
    Modify `src/services/googleSheets.ts`. Keep `SHEET_URL` and `parseCSVLine` exactly as-is. Rewrite only the body of `fetchGuests` between the `const csvText = await response.text();` line and the `return guests;` line.

    1. Add a module-scope canonical header map after the `SHEET_URL` constant:
       ```typescript
       const HEADER_MAP: Record<keyof Guest, string> = {
         tableNumber: 'table number',
         firstName: 'first name',
         lastName: 'last name',
         contactInfo: 'contact info',
         description: 'guest description',
       };
       ```

    2. Add a private helper below `parseCSVLine` (or above `fetchGuests` — pick one, keep module-level exports unchanged):
       ```typescript
       function buildHeaderIndex(headerLine: string): Record<string, number> {
         const headers = parseCSVLine(headerLine);
         const index: Record<string, number> = {};
         headers.forEach((h, i) => {
           const key = h.trim().toLowerCase();
           if (key in index) {
             console.warn(`Duplicate CSV header "${key}" at column ${i}; using rightmost occurrence`);
           }
           index[key] = i;
         });
         return index;
       }
       ```
       (The duplicate-header warning addresses Pitfall 4 from RESEARCH.)

    3. Rewrite the parsing body of `fetchGuests`:
       ```typescript
       const lines = csvText.split('\n');
       if (lines.length === 0 || !lines[0].trim()) {
         throw new Error('Guest list is empty');
       }

       const headerIndex = buildHeaderIndex(lines[0]);

       const idx: Record<keyof Guest, number | undefined> = {
         tableNumber: headerIndex[HEADER_MAP.tableNumber],
         firstName: headerIndex[HEADER_MAP.firstName],
         lastName: headerIndex[HEADER_MAP.lastName],
         contactInfo: headerIndex[HEADER_MAP.contactInfo],
         description: headerIndex[HEADER_MAP.description],
       };

       const missing = (Object.keys(idx) as (keyof Guest)[])
         .filter((k) => idx[k] === undefined);
       if (missing.length > 0) {
         throw new Error(`Guest list is missing required column(s): ${missing.join(', ')}`);
       }

       const guests: Guest[] = [];
       for (let i = 1; i < lines.length; i++) {
         const line = lines[i].trim();
         if (!line) continue;
         const fields = parseCSVLine(line);
         guests.push({
           tableNumber: (fields[idx.tableNumber!] ?? '').trim(),
           firstName: (fields[idx.firstName!] ?? '').trim(),
           lastName: (fields[idx.lastName!] ?? '').trim(),
           contactInfo: (fields[idx.contactInfo!] ?? '').trim(),
           description: (fields[idx.description!] ?? '').trim(),
         });
       }
       ```

    4. Keep the outer try/catch exactly as it is — it already logs via `console.error` and re-throws a user-friendly message, matching the project's error-handling convention. The new `throw new Error(...)` calls above bubble through that catch unchanged.

    5. DO NOT change the imports, `SHEET_URL`, or `parseCSVLine`. DO NOT change the exported signature of `fetchGuests`.

    Error-handling policy (per RESEARCH "Error Handling" — Claude's Discretion from CONTEXT.md):
    - Missing required column -> throw (loud fail, surfaced to App.tsx error UI).
    - Extra columns in sheet -> ignored silently (not read, not warned).
    - Row with fewer fields than expected -> use empty string for missing cells (partial rows kept).
    - Blank rows -> skipped (preserved existing behavior).
  </action>
  <verify>
    <automated>npm run lint && npm run build</automated>
    Manual verification:
    - `npm run dev` -> app loads the live Google Sheets guest list successfully, search returns expected guests with correct first/last/table values.
    - (Optional controlled test) Create a local 3-row CSV with reordered headers (e.g. "First Name, Table Number, Last Name, Guest Description, Contact Info"), temporarily point fetch at a `data:` URL or local file, confirm guests map correctly.
  </verify>
  <acceptance_criteria>
    - `src/services/googleSheets.ts` contains the substring `HEADER_MAP`
    - `src/services/googleSheets.ts` contains the substring `toLowerCase()`
    - `src/services/googleSheets.ts` contains the substring `buildHeaderIndex`
    - `src/services/googleSheets.ts` does NOT contain the literal substring `fields[0].trim()` (positional indexing is gone)
    - `src/services/googleSheets.ts` does NOT contain the literal substring `fields[1].trim()`
    - `src/services/googleSheets.ts` still contains the unchanged `function parseCSVLine(line: string): string[]` definition
    - `src/services/googleSheets.ts` still exports `fetchGuests` with signature `(): Promise<Guest[]>`
    - Error message `Guest list is missing required column(s):` is present in the source
    - `npm run lint` exits 0
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>
    fetchGuests parses by header name with case-insensitive, whitespace-tolerant matching. Missing-column error is loud and specific. `parseCSVLine` is untouched. Lint and build are green. Live Google Sheets load still works in the browser.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Google Sheets CSV -> client | CSV text is fetched over HTTPS from a user-published Google Sheet. Header row and cell values are treated as untrusted text but are only ever assigned to `Guest` string fields rendered as text children in React (auto-escaped). No eval, no raw HTML interpolation, no SQL. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-03-01 | Tampering | Google Sheets CSV headers | mitigate | Header matching is case-insensitive + trimmed; unknown headers are ignored; missing required headers fail loudly with a specific error message. Duplicate headers trigger a console.warn (last-write-wins is explicit). |
| T-01-03-02 | Injection (script) | Guest field values rendered in React | accept | React auto-escapes string children; the codebase uses no raw-HTML render paths. Pre-existing behavior, unchanged by this plan. |
| T-01-03-03 | Denial of Service | Oversized CSV | accept | Sheet is author-controlled (~200 guests expected). No parsing recursion; O(rows * cols) single pass. Accept risk for v1. |
| T-01-03-04 | Information Disclosure | console.warn on duplicate headers | accept | Logs only the header string (non-PII by design per D-07 canonical names). Dev/prod behavior identical and intentional. |
</threat_model>

<verification>
- `npm run lint` exits 0
- `npm run build` exits 0
- Grep confirms HEADER_MAP present, positional `fields[0]..fields[4]` indexing absent
- Manual browser load against live sheet returns guests correctly
</verification>

<success_criteria>
Phase success criterion 3 ("A guest list CSV with reordered or renamed columns still parses correctly without code changes") is satisfied: columns are looked up by canonical header name with case-insensitive, whitespace-tolerant matching; missing columns fail fast with a named error.
</success_criteria>

<output>
After completion, create `.planning/phases/01-data-integrity/01-03-SUMMARY.md` per template.
</output>
