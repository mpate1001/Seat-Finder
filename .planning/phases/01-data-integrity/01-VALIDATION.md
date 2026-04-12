---
phase: 1
slug: data-integrity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test framework installed; TypeScript + Vite build serve as the automated gate |
| **Config file** | none |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~10 seconds (lint), ~15-25 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** `npm run build` must be green AND manual checks in table below completed
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | DATA-01, DATA-02 | — | N/A | build | `npm run build` | ✅ existing | ⬜ pending |
| 1-02-01 | 02 | 2 | DATA-02 | — | N/A | build | `npm run build` | ✅ existing | ⬜ pending |
| 1-03-01 | 03 | 3 | DATA-03 | — | N/A | build | `npm run build` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Tasks above are placeholders — actual task IDs set by planner.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (TypeScript strict mode + Vite build catch dropped-field references; `npm run lint` catches unused imports and React Hook issues).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tables 46 and 47 appear in visually distinct positions | DATA-01 | Pixel positioning is visual, no snapshot framework | Run `npm run dev`, select any guest at table 46 and any guest at table 47, visually confirm the two markers are not overlapping |
| Markers stay on correct tables when browser is resized | DATA-02 | Responsive pixel position is visual | Run `npm run dev`, select a guest, drag browser window from ~400px to ~1400px width, confirm marker remains visually centered on the table image |
| CSV with reordered column headers still parses | DATA-03 | Requires controlled CSV fixture | Create a local CSV that swaps "First Name" and "Last Name" column order; temporarily point VITE fetch URL (or mock) at the fixture; confirm names appear correctly in search |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (`npm run lint` / `npm run build`) or manual check above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references — N/A (no new test infra)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills task IDs

**Approval:** pending
