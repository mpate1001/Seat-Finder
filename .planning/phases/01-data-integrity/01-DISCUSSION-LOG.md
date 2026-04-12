# Phase 1: Data Integrity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 01-data-integrity
**Areas discussed:** Table position verification, Google Sheet column structure, Coordinate migration approach

---

## Table Position Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Verify all 54 tables against reference | Cross-check every table coordinate against the floor plan image | |
| Fix known 46/47 bug only | Just fix the confirmed overlap, trust the rest | |
| User provided reference + context | Layout will change, table count not final (up to 68), fix system now with current 54 as baseline | ✓ |

**User's choice:** Layout will change — table count isn't finalized. Provided reference floor plan image showing up to 68 tables. Fix the coordinate system now using the current 54-table layout as baseline.
**Notes:** Reference image shows symmetric layout around dance floor/stage. Tables 1-14 rectangular (center), rest round in columns on both sides.

---

## Google Sheet Column Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Ask user for headers | Get exact column names from user | ✓ |

**User's choice:** Confirmed exact headers: "Table Number", "First Name", "Last Name", "Contact Info", "Guest Description"
**Notes:** These map directly to the existing `Guest` interface fields in `src/types.ts`.

---

## Coordinate Migration Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Keep canvasWidth/canvasHeight as metadata | Convert to percentages but retain reference dimensions | |
| Drop canvas dimensions entirely | Pure 0-1 percentages, self-contained | ✓ |

**User's choice:** Drop canvasWidth/canvasHeight — percentages are self-contained, makes sense.
**Notes:** User confirmed this approach when asked.

---

## Implementation Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Fix system now with current 54-table baseline | Percentage coords + header parsing now, update positions later when count is final | ✓ |
| Wait until table count is locked | Delay coordinate work until layout is finalized | |

**User's choice:** Option A — fix the system now. Updating positions later is trivial with percentages.
**Notes:** Recommended by Claude, confirmed by user.

---

## Claude's Discretion

- Error handling for missing/malformed CSV columns
- Whether to add duplicate coordinate validation

## Deferred Ideas

None — discussion stayed within phase scope.
