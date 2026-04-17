import type { Guest } from '../types';
import { parseGuestsCsv } from './googleSheets';

// PERF-01: localStorage network-first SWR wrapper.
// - Cache key is versioned so a breaking-schema change just bumps the suffix
//   (D-02). Old entries under v1 are ignored, not migrated.
// - Network timeout is 2s (D-01/D-02) to keep the guest-find-under-10s flow
//   snappy even on flaky cellular: after 2s we give up on the network and fall
//   back to the cache if fresh.
// - Hard expiry is 24h (D-03). Beyond that, if the network is also down, we
//   surface the D-10 error copy so the guest knows to ask staff.
export const CACHE_KEY = 'seatfinder.guests.v1';
const NETWORK_TIMEOUT_MS = 2000;
const HARD_EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface CachedGuests {
  fetchedAt: string;
  guests: Guest[];
}

interface CacheReadResult {
  data: CachedGuests | null;
  ageMs: number | null;
  expired: boolean;
}

function readCache(): CacheReadResult {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { data: null, ageMs: null, expired: false };
    const parsed = JSON.parse(raw) as unknown;
    // Schema guard: treat any shape drift as a cache-miss (silent, per plan).
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('fetchedAt' in parsed) ||
      !('guests' in parsed) ||
      typeof (parsed as CachedGuests).fetchedAt !== 'string' ||
      !Array.isArray((parsed as CachedGuests).guests)
    ) {
      return { data: null, ageMs: null, expired: false };
    }
    const data = parsed as CachedGuests;
    const ageMs = Date.now() - new Date(data.fetchedAt).getTime();
    const expired = ageMs > HARD_EXPIRY_MS || Number.isNaN(ageMs);
    return { data, ageMs, expired };
  } catch {
    // JSON.parse failure OR unexpected localStorage throw -> cache-miss.
    return { data: null, ageMs: null, expired: false };
  }
}

function writeCache(guests: Guest[]): CachedGuests {
  const entry: CachedGuests = { fetchedAt: new Date().toISOString(), guests };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch (err) {
    // QuotaExceededError (iOS private mode, disk full, etc.) is swallowed so
    // a write failure never blocks returning fresh data to the caller.
    // Only log the error object — never the payload (guest PII).
    console.warn('[guestsCache] write failed', err);
  }
  return entry;
}

async function fetchCsvWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Network-first fetch with localStorage fallback.
 *
 * Decision tree (RESEARCH.md §4):
 *   1. Try network (2s timeout)
 *      -> success: write cache, return fresh
 *      -> failure and cache is fresh (<=24h): return cache
 *      -> failure and cache is stale (>24h): throw D-10 error ("24 hours")
 *      -> failure and no cache: throw "connection" error
 */
export async function fetchGuestsCached(url: string): Promise<CachedGuests> {
  const cache = readCache();
  try {
    const csv = await fetchCsvWithTimeout(url, NETWORK_TIMEOUT_MS);
    const guests = parseGuestsCsv(csv);
    return writeCache(guests);
  } catch (networkErr) {
    if (cache.data && !cache.expired) {
      return cache.data;
    }
    if (cache.data && cache.expired) {
      throw new Error(
        "Can't reach the guest list. Ask staff for directions or try again in a moment."
      );
    }
    const detail = networkErr instanceof Error ? ` (${networkErr.message})` : '';
    throw new Error(
      `Unable to load guest list. Please check your connection and try again.${detail}`
    );
  }
}

/**
 * Read-only metadata accessor for plan 04-04's StalenessBadge.
 * Returns fetchedAt (ISO8601 string or null) + ageMs (null if no cache).
 */
export function readCachedMetadata(): { fetchedAt: string | null; ageMs: number | null } {
  const { data, ageMs } = readCache();
  return { fetchedAt: data?.fetchedAt ?? null, ageMs };
}
