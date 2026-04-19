import { useEffect, useState } from 'react';

/**
 * Returns the age of a cache entry in ms, ticking every 60s.
 * Returns null when fetchedAt is null (cache empty / initial load).
 *
 * Granularity is 1 minute — the UI shows whole-minute values anyway.
 */
export function useCacheAge(fetchedAt: string | null): number | null {
  const [ageMs, setAgeMs] = useState<number | null>(
    fetchedAt ? Date.now() - new Date(fetchedAt).getTime() : null,
  );

  useEffect(() => {
    if (!fetchedAt) {
      setAgeMs(null);
      return;
    }
    const tick = () => setAgeMs(Date.now() - new Date(fetchedAt).getTime());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [fetchedAt]);

  return ageMs;
}
