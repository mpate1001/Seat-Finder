---
status: partial
phase: 01-data-integrity
source: [01-VERIFICATION.md]
started: 2026-04-12T00:00:00Z
updated: 2026-04-12T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visual distinctness of tables 46/47
expected: Tables 46 and 47 render as two separate, non-overlapping markers on the floor plan image
result: [pending]

### 2. Window resize tracking
expected: Resize browser from ~400px to ~1400px wide; each table marker stays anchored on its table across all widths
result: [pending]

### 3. Enlarged-view alignment
expected: Tap/click "enlarge" on the floor plan; every marker remains correctly aligned with its table in the enlarged view
result: [pending]

### 4. Live CSV column reorder
expected: Reorder or rename-case columns in the source Google Sheet (e.g. swap First/Last, title-case headers); guest list still loads and tables still resolve correctly without code changes
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
