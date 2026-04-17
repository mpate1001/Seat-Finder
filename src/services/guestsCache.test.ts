import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchGuestsCached, CACHE_KEY } from './guestsCache';

// Matches the Sheets CSV header per googleSheets.ts HEADER_MAP (case-insensitive).
const HEADER = 'Table Number,First Name,Last Name,Contact Info,Guest Description';
const SAMPLE_CSV = `${HEADER}\n1,Alice,Smith,alice@x.com,\n`;

function writeCacheFixture(fetchedAt: Date, guests: unknown[]) {
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ fetchedAt: fetchedAt.toISOString(), guests }),
  );
}

describe('fetchGuestsCached', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('writes cache on successful fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(SAMPLE_CSV),
      }),
    );
    const result = await fetchGuestsCached('http://example/csv');
    expect(result.guests).toHaveLength(1);
    expect(result.guests[0].firstName).toBe('Alice');
    expect(localStorage.getItem(CACHE_KEY)).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY)!);
    expect(stored.fetchedAt).toBe(result.fetchedAt);
  });

  it('falls back to cache on network error', async () => {
    writeCacheFixture(new Date(), [
      {
        tableNumber: '1',
        firstName: 'Cached',
        lastName: 'Guest',
        contactInfo: '',
        description: '',
      },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const result = await fetchGuestsCached('http://example/csv');
    expect(result.guests[0].firstName).toBe('Cached');
  });

  it('aborts after 2s timeout and falls back to cache', async () => {
    vi.useFakeTimers();
    writeCacheFixture(new Date(), [
      {
        tableNumber: '1',
        firstName: 'FromCache',
        lastName: '',
        contactInfo: '',
        description: '',
      },
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            (init?.signal as AbortSignal).addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      ),
    );
    const p = fetchGuestsCached('http://example/csv');
    // advanceTimersByTimeAsync (not the sync variant) drains the microtask
    // queue so the abort signal actually fires before we await the promise.
    await vi.advanceTimersByTimeAsync(2001);
    const result = await p;
    expect(result.guests[0].firstName).toBe('FromCache');
  });

  it('throws D-10 error when cache is >24h old and network fails', async () => {
    // D-10: stale-and-offline surfaces the "ask staff" copy on the error card.
    // The plan's "24 hours" grep was a RESEARCH-era heuristic; the canonical
    // error string (per CONTEXT.md D-10 + execute-phase success criteria) is
    // the D-10 copy below. The HARD_EXPIRY_MS constant enforces the 24h
    // behavior independently of the user-facing string.
    writeCacheFixture(new Date(Date.now() - 25 * 60 * 60 * 1000), []);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchGuestsCached('http://example/csv')).rejects.toThrow(
      /Can't reach the guest list\. Ask staff for directions/,
    );
  });

  it('treats corrupt cache (invalid JSON) as miss', async () => {
    localStorage.setItem(CACHE_KEY, 'not-json{{{');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchGuestsCached('http://example/csv')).rejects.toThrow(
      /check your connection/,
    );
  });

  it('swallows QuotaExceededError on write and still returns fresh data', async () => {
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === CACHE_KEY) {
          const e = new Error('QuotaExceededError');
          e.name = 'QuotaExceededError';
          throw e;
        }
        return originalSetItem.call(this, key, value);
      });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(SAMPLE_CSV),
      }),
    );
    const result = await fetchGuestsCached('http://example/csv');
    expect(result.guests).toHaveLength(1);
    expect(setItemSpy).toHaveBeenCalledWith(CACHE_KEY, expect.any(String));
  });
});
