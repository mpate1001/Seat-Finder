---
id: 999-01
type: backlog
status: parked
captured: 2026-04-16
captured_during: phase-02-uat
requires_brainstorm: true
---

# Backlog 999-01 — Family grouping in search

## Idea
When a guest searches any member of a family, surface the whole family (so kids / in-laws / partners find their table together without each person re-searching).

## User motivation
Families arriving together at the reception shouldn't need to re-type the app for every member. One search should show "Jane + 3 others at Table 7."

## Open design questions (brainstorm before planning)
1. **Data model**
   - Option A — new `familyId` column in the Google Sheet (explicit group key). Clean, handles mixed surnames (in-laws, kids with different last names).
   - Option B — free-text `familyGroup` label (e.g. "Smith Family"). Same as A but human-readable in the sheet; slightly more typo-prone.
   - Option C — implicit via shared `lastName` + `tableNumber`. Zero data entry but breaks for unrelated Smiths at the same table and misses mixed-surname families. Not recommended.
2. **UX surface**
   - In the **dropdown**: add extra rows for siblings under the searched row. Keeps everything pre-click but bloats the list.
   - In the **table modal**: "Your family at Table 7: Jane, Bobby, …" — the reveal feels like a payoff after selection. Recommended direction.
3. **Cross-table families**
   - If a family sits at different tables (e.g. kids at a kids' table), do we show all members with their table, or only members at the selected guest's table? Needs decision.
4. **Privacy**
   - Family rosters are public to anyone who knows one name. OK for this wedding context but worth flagging.

## Acceptance sketch (tentative — refine during plan)
- Sheet gains a `familyId` column (empty string = solo guest).
- Guests with matching non-empty `familyId` group together in the UI.
- Modal shows family members at the same table as a secondary list under the primary guest's card.

## Out of scope (this is a parked idea)
- No implementation until post-Phase 2. Brainstorm + design lock first.
- Do NOT pollute Phase 2's Fuse ranking with family logic — family expansion happens at render time after search, not inside `searchGuests`.
