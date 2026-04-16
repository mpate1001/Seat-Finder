import Fuse, { type IFuseOptions, type FuseResult } from 'fuse.js';
import type { Guest } from '../types';

export interface MatchRange {
  key: 'firstName' | 'lastName';
  indices: ReadonlyArray<readonly [number, number]>;
}

export interface RankedGuest {
  guest: Guest;
  matches: MatchRange[];
}

const fuseOptions: IFuseOptions<Guest> = {
  keys: [
    { name: 'firstName', weight: 1 },
    { name: 'lastName', weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeMatches: true,
  includeScore: true,
  shouldSort: true,
};

export function buildGuestIndex(guests: Guest[]): Fuse<Guest> {
  return new Fuse(guests, fuseOptions);
}

export function searchGuests(
  rawQuery: string,
  guests: Guest[],
  fuse: Fuse<Guest>
): RankedGuest[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const seen = new Set<Guest>();
  const tierPrefix: RankedGuest[] = [];
  const tierContains: RankedGuest[] = [];

  for (const guest of guests) {
    const fnLower = guest.firstName.toLowerCase();
    const lnLower = guest.lastName.toLowerCase();

    const fnPrefix = fnLower.startsWith(query);
    const lnPrefix = lnLower.startsWith(query);
    const fnContains = !fnPrefix && fnLower.includes(query);
    const lnContains = !lnPrefix && lnLower.includes(query);

    if (fnPrefix || lnPrefix) {
      const matches: MatchRange[] = [];
      if (fnLower.includes(query)) {
        const start = fnLower.indexOf(query);
        matches.push({ key: 'firstName', indices: [[start, start + query.length - 1]] });
      }
      if (lnLower.includes(query)) {
        const start = lnLower.indexOf(query);
        matches.push({ key: 'lastName', indices: [[start, start + query.length - 1]] });
      }
      tierPrefix.push({ guest, matches });
      seen.add(guest);
    } else if (fnContains || lnContains) {
      const matches: MatchRange[] = [];
      if (fnContains) {
        const start = fnLower.indexOf(query);
        matches.push({ key: 'firstName', indices: [[start, start + query.length - 1]] });
      }
      if (lnContains) {
        const start = lnLower.indexOf(query);
        matches.push({ key: 'lastName', indices: [[start, start + query.length - 1]] });
      }
      tierContains.push({ guest, matches });
      seen.add(guest);
    }
  }

  const fuseResults: FuseResult<Guest>[] = fuse.search(query);
  const tierFuzzy: RankedGuest[] = [];
  for (const r of fuseResults) {
    if (seen.has(r.item)) continue;
    const matches: MatchRange[] = [];
    if (r.matches) {
      for (const m of r.matches) {
        if (m.key === 'firstName' || m.key === 'lastName') {
          matches.push({
            key: m.key,
            indices: m.indices as ReadonlyArray<readonly [number, number]>,
          });
        }
      }
    }
    tierFuzzy.push({ guest: r.item, matches });
  }

  return [...tierPrefix, ...tierContains, ...tierFuzzy].slice(0, 10);
}
