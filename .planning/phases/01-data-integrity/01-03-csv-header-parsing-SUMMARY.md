---
phase: 01-data-integrity
plan: 03
subsystem: data-ingestion
tags: [csv, google-sheets, parsing, resilience]
requires: []
provides: ["Header-indexed CSV guest parser"]
affects: ["src/services/googleSheets.ts"]
tech-stack:
  added: []
  patterns: ["header-to-index lookup map", "case-insensitive header matching", "loud-fail on missing columns"]
key-files:
  created:
    - .planning/phases/01-data-integrity/deferred-items.md
  modified:
    - src/services/googleSheets.ts
decisions:
  - "Case-insensitive, whitespace-trimmed header matching (handles casing/spacing drift in Google Sheets edits)"
  - "Duplicate headers: warn via console.warn and use rightmost occurrence (last-write-wins, explicit)"
  - "Missing required column: throw loud named error, surfaced through existing App.tsx error UI"
  - "Extra columns: silently ignored; short rows: missing cells become empty strings; blank rows: skipped"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-12"
  tasks: 1
  files_touched: 1
---

# Phase 01 Plan 03: CSV Header Parsing Summary

Replaced positional (`fields[0..4]`) CSV indexing in `fetchGuests` with a canonical header-to-index map so guest parsing survives Google Sheets column renames/reorders.

## What Changed

- **`src/services/googleSheets.ts`**
  - Added module-scope `HEADER_MAP: Record<keyof Guest, string>` mapping each `Guest` field to its lowercased canonical header (`'table number'`, `'first name'`, `'last name'`, `'contact info'`, `'guest description'`).
  - Added `buildHeaderIndex(headerLine)` helper that parses the first row, lowercases+trims each header, warns on duplicates, and returns a `Record<string, number>` lookup.
  - Rewrote the body of `fetchGuests` between the `csvText` fetch and the final `return guests` to: validate non-empty CSV, build header index, resolve each canonical field to a column index, loud-fail if any required column is missing, then iterate rows mapping by index per field.
  - Preserved `parseCSVLine` exactly as-is, plus the outer try/catch error shape.

## Behavior Matrix

| Input scenario | Behavior |
|----------------|----------|
| Columns reordered | Works — lookup by header name, not position |
| Header case/whitespace drift (`"First Name"`, `" first name "`, `"FIRST NAME"`) | Works — normalized via `trim().toLowerCase()` |
| Any of the 5 required headers missing | Throws `Guest list is missing required column(s): <names>` |
| Duplicate header | `console.warn`, rightmost occurrence wins |
| Extra columns in sheet | Silently ignored |
| Row with fewer fields than expected | Missing cells become `''` (partial row kept) |
| Blank rows | Skipped (unchanged behavior) |
| Empty CSV / empty header row | Throws `Guest list is empty` |

## Acceptance Criteria

- `HEADER_MAP` present: yes
- `toLowerCase()` present: yes
- `buildHeaderIndex` present: yes
- `fields[0].trim()` / `fields[1].trim()` absent: yes
- `parseCSVLine` retained unchanged: yes
- `fetchGuests: (): Promise<Guest[]>` signature unchanged: yes
- Error string `Guest list is missing required column(s):` present: yes
- `npm run build` exits 0: yes
- `npm run lint` exits 0: **no — pre-existing environmental gap (see Deviations)**

## Deviations from Plan

### Deferred Issues

**1. Pre-existing: ESLint v9 has no config file in the repo**
- **Found during:** Task 1 verification
- **Issue:** `npm run lint` fails with `ESLint couldn't find an eslint.config.(js|mjs|cjs) file`. ESLint v9.39.1 no longer supports legacy `.eslintrc.*`; the repo has never had a flat-config file (CLAUDE.md explicitly notes this).
- **Scope:** Pre-existing, not caused by this task. Affects every file in the repo identically.
- **Action:** Logged to `.planning/phases/01-data-integrity/deferred-items.md`. Recommend a follow-up plan to add `eslint.config.js` (flat config).
- **Impact on this plan:** Build (`tsc && vite build`) passes cleanly, which provides full type-check coverage of the change. The lint gap does not reflect on the correctness of this plan's code.

No other deviations. Plan executed as written.

## Threat Model Compliance

- **T-01-03-01 (Tampering — headers):** Mitigated. Case-insensitive + trimmed matching; unknown headers ignored; missing required headers throw with specific names; duplicate headers `console.warn`.
- **T-01-03-02, T-01-03-03, T-01-03-04:** Accepted risks — unchanged by this plan.

## Commits

- `d64783e` feat(01-03): parse CSV by header name, not column index

## Self-Check: PASSED

- FOUND: `src/services/googleSheets.ts` (modified)
- FOUND: `.planning/phases/01-data-integrity/deferred-items.md` (created)
- FOUND: commit `d64783e`
