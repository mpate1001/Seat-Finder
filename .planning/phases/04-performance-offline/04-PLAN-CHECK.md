# Phase 4: Performance & Offline — Plan Check Report

**Checker:** gsd-plan-checker
**Run:** 2026-04-17 12:21 EDT
**Phase:** `04-performance-offline`
**Plans reviewed:** 04-01, 04-02, 04-03, 04-04, 04-05, 04-06
**Context artifacts loaded:** 04-CONTEXT.md (19 decisions), 04-RESEARCH.md (11 sections), ROADMAP.md (Phase 4), REQUIREMENTS.md (PERF-01..04)

---

## Verdict: **NEEDS-FIXES**

**Summary:** 2 blockers (one of which contradicts a CONTEXT-locked decision and will ship the wrong PWA splash color), 5 warnings, 3 info notes. Dependency graph is correct, scope is well-partitioned across the 6 plans, task structure is excellent, and every PERF-0X requirement has at least one covering task. However, the research document silently re-numbered CONTEXT decisions D-13..D-19, and that mis-numbering leaked into plan 04-05's manifest `background_color` value (navy instead of the light-gray the user locked). The other warnings are fixable quickly.

Once B-1 and B-2 are resolved, plans are ready for `/gsd-execute-phase 04`.

---

## Coverage Matrix

### PERF-0X requirement coverage — ALL COVERED

| Req     | Plans                | Concrete tasks                                                                                                                                                                                        | Coverage |
|---------|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| PERF-01 | 04-02, 04-04, 04-05  | 04-02 T1–T3 (cache wrapper + App wiring), 04-04 T1–T3 (StalenessBadge), 04-05 T2–T3 (UpdateToast + suppression)                                                                                        | COVERED  |
| PERF-02 | 04-03, 04-05         | 04-03 T1 (icon pipeline), 04-05 T1 (VitePWA config + manifest + Apple meta tags)                                                                                                                       | COVERED  |
| PERF-03 | 04-05                | 04-05 T1 (workbox globPatterns + globIgnores + runtimeCaching [CacheFirst / SWR / NetworkOnly] + navigateFallbackDenylist for docs.google.com)                                                          | COVERED  |
| PERF-04 | 04-01                | 04-01 T1 (env plumbing), T2 (module-load guard), T3 (build-time guard)                                                                                                                                 | COVERED  |

### CONTEXT D-01..D-19 decision coverage

| Decision | Locked intent                                                                                  | Plan(s)           | Status / Note |
|----------|-----------------------------------------------------------------------------------------------|-------------------|---------------|
| D-01     | network-first 2s timeout, 24h hard expiry                                                     | 04-02             | COVERED (`NETWORK_TIMEOUT_MS = 2000`, `HARD_EXPIRY_MS = 24h`) |
| D-02     | cache key `seatfinder.guests.v1`                                                              | 04-02             | COVERED (`CACHE_KEY` constant) |
| D-03     | stored shape `{ fetchedAt, guests }`                                                          | 04-02             | COVERED |
| D-04     | write in service, read in App fast-path                                                       | 04-02             | PARTIAL — see **W-1** (fast-path not true fast-path) |
| D-05     | toast: "New version available — tap to refresh"; 10s auto-dismiss                             | 04-05             | COVERED (copy verbatim, `AUTO_DISMISS_MS=10_000`) |
| D-06     | toast palette navy/red/10px radius, slides up                                                  | 04-05             | COVERED (CSS navy bg, red CTA, 10px radius, `slideUpToast` keyframe) |
| D-07     | suppress toast while MapView is open; re-queue on close                                        | 04-05             | COVERED via `suppressed={selectedGuest !== null}` |
| D-08     | ≥1h or last-fetch-failed → muted "Updated Xm ago" badge in card header; tap triggers refetch  | 04-04             | COVERED (1h threshold, tap fires `onRefresh`) — see **W-2** (last-fetch-failed path not implemented) |
| D-09     | offline badge "Offline — showing cached list" in muted slate                                  | 04-04             | COVERED (copy verbatim) |
| D-10     | cache > 24h AND network fails → existing error card with specific copy                         | 04-02             | PARTIAL — error message matches `/24 hours/` but exact copy ("Ask staff for directions…") not enforced; see **W-3** |
| D-11     | No proactive install prompt                                                                   | (negative)        | COVERED by absence — no install-prompt task present in any plan |
| D-12     | iOS meta tags (`apple-touch-icon`, capable, status-bar-style)                                 | 04-05             | COVERED |
| D-13     | App name "Seat Finder — Mahek & Saumya", short_name "Seat Finder"                             | 04-05             | COVERED (correct literals) — but plan cites "D-09" instead of D-13 (**I-1**) |
| D-14     | Theme color `#2b2d42`; background color `#edf2f4` (LIGHT GRAY)                                | 04-05             | **BLOCKER B-1** — plan sets `background_color: '#2b2d42'`, contradicting CONTEXT D-14 |
| D-15     | Icon = red teardrop pin; 192 + 512 + 512-maskable + 180 apple-touch; script via sharp          | 04-03             | COVERED — but plan cites "D-10/D-11/D-12" instead of D-15 (**I-1**) |
| D-16     | No per-device iOS splash PNGs                                                                 | (negative)        | COVERED by absence |
| D-17     | `VITE_SHEET_URL` build-time env var; `.env.example` committed; `.env` gitignored              | 04-01             | COVERED |
| D-18     | Fail build if env var missing; no silent fallback                                              | 04-01             | COVERED (module-load + `configResolved` guard) |
| D-19     | No runtime override                                                                           | 04-01             | COVERED (no runtime override code path present) |

**Net decision coverage:** 19/19 *referenced*, but 1 is **contradicted** (D-14 → B-1) and 6 are **cited under the wrong number** (the systemic RESEARCH.md renumbering — I-1).

---

## Dimension Results

### Dimension 1 — Requirement Coverage: PASS
Every PERF-0X maps to at least one concrete task with files + action + verify + done.

### Dimension 2 — Task Completeness: PASS
All 15 auto tasks across 04-01..04-06 have `<files>`, `<action>`, `<verify>`, and `<done>` populated. The one `checkpoint:human-verify` task (04-06 Task 4) has `<what-built>`, `<how-to-verify>`, and `<resume-signal>`, mapping cleanly to the minimum-blocking UAT items.

### Dimension 3 — Dependency Correctness: PASS
Dependency graph is acyclic and wave numbers are consistent with `depends_on`:

| Plan  | Wave | depends_on                      | Verified |
|-------|------|---------------------------------|----------|
| 04-01 | 1    | []                              | OK — truly parallelizable entry |
| 04-02 | 2    | ["04-01"]                       | OK — needs `parseGuestsCsv`, `SHEET_URL` |
| 04-03 | 2    | []                              | OK — icon pipeline is dep-free, runs parallel with 04-02 |
| 04-04 | 3    | ["04-02"]                       | OK — needs `fetchedAt` state and cache metadata |
| 04-05 | 4    | ["04-01","04-02","04-03","04-04"] | OK — needs icons, requires `selectedGuest` + cache UI so the whole app is stable before SW installs |
| 04-06 | 5    | [01..05]                        | OK |

**Parallel-wave file-overlap check:** Wave 2 (04-02 + 04-03) touch disjoint file sets (`src/services/**` + `src/App.tsx` vs `scripts/**` + `public/pwa-*.png` + `package.json`). No conflict. Wave 1 and Wave 3+ are single-plan so no parallel overlap possible.

### Dimension 4 — Key Links Planned: PASS
Every must_haves.key_links entry is implemented by at least one task action:

- `googleSheets.ts → import.meta.env.VITE_SHEET_URL` (04-01 T2)
- `vite.config.ts → process.env.VITE_SHEET_URL via configResolved` (04-01 T3)
- `guestsCache.ts → parseGuestsCsv` (04-02 T1 explicit import line)
- `App.tsx → fetchGuestsCached(SHEET_URL)` (04-02 T3)
- `StalenessBadge.tsx → useOnlineStatus + useCacheAge` (04-04 T1 authored, T2 consumed)
- `App.tsx → <StalenessBadge fetchedAt={fetchedAt} onRefresh={loadGuests} />` (04-04 T3)
- `UpdateToast.tsx → virtual:pwa-register/react` (04-05 T2)
- `App.tsx → <UpdateToast suppressed={selectedGuest !== null} />` (04-05 T3)
- `package.json scripts.build → scripts/verify-pwa-build.mjs` (04-06 T1)

### Dimension 5 — Scope Sanity: PASS with one note
Per-plan task count: 2, 3, 1, 3, 3, 4. All under the 5-task blocker threshold; only 04-06 hits 4 tasks, but one is a non-autonomous checkpoint so execution context is effectively 3. Files-modified per plan also stay within budget (max 8 in 04-05).

### Dimension 6 — must_haves Derivation: PASS
Truths are user-observable or testable invariants (not "X is installed"). Artifacts cite `min_lines` thresholds that correspond to actual code volumes. Key-links list is complete and specific.

### Dimension 7 — Context Compliance: **FAIL** (see B-1 and I-1 below)
Locked D-14 is contradicted; 6 plan D-references are mis-numbered.

### Dimension 7b — Scope Reduction: PASS
No "v1 / stub / placeholder / dynamic in future" language in any plan action. Every locked decision is delivered fully within this phase. StalenessBadge does not silently narrow D-08 — all three render branches are implemented.

### Dimension 7c — Architectural Tier Compliance: PASS
Every task places work in the tier the Responsibility Map assigns:
- SW lifecycle → Browser/SW tier via `virtual:pwa-register/react` (04-05)
- Guest CSV runtime cache → Browser localStorage wrapper (04-02)
- Floor plan image runtime cache → Browser/SW Cache API via Workbox `CacheFirst` (04-05)
- Env var injection → Vite build-time via `import.meta.env` (04-01)
- Icon generation → Node/sharp build script (04-03)

### Dimension 8 — Nyquist Compliance: PASS
- **8e:** No VALIDATION.md exists as a separate file, but RESEARCH.md §11 ("Validation Architecture") IS the validation contract for this phase and enumerates Wave-0 gaps plus per-req test commands. This is equivalent coverage; I note but do not fail.
- **8a:** Every auto task has `<automated>` in `<verify>`. No `MISSING` references.
- **8b:** No watch-mode flags. No suites > 30s. Build-smoke is cheap (file-existence check). All `vitest run` commands scope to the changed file.
- **8c:** Every wave has ≥⅔ verified tasks. Wave 2's 04-02 has all 3 tasks verified; 04-03's sole task verified.
- **8d:** RESEARCH.md §11 table explicitly marks the Wave-0 artifacts (`vitest.config.ts`, `src/test-setup.ts`, test files) as gaps and plans 04-01 T2 and 04-02 T2 create them.

### Dimension 9 — Cross-Plan Data Contracts: PASS with caution
Two caching layers touch the Sheets URL (SW + localStorage), and the plans correctly route it: `NetworkOnly` runtime rule in Workbox means the SW never intercepts the CSV, so `guestsCache.ts` is the sole cache for that data stream. RESEARCH.md Anti-Patterns call this out explicitly; plan 04-05 T1 honors it. No conflicting transforms detected.

### Dimension 10 — CLAUDE.md Compliance: PASS
- Components are PascalCase (`UpdateToast.tsx`, `StalenessBadge.tsx`).
- Services are camelCase (`guestsCache.ts`).
- Props interface naming `{ComponentName}Props` enforced (`UpdateToastProps`, `StalenessBadgeProps`).
- `function` declarations for components (not arrow functions).
- Default export for components, named exports for services — followed consistently.
- CSS kebab-case class names with component prefix (`.staleness-badge`, `.update-toast`).
- `useState<string | null>(null)` error-handling pattern preserved (04-02 T3).
- ESLint `--max-warnings 0` enforced — each task's `<verify>` calls `npm run lint`.
- No path aliases introduced.
- Only ONE new dependency (`vite-plugin-pwa`) — matches constraint.

### Dimension 11 — Research Resolution: **WARN**
RESEARCH.md has a `## Open Questions` section (line 1202) WITHOUT the `(RESOLVED)` suffix, and the three questions lack an explicit `RESOLVED:` marker. Each question does include a "Recommendation:" line that constitutes a resolution in practice — but the literal checker contract (Dimension 11) requires the `(RESOLVED)` suffix on the heading. This is **W-5** below.

### Dimension 12 — Pattern Compliance: SKIPPED
No PATTERNS.md exists for this phase.

---

## Blockers (must fix before execute)

### B-1 — Plan 04-05 manifest `background_color` contradicts CONTEXT D-14

**Where:**
- `04-05-PLAN.md` line 214: `background_color: '#2b2d42',`
- `04-05-PLAN.md` line 26 (must_haves.truths): `"VitePWA manifest.theme_color and background_color are both '#2b2d42' (D-11)"` — also cites the wrong decision number.
- RESEARCH.md §1 line 289 propagates the same incorrect value.

**What CONTEXT locks:**
> **D-14:** Theme color = `#2b2d42` (navy). Background color = `#edf2f4` (light gray). Matches the existing app card + overlay card palette.

**Impact:** Ships with the wrong iOS splash-screen color. When a guest adds the PWA to their home screen and launches it, iOS uses `background_color` to paint the splash. The user explicitly chose light gray to match the card palette (MapView.css line references `#edf2f4` as the panel background). A navy splash is a visible, user-facing regression that the user would catch only at UAT step 2a.

**Fix (copy-pasteable):**

In `04-05-PLAN.md`:

1. Change line 26 from:
   ```yaml
   - "VitePWA manifest.theme_color and background_color are both '#2b2d42' (D-11)"
   ```
   to:
   ```yaml
   - "VitePWA manifest.theme_color is '#2b2d42' and manifest.background_color is '#edf2f4' (D-14)"
   ```

2. Change line 214 from:
   ```ts
   background_color: '#2b2d42',
   ```
   to:
   ```ts
   background_color: '#edf2f4',
   ```

3. Add to the `<verify>` automated line (line 317):
   ```
   grep -q "background_color: '#edf2f4'" vite.config.ts
   ```

4. Update `success_criteria` line 636 to split the colors and reference D-14.

### B-2 — Plan 04-01 Task 3 uses an incorrect TypeScript type for the `configResolved` hook argument

**Where:** `04-01-PLAN.md` line 527:
```ts
configResolved(config: { command: string }) {
```

**Problem:** Vite plugins pass a `ResolvedConfig` to `configResolved`, and under `strict: true` + `noUnusedParameters: true`, typing it as an ad-hoc `{ command: string }` object is either a lie (structural narrowing) or a TS error depending on how the plugin's return type is inferred. The actual Vite contract is:

```ts
import type { Plugin, ResolvedConfig } from 'vite';

function requireSheetUrl(): Plugin {
  return {
    name: 'require-sheet-url',
    configResolved(config: ResolvedConfig) { … },
  };
}
```

The plan's current shape may compile if Vite's plugin-return inference is lenient, but the Execute-phase gate runs `npx tsc --noEmit` on every task. If the project's TS config flags this (it almost certainly will under the existing `strict: true`), the plan fails at the verify step with a type error that the executor has to invent a fix for — which they may or may not get right.

**Impact:** Medium — it may or may not blow up at execute time depending on exact Vite type exports. Either way, the plan should specify the correct imports.

**Fix:** In `04-01-PLAN.md` Task 3 action block (around line 517-540), replace the plugin body with:

```ts
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import react from '@vitejs/plugin-react';

function requireSheetUrl(): Plugin {
  return {
    name: 'require-sheet-url',
    configResolved(config: ResolvedConfig) {
      if (config.command === 'build' && !process.env.VITE_SHEET_URL) {
        throw new Error(
          'Build failed: VITE_SHEET_URL env var is required for production build. ' +
          'Set it in your hosting platform (Vercel/Netlify/etc.) or local shell before running `npm run build`.'
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), requireSheetUrl()],
});
```

Also add `type Plugin, type ResolvedConfig` to the `<read_first>` note and a line in `<acceptance_criteria>` or `<done>` ensuring `grep -q "ResolvedConfig" vite.config.ts`.

---

## Warnings (should fix)

### W-1 — Plan 04-02 calls its "cache-first fast-path" but implements only network-first

**Where:** `04-02-PLAN.md` line 38–39 says `"App.tsx useEffect(loadGuests, []) now calls fetchGuestsCached(SHEET_URL)"` and CONTEXT D-04 says *"cache reads happen in `App.tsx` `loadGuests()` as the fast-path before starting the fetch."*

**Problem:** The actual `fetchGuestsCached(url)` body (line 191 of the plan) does `await fetchCsvWithTimeout` FIRST, then falls back to cache only on throw. That is network-first, not cache-fast-path. CONTEXT D-04 uses the phrase "fast-path" loosely and RESEARCH.md §3 Open Question #2 acknowledges this ambiguity and recommends strict network-first. So the behavior is fine, but the language in the plan's `truths` and `must_haves` misleads a verifier.

**Fix:** Update 04-02 must_haves.truths (around line 20) to say "network-first with 2s timeout and cache fallback (network-first per RESEARCH §Open Q #2 resolution)" rather than implying a cache-first read.

### W-2 — D-08 "most recent fetch failed" badge trigger is not implemented

**Where:** CONTEXT D-08: *"If the cached guest list is >1h old OR the most recent fetch failed, show a muted 'Updated Xm ago' badge…"*

**Problem:** StalenessBadge (04-04 T2) renders the stale badge only on the age condition (`ageMs >= ONE_HOUR_MS`). There is no path that says "most recent fetch errored → show badge even when cache is fresh." To implement the OR clause, App.tsx would need to expose a `lastFetchFailed: boolean` alongside `fetchedAt`, and StalenessBadge would need a new prop.

**Fix:** Choose one of:
1. Implement the OR clause: add `lastFetchFailed` state in App.tsx (set in the catch arm of `loadGuests`), pass as prop to StalenessBadge, widen the stale render condition. Add a 5th test to `StalenessBadge.test.tsx`.
2. Acknowledge that the error-card branch already handles the "fetch failed" case (because a failure with no usable cache routes to the error UI, and a failure with a fresh cache is — per network-first semantics — silently overridden by the cached data). Document this as an intentional narrowing of D-08 in plan 04-04 must_haves with a short rationale, so `/gsd-verify-work` doesn't flag it.

Option 2 is cheap and defensible; option 1 is more literal compliance. Either is acceptable, but the current plans do neither.

### W-3 — Plan 04-02 cache-hard-expiry error copy does not match D-10 verbatim

**Where:** 04-02 line 202–205 throws:
```
Your guest list is more than 24 hours old and we cannot reach the server. Please connect to the internet and try again.
```

**CONTEXT D-10 specifies:**
> *"Can't reach the guest list. Ask staff for directions or try again in a moment."*

**Problem:** D-10 locks specific copy. The plan's copy is longer, references "24 hours" explicitly (useful for debugging, confusing at UAT), and drops the "ask staff" fallback.

**Fix:** Change the thrown message in 04-02 T1 (line 203) to match D-10 verbatim. Since the `24h` expiry case is a SUBSET of D-10's general "can't reach the guest list" condition, the user's chosen copy should win. Update the corresponding vitest assertion in 04-02 T2 (line 337) from `/24 hours/` to `/Ask staff/` or `/directions/`.

### W-4 — Plan 04-05 must_haves cites "D-09" for manifest name and "D-11" for theme color

**Where:** `04-05-PLAN.md` lines 24–26:
```yaml
- "VitePWA manifest.name is exactly 'Seat Finder — Mahek & Saumya' (D-09)"
- "VitePWA manifest.short_name is exactly 'Seat Finder' (D-09)"
- "VitePWA manifest.theme_color and background_color are both '#2b2d42' (D-11)"
```

**Real CONTEXT mappings:**
- App name / short_name → **D-13**
- Theme color + background color → **D-14**

CONTEXT D-09 is the offline badge; D-11 is "no proactive install prompt." Citing them for the manifest misroutes any future audit.

**Fix:** Correct the D-XX numbers in 04-05 must_haves.truths to D-13 and D-14, and fix the narrative on line 85–86 (Objective/Purpose paragraph) which lists "D-09 through D-16 (manifest branding + Apple meta tags)" — this spans three topics and the range is wrong. It should read "D-12 through D-16 (Apple meta + manifest branding + no splash PNGs)".

### W-5 — RESEARCH.md Open Questions not marked RESOLVED

**Where:** 04-RESEARCH.md line 1202.

**Problem:** Dimension 11 of the plan-checker contract says the heading must be `## Open Questions (RESOLVED)` or each question must include an inline `RESOLVED:` marker. The current format uses `Recommendation:` which is effectively a resolution but does not match the literal contract.

**Fix:** Either rename the heading to `## Open Questions (RESOLVED)` and prepend `RESOLVED:` to each Recommendation line, OR (preferred — it's already informal) accept this as a style gap and note that the recommendations ARE the resolutions. If the user wants strict compliance, this is a one-line edit.

---

## Info (nice-to-have)

### I-1 — RESEARCH.md silently re-numbered D-13..D-19

**Where:** 04-RESEARCH.md lines 31–37 introduce a parallel (and CONFLICTING) decision table that doesn't match CONTEXT.md:

| RESEARCH line | RESEARCH label | CONTEXT actual |
|---------------|----------------|----------------|
| Line 31 "D-13" | VITE_SHEET_URL env var | App name |
| Line 32 "D-14" | .env.example | Theme/background colors |
| Line 33 "D-15" | No floor-plan precache | Icon pipeline |
| Line 34 "D-16" | No per-device splash | Splash (matches) |
| Line 35 "D-17" | Dev mode devOptions | VITE_SHEET_URL env var |
| Line 36 "D-18" | Versioning via Workbox hashes | Fail build if missing |
| Line 37 "D-19" | Test coverage | No runtime override |

This is the root cause of W-4 and likely B-1 (plan author was reading RESEARCH.md's table, not CONTEXT.md, when picking `background_color`).

**Fix:** Ideally the researcher re-aligns RESEARCH.md's D-XX numbers with CONTEXT.md and then the plans are re-checked. At minimum, RESEARCH.md should prefix its parallel table with a note: "NOTE: This section's D-XX numbering does NOT match CONTEXT.md. See CONTEXT.md for the canonical decision list." But the cleanest fix is to delete RESEARCH.md's parallel D-XX table and reference CONTEXT.md directly.

### I-2 — Plan 04-01 `.env.local` creation is borderline scope-creep for a PERF-04-focused plan

**Where:** 04-01 T1 creates `.env.local` with the existing hard-coded URL copied in.

**Note:** This is defensible — without `.env.local` at the moment of refactor, `npm run dev` and `npm test` would start failing on the SAME commit that introduces the env var. Creating the local file keeps dev/test unbroken. But it does mean a developer's working tree has an untracked file that must not be committed. 04-01 T1 acceptance correctly checks `git check-ignore .env.local`; this is adequate.

### I-3 — Plan 04-06 verify-pwa-build.mjs regex for `workbox-*.js` is stricter than needed

**Where:** 04-06 T1 line 130: `/^workbox-[a-f0-9]+\.js$/`

**Note:** Workbox revisions on some configurations use hex with varying lengths, but some Workbox versions append `.js.map` or use longer hashes. The regex is fine for the current plugin version, but if Workbox version bumps produce a differently-named runtime file the smoke test will incorrectly fail. Not a blocker — the pattern matches standard vite-plugin-pwa 1.x output — but worth a comment pointing a future maintainer at the regex.

---

## Wave execution order (verified)

```
Wave 1:  04-01 (PERF-04 env plumbing)
Wave 2:  04-02 (PERF-01 cache)  ||  04-03 (PERF-02 icons)      [parallel, disjoint files]
Wave 3:  04-04 (PERF-01 UX — badge + hooks)
Wave 4:  04-05 (PERF-02 + PERF-03 — VitePWA + UpdateToast + manifest)
Wave 5:  04-06 (PERF-01..04 docs, build smoke, UAT checkpoint)
```

This ordering respects: (a) 04-05 cannot configure `manifest.icons` until 04-03 emits the PNGs; (b) 04-05 cannot guard against a missing env var until 04-01's plumbing is in; (c) 04-04 needs 04-02's `fetchedAt` state shape; (d) 04-06's `verify-pwa-build.mjs` needs 04-05's VitePWA-produced artifacts. All verified.

---

## Recommendation

Return plans to planner with:
1. **B-1** — fix `background_color: '#edf2f4'` in 04-05 and its must_haves truths.
2. **B-2** — retype `configResolved(config: ResolvedConfig)` with explicit `Plugin` / `ResolvedConfig` imports in 04-01 Task 3.
3. **W-1..W-5** — the five warnings above; most are one-line edits to must_haves or error copy.
4. Optional but strongly recommended: **I-1** — fix the D-XX renumbering in RESEARCH.md so future phases don't inherit the confusion.

After fixes land, re-run `/gsd-plan-check 04`. The changes are small enough that a second pass should land on PASS. If the planner pushes back on any of the warnings (especially W-2 and W-3 which involve copy/UX decisions), escalate to the developer with the exact CONTEXT lines so the final call is explicit.

