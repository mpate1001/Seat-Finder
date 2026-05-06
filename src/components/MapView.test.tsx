import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React, { StrictMode } from 'react';
import type { Guest } from '../types';

// Mock react-zoom-pan-pinch — MapView no longer drives the wrapper imperatively
// (the auto-zoom-on-select effect was removed; guests now see the full layout
// with their pin pulsing). Stub the wrapper as a passthrough.
vi.mock('react-zoom-pan-pinch', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    TransformWrapper: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(
        'div',
        { 'data-testid': 'transform-wrapper' },
        children,
      ),
    TransformComponent: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(
        'div',
        { 'data-testid': 'transform-content' },
        children,
      ),
    useTransformComponent: (
      fn: (args: { state: { scale: number } }) => React.ReactNode,
    ) => fn({ state: { scale: 1 } }),
  };
});

import MapView from './MapView';

function guestFixture(overrides: Partial<Guest> = {}): Guest {
  return {
    firstName: 'Test',
    lastName: 'Guest',
    tableNumber: '12',
    contactInfo: '',
    description: '',
    ...overrides,
  };
}

describe('MapView', () => {
  beforeEach(() => {
    // Reset history state between tests — MapView's popstate cleanup calls
    // history.back() which leaves stale entries otherwise.
    history.replaceState(null, '');
  });

  afterEach(() => {
    cleanup();
  });

  it('missing tableNumber shows fallback error card instead of the floor plan', () => {
    render(
      <MapView
        guest={guestFixture({ tableNumber: '9999' })}
        onClose={vi.fn()}
      />,
    );

    // The floor plan <img> must NOT render at all in the error path — we
    // suppress the broken UI to avoid a half-loaded surface.
    expect(
      document.body.querySelector('img[alt="Reception floor plan"]'),
    ).toBeNull();

    // Error card replaces the floor plan, with a clear next-action message
    // for the guest. role="alert" announces it to assistive tech.
    expect(
      screen.getByText(/please ask staff for directions/i),
    ).toBeInTheDocument();
    const errorCard = document.body.querySelector('.map-overlay-error-card');
    expect(errorCard).not.toBeNull();
    expect(errorCard!.getAttribute('role')).toBe('alert');
  });

  it('picture element has avif + webp + png sources', () => {
    render(
      <MapView guest={guestFixture({ tableNumber: '12' })} onClose={vi.fn()} />,
    );

    const picture = document.body.querySelector('picture');
    expect(picture).not.toBeNull();

    const avifSource = picture!.querySelector('source[type="image/avif"]');
    const webpSource = picture!.querySelector('source[type="image/webp"]');
    const img = picture!.querySelector('img');

    expect(avifSource).not.toBeNull();
    expect(webpSource).not.toBeNull();
    expect(img).not.toBeNull();

    expect(avifSource!.getAttribute('srcset')).toContain('900w');
    expect(avifSource!.getAttribute('srcset')).toContain('1600w');
    expect(avifSource!.getAttribute('srcset')).toContain('2400w');
    expect(webpSource!.getAttribute('srcset')).toMatch(/\.webp/);
    expect(img!.getAttribute('src') ?? '').toMatch(/\.png$/);
    expect(img!.getAttribute('srcset') ?? '').toContain('.png');
  });

  // Regression: bug 1 from UAT — MapView was rendered inside App's `.card`
  // div, which has `backdrop-filter: blur(10px)`. That promotes `.card` to the
  // containing block for position:fixed descendants, so `.map-overlay`'s
  // `inset:0` sized to the card instead of the viewport. Fix: createPortal to
  // document.body.
  it('portals overlay to document.body (not render container)', () => {
    const { container } = render(
      <MapView guest={guestFixture({ tableNumber: '12' })} onClose={vi.fn()} />,
    );
    // The testing-library render container should NOT contain the overlay.
    expect(container.querySelector('.map-overlay')).toBeNull();
    // The overlay must be a direct child of document.body.
    const overlay = document.body.querySelector('.map-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay!.parentElement).toBe(document.body);
  });

  // Regression: bug 2 from UAT — the history pushState/back() effect was not
  // StrictMode-safe. In React 18 dev, StrictMode double-invokes effects
  // (mount → cleanup → mount). The first cleanup called history.back() whose
  // async popstate then fired against the second mount's listener, invoking
  // onClose immediately and dismissing the map. Fix: ref-guarded push + a
  // microtask-deferred pop that aborts if the effect re-runs before the tick.
  it('does not call onClose under StrictMode double-mount', async () => {
    const onClose = vi.fn();
    vi.useRealTimers(); // queueMicrotask needs real timing
    render(
      <StrictMode>
        <MapView guest={guestFixture({ tableNumber: '12' })} onClose={onClose} />
      </StrictMode>,
    );
    // Flush any pending microtasks / popstate events
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(onClose).not.toHaveBeenCalled();
    // Map overlay is still mounted
    expect(document.body.querySelector('.map-overlay')).not.toBeNull();
  });
});
