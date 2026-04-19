---
phase: 2
slug: fuzzy-search
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (Vite-native; to be installed in Wave 0 if tests added) |
| **Config file** | `vite.config.ts` (add `test` block) — none currently |
| **Quick run command** | `npm run test -- --run searchGuests` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~2 seconds (pure-function tests) |

**Note:** Planner may defer test infrastructure (repo currently has zero tests). If deferred, manual-verification table below covers all requirements.

---

## Sampling Rate

- **After every task commit:** `npm run build` (tsc strict + vite) — ~400ms
- **After plan complete:** Full suite if tests added; manual verification otherwise
- **Before `/gsd-verify-work`:** Build green + manual checklist complete
- **Max feedback latency:** 2 seconds (build) / 2 seconds (tests)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SRCH-01 | — | Fuzzy match returns correct guest for 1-2 char typo | unit | `npm run test -- --run searchGuests` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SRCH-03 | — | Best-match ranked first; substring > fuzzy ordering | unit | `npm run test -- --run searchGuests` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | SRCH-04 | — | Empty result set renders "No guests match..." copy | build+manual | `npm run build` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | SRCH-02 | — | Results update on each keystroke (debounced 150ms) | manual | browser test | ✅ | ⬜ pending |
| 02-02-02 | 02 | 2 | SRCH-03 | — | Match highlighting renders bold on matched chars | build+manual | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan numbering is provisional — planner will finalize task IDs.*

---

## Wave 0 Requirements

- [ ] `vitest` + `@vitest/ui` — install as devDependency (planner decides scope)
- [ ] `vite.config.ts` test block — add if tests included
- [ ] `src/services/searchGuests.test.ts` — stubs for SRCH-01, SRCH-03

*If planner defers tests: "Existing build-only validation covers phase with manual UAT for behavioral criteria."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Search-as-you-type feels snappy on mobile | SRCH-02 | Perceived latency requires human judgment | Type a 5-char name on phone; confirm results update visibly per keystroke with no lag |
| Match highlighting visually readable | SRCH-03 | Visual rendering quality | Search "mah" → "**Mah**ek Patel" renders with bold weighted correctly, not ALL-caps or hard to read |
| No-results state feels reassuring, not alarming | SRCH-04 | Copy tone is subjective | Search "xyz" → message reads as helpful hint, not error |
| iOS Safari autocorrect doesn't break search | SRCH-01 | Platform-specific behavior | Type "Smih" on iPhone Safari; autocorrect may intervene — verify result still found regardless |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (tests run once with `--run`)
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
