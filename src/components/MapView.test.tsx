import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import React, { StrictMode } from 'react';
import type { Guest } from '../types';

// Mock react-zoom-pan-pinch — we only care about the interface MapView calls.
// The spy is module-scoped so tests can assert the exact argument tuple that
// MapView forwards from `zoomToElement(assignedPinRef.current, scale, ms, ...)`.
const zoomToElement = vi.fn();

vi.mock('react-zoom-pan-pinch', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    TransformWrapper: ReactActual.forwardRef<unknown, { children: React.ReactNode }>(
      function TransformWrapperMock({ children }, ref) {
        ReactActual.useImperativeHandle(ref, () => ({ zoomToElement }));
        return ReactActual.createElement(
          'div',
          { 'data-testid': 'transform-wrapper' },
          children,
        );
      },
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

// MapView renders via createPortal(..., document.body), so DOM queries must
// target document.body rather than the render container.
function fireImageLoad() {
  const img = document.body.querySelector('img[alt="Reception floor plan"]');
  if (!img) throw new Error('floor plan img not found');
  // jsdom does not decode images; manually dispatch the load event so the
  // onLoad handler in FloorPlan fires and flips MapView's imageLoaded state.
  // Wrap in act() so React commits the state update and the effect subscribes
  // to the setTimeout before we advance fake timers.
  act(() => {
    img.dispatchEvent(new Event('load'));
  });
}

function advanceTimers(ms: number) {
  // Wrap timer advance in act() so any state updates inside the fired effect
  // (e.g. library internal cleanup) flush cleanly before the next assertion.
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('MapView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    zoomToElement.mockClear();
    // Reset history state between tests — MapView's popstate cleanup calls
    // history.back() which leaves stale entries otherwise.
    history.replaceState(null, '');
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('zooms to assigned table', () => {
    render(
      <MapView guest={guestFixture({ tableNumber: '12' })} onClose={vi.fn()} />,
    );
    fireImageLoad();
    advanceTimers(260);

    expect(zoomToElement).toHaveBeenCalledTimes(1);
    const call = zoomToElement.mock.calls[0];
    // Signature: (node, scale, animationTime, animationType, offsetX, offsetY)
    expect(call[0]).toBeInstanceOf(HTMLElement); // assignedPinRef.current
    expect(call[1]).toBe(2.75);
    expect(call[2]).toBe(700);
    expect(call[3]).toBe('easeOutQuart');
    expect(call[4]).toBe(0);
    expect(call[5]).toBe(64);
  });

  it('overview hold before zoom', () => {
    render(
      <MapView guest={guestFixture({ tableNumber: '12' })} onClose={vi.fn()} />,
    );
    fireImageLoad();

    // Before the 250ms hold elapses, zoomToElement should NOT have been called
    expect(zoomToElement).not.toHaveBeenCalled();

    advanceTimers(100);
    expect(zoomToElement).not.toHaveBeenCalled();

    advanceTimers(200); // total 300ms — past the 250ms threshold
    expect(zoomToElement).toHaveBeenCalledTimes(1);
  });

  it('missing tableNumber shows fallback error card instead of the floor plan', () => {
    render(
      <MapView
        guest={guestFixture({ tableNumber: '9999' })}
        onClose={vi.fn()}
      />,
    );

    // The floor plan <img> must NOT render at all in the error path — we
    // suppress the broken zoom UI to avoid a half-loaded surface.
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

    // Even after any pending timers fire, zoom must not be invoked — there
    // is no assignedPinRef target when the table isn't on the plan.
    advanceTimers(500);
    expect(zoomToElement).not.toHaveBeenCalled();
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
