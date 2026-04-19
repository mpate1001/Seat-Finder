import Fuse, {
  type IFuseOptions,
  type FuseResult,
  type FuseResultMatch,
} from 'fuse.js';
import type { Guest } from '../types';

/**
 * One contiguous match range inside a guest's first or last name. Indices are
 * inclusive on both ends — `[start, end]` mirrors the shape Fuse returns in
 * `FuseResultMatch.indices`. The HighlightedText component consumes these
 * directly, so any change here ripples through.
 */
export interface MatchRange {
  key: 'firstName' | 'lastName';
  indices: ReadonlyArray<readonly [number, number]>;
}

export interface RankedGuest {
  guest: Guest;
  matches: MatchRange[];
}

/**
 * Fuse configuration tuned for short personal-name queries on a ~200-guest
 * list:
 *   - threshold 0.3: tight enough to keep typo-only matches relevant, loose
 *     enough to catch one or two character errors per word (mobile keyboards).
 *   - ignoreLocation: a substring buried mid-name should match as well as one
 *     at the start; tier classification below restores the prefix-first bias.
 *   - minMatchCharLength: 1 lets a single-character query return prefix-style
 *     matches (was 2 — required a manual prefix tier to fall back to, which
 *     duplicated logic that Fuse already implements).
 *   - includeMatches: required so we can drive HighlightedText off Fuse's
 *     real per-character indices instead of recomputing them via indexOf().
 *   - includeScore: drives the sort tiebreaker.
 */
const fuseOptions: IFuseOptions<Guest> = {
  keys: [
    { name: 'firstName', weight: 1 },
    { name: 'lastName', weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 1,
  includeMatches: true,
  includeScore: true,
  shouldSort: true,
};

export function buildGuestIndex(guests: Guest[]): Fuse<Guest> {
  return new Fuse(guests, fuseOptions);
}

const TIER_PREFIX = 0;
const TIER_CONTAINS = 1;
const TIER_FUZZY = 2;

/**
 * Classify a Fuse hit into one of three tiers based on how the query string
 * relates to the guest's name fields. The tier drives the primary sort order
 * (prefix → contains → fuzzy); Fuse's score breaks ties within a tier.
 *
 * Why classify post-hoc instead of running three separate searches: the prior
 * implementation kept manual prefix and contains tiers AND a Fuse fuzzy tier
 * in parallel, then deduplicated. The fuzzy tier almost never contributed
 * because anything Fuse caught with a literal-substring run had already been
 * picked up by the contains tier — the manual tiers + Fuse were doing the
 * same work twice. Now Fuse runs once and we just label its hits.
 */
function classifyTier(queryLower: string, guest: Guest): number {
  const firstNameLower = guest.firstName.toLowerCase();
  const lastNameLower = guest.lastName.toLowerCase();
  if (
    firstNameLower.startsWith(queryLower) ||
    lastNameLower.startsWith(queryLower)
  ) {
    return TIER_PREFIX;
  }
  if (firstNameLower.includes(queryLower) || lastNameLower.includes(queryLower)) {
    return TIER_CONTAINS;
  }
  return TIER_FUZZY;
}

/**
 * Filter Fuse's per-key match list down to firstName / lastName entries and
 * pass through the indices unchanged. We deliberately do NOT recompute these
 * via indexOf — Fuse already knows the precise character runs that matched
 * (including non-contiguous runs for typo cases like "Smih" → "Smith"), and
 * indexOf would silently lose that fidelity.
 */
function extractMatches(
  matches: readonly FuseResultMatch[] | undefined,
): MatchRange[] {
  if (!matches) return [];
  const out: MatchRange[] = [];
  for (const match of matches) {
    if (match.key === 'firstName' || match.key === 'lastName') {
      out.push({
        key: match.key,
        indices: match.indices as ReadonlyArray<readonly [number, number]>,
      });
    }
  }
  return out;
}

/**
 * Returns up to 10 guests ranked by how closely their first or last name
 * matches the query. A trimmed empty query returns an empty list (matches
 * the dropdown's "no query, no UI" contract).
 *
 * Ranking: prefix matches first, then substring matches, then fuzzy/typo
 * matches, with Fuse's similarity score breaking ties inside each tier.
 */
export function searchGuests(
  rawQuery: string,
  fuse: Fuse<Guest>,
): RankedGuest[] {
  const query = rawQuery.trim();
  if (!query) return [];
  const queryLower = query.toLowerCase();

  const fuseResults: FuseResult<Guest>[] = fuse.search(query);

  const scored = fuseResults.map((result) => ({
    guest: result.item,
    matches: extractMatches(result.matches),
    tier: classifyTier(queryLower, result.item),
    score: result.score ?? 1,
  }));

  // Stable-ish sort by tier first, then by Fuse score (lower is better).
  scored.sort((a, b) => a.tier - b.tier || a.score - b.score);

  return scored.slice(0, 10).map((s) => ({
    guest: s.guest,
    matches: s.matches,
  }));
}
