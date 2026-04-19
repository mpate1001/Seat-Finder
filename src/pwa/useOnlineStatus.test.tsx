import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { StrictMode } from 'react';
import { useOnlineStatus } from './useOnlineStatus';

describe('useOnlineStatus', () => {
  // Preserve the original so we can restore between tests.
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    window.navigator,
    'onLine',
  );

  function setOnline(value: boolean) {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => value,
    });
  }

  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    cleanup();
    if (originalDescriptor) {
      Object.defineProperty(window.navigator, 'onLine', originalDescriptor);
    }
  });

  it('seeds state from navigator.onLine at mount', () => {
    setOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('flips to false when the window fires an "offline" event', () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
  });

  it('flips back to true when the window fires an "online" event', () => {
    setOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('removes both listeners on unmount (StrictMode-safe cleanup)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    // StrictMode double-mounts. If cleanup is broken, the second mount leaves
    // a duplicate listener behind after unmount.
    const { unmount } = renderHook(() => useOnlineStatus(), {
      wrapper: StrictMode,
    });

    const addedOnline = addSpy.mock.calls.filter(c => c[0] === 'online').length;
    const addedOffline = addSpy.mock.calls.filter(c => c[0] === 'offline').length;

    unmount();

    const removedOnline = removeSpy.mock.calls.filter(
      c => c[0] === 'online',
    ).length;
    const removedOffline = removeSpy.mock.calls.filter(
      c => c[0] === 'offline',
    ).length;

    // Every add must be matched by a remove.
    expect(removedOnline).toBe(addedOnline);
    expect(removedOffline).toBe(addedOffline);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
