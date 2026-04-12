---
status: resolved
phase: 01-data-integrity
source: [01-VERIFICATION.md]
started: 2026-04-12T00:00:00Z
updated: 2026-04-12T00:00:00Z
---

## Current Test

[all tests complete]

## Tests

### 1. Visual distinctness of tables 46/47
expected: Tables 46 and 47 render as two separate, non-overlapping markers on the floor plan image
result: pass
note: Coordinates will be re-mapped via Phase 5 admin tool once final floor plan is locked — percentage-based system verified working, exact pixel placement is throwaway data

### 2. Window resize tracking
expected: Resize browser from ~400px to ~1400px wide; each table marker stays anchored on its table across all widths
result: pass

### 3. Enlarged-view alignment
expected: Tap/click "enlarge" on the floor plan; every marker remains correctly aligned with its table in the enlarged view
result: pass
note: Enlarged modal is smaller than viewport — tracked separately as UX nit for Phase 3 (Map Experience)

### 4. Live CSV column reorder
expected: Reorder or rename-case columns in the source Google Sheet; guest list still loads and tables still resolve correctly without code changes
result: skipped
note: Deferred — code-level test verified header-index parsing works; live sheet test not required to close phase

## Summary

total: 4
passed: 3
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps
