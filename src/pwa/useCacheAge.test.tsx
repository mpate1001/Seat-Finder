import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCacheAge } from './useCacheAge';

describe('useCacheAge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin "now" to a deterministic instant — all age math references this.
    vi.setSystemTime(new Date('2026-04-17T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('returns null when fetchedAt is null', () => {
    const { result } = renderHook(() => useCacheAge(null));
    expect(result.current).toBeNull();
  });

  it('returns ageMs on mount for a valid fetchedAt', () => {
    // Cache written 30 minutes ago.
    const fetchedAt = '2026-04-17T11:30:00.000Z';
    const { result } = renderHook(() => useCacheAge(fetchedAt));
    expect(result.current).toBe(30 * 60 * 1000);
  });

  it('re-computes age every 60 seconds via setInterval', () => {
    const fetchedAt = '2026-04-17T11:30:00.000Z';
    const { result } = renderHook(() => useCacheAge(fetchedAt));
    expect(result.current).toBe(30 * 60 * 1000);

    // advanceTimersByTime advances the fake clock by 60s AND fires the
    // interval tick at the same instant — tick reads Date.now() at 12:01.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(31 * 60 * 1000);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(32 * 60 * 1000);
  });

  it('clears the interval on unmount (no leaks)', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = renderHook(() =>
      useCacheAge('2026-04-17T11:30:00.000Z'),
    );
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
