import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

// Mock the guest-list fetch so App mounts without hitting Google Sheets.
// After plan 04-02, App imports `fetchGuestsCached` from ./services/guestsCache
// (not `fetchGuests` directly) — mock that module too. Keep the
// ./services/googleSheets mock in place so any transitive import (e.g. the
// SHEET_URL named export) resolves under a deterministic sentinel URL.
const fetchGuestsCachedMock = vi.fn();

vi.mock('./services/guestsCache', () => ({
  fetchGuestsCached: (...args: unknown[]) => fetchGuestsCachedMock(...args),
}));

vi.mock('./services/googleSheets', () => ({
  SHEET_URL: 'https://example.test/csv',
  fetchGuests: vi.fn().mockResolvedValue([]),
  parseGuestsCsv: vi.fn(),
}));

// Mock react-zoom-pan-pinch. App only renders MapView when a guest is selected,
// but mock here for safety so any accidental MapView mount does not explode on
// the missing library internals.
vi.mock('react-zoom-pan-pinch', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    TransformWrapper: ReactActual.forwardRef<unknown, { children: React.ReactNode }>(
      function TransformWrapperMock({ children }, ref) {
        ReactActual.useImperativeHandle(ref, () => ({ zoomToElement: vi.fn() }));
        return ReactActual.createElement('div', null, children);
      },
    ),
    TransformComponent: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement('div', null, children),
    useTransformComponent: (
      fn: (args: { state: { scale: number } }) => React.ReactNode,
    ) => fn({ state: { scale: 1 } }),
  };
});

import App from './App';

describe('App', () => {
  beforeEach(() => {
    // Default: resolve with an empty-but-valid cache payload so App exits the
    // loading branch. Individual tests below override this for error paths.
    fetchGuestsCachedMock.mockReset();
    fetchGuestsCachedMock.mockResolvedValue({
      fetchedAt: '2026-04-17T10:00:00.000Z',
      guests: [],
    });
  });

  afterEach(() => {
    // React-Testing-Library auto-cleanup runs App's useEffect cleanups, which
    // remove the injected preload link. We call cleanup() explicitly here to
    // guarantee that happens between tests — avoids stale links bleeding over.
    cleanup();
  });

  it('preload link injected on mount', async () => {
    render(<App />);

    const preload = await waitFor(() => {
      // Query by rel + type only — jsdom 26 does not reflect the `as` DOM
      // property to an HTML attribute on HTMLLinkElement, so the attribute
      // selector [as="image"] never matches even when link.as === 'image'.
      // We assert the `as` property below against the DOM object directly.
      const link = document.head.querySelector<HTMLLinkElement>(
        'link[rel="preload"][type="image/avif"]',
      );
      if (!link) throw new Error('preload link not found');
      return link;
    });

    expect(preload.rel).toBe('preload');
    expect(preload.as).toBe('image');
    expect(preload.type).toBe('image/avif');

    const srcset = preload.getAttribute('imagesrcset') ?? '';
    expect(srcset).toContain('/floor-plan/floor-plan-900.avif 900w');
    expect(srcset).toContain('/floor-plan/floor-plan-1600.avif 1600w');
    expect(srcset).toContain('/floor-plan/floor-plan-2400.avif 2400w');

    expect(preload.getAttribute('imagesizes')).toBe('100vw');
    // fetchPriority DOM property — widely supported in jsdom 25+
    expect(
      (preload as HTMLLinkElement & { fetchPriority?: string }).fetchPriority,
    ).toBe('high');
  });
});

describe('<App /> cache integration', () => {
  beforeEach(() => {
    fetchGuestsCachedMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders guests from the cache wrapper on mount', async () => {
    fetchGuestsCachedMock.mockResolvedValue({
      fetchedAt: '2026-04-17T11:00:00.000Z',
      guests: [
        {
          tableNumber: '1',
          firstName: 'Alice',
          lastName: 'Smith',
          contactInfo: '',
          description: '',
        },
        {
          tableNumber: '2',
          firstName: 'Bob',
          lastName: 'Jones',
          contactInfo: '',
          description: '',
        },
      ],
    });
    render(<App />);
    // Wait for the loading branch to unmount.
    await waitFor(() => {
      expect(screen.queryByText(/Loading guest list/)).toBeNull();
    });
    expect(screen.getByText(/Welcome!/)).toBeInTheDocument();
    // fetchedAt state is now consumed by <StalenessBadge /> (plan 04-04). The
    // badge renders silently when online + cache <1h, so we assert the happy
    // path by confirming the cache wrapper was invoked with SHEET_URL and
    // that the data-fetched-at shim is gone.
    expect(fetchGuestsCachedMock).toHaveBeenCalledWith('https://example.test/csv');
    expect(document.querySelector('.card')?.hasAttribute('data-fetched-at')).toBe(
      false,
    );
  });

  it('surfaces cache-wrapper error messages in the error card', async () => {
    // D-10 copy — the exact string the cache wrapper throws when the cache is
    // >24h stale AND the network is down. App renders it verbatim in the
    // error card next to the Retry button.
    fetchGuestsCachedMock.mockRejectedValue(
      new Error(
        "Can't reach the guest list. Ask staff for directions or try again in a moment.",
      ),
    );
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByText(/Ask staff for directions or try again in a moment/),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });
});
