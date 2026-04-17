import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

// Mock the guest-list fetch so App mounts without hitting Google Sheets
vi.mock('./services/googleSheets', () => ({
  fetchGuests: vi.fn().mockResolvedValue([]),
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
