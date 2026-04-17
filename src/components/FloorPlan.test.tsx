import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

// Mock react-zoom-pan-pinch just like MapView.test.tsx. useTransformComponent
// must invoke its render callback synchronously so FloorPlan actually emits
// DOM we can assert against. The mocked state.scale is controllable per test
// via module-level `mockScale` so Test 4 can flip it for the labels-visible
// assertion.
let mockScale = 1;

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
    ) => fn({ state: { scale: mockScale } }),
  };
});

import FloorPlan, {
  warnDuplicatePositions,
  type FloorPlanConfig,
} from './FloorPlan';

// Callback ref that ignores the node. Used by both paths since the tests
// don't need to read the pin DOM node from a ref — they query it via class.
const noopRef: React.RefCallback<HTMLDivElement> = () => {};

afterEach(() => {
  cleanup();
  mockScale = 1;
  vi.restoreAllMocks();
});

describe('<FloorPlan /> — guest path (default config, <picture> preserved)', () => {
  it('renders the <picture> element with 2 sources + fallback <img> and AVIF/WebP/PNG srcsets', () => {
    const { container } = render(
      <FloorPlan
        tableNumber="7"
        assignedPinRef={noopRef}
        onImageLoad={() => {}}
      />,
    );

    const picture = container.querySelector('picture');
    expect(picture).not.toBeNull();

    const sources = picture!.querySelectorAll('source');
    expect(sources.length).toBe(2);
    expect(sources[0].getAttribute('type')).toBe('image/avif');
    expect(sources[1].getAttribute('type')).toBe('image/webp');

    const img = picture!.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src') ?? '').toMatch(/\.png$/);
    expect(img!.getAttribute('srcset') ?? '').toContain('.png');
    expect(img!.getAttribute('alt')).toBe('Reception floor plan');

    expect(sources[0].getAttribute('srcset')).toContain('900w');
    expect(sources[0].getAttribute('srcset')).toContain('1600w');
    expect(sources[0].getAttribute('srcset')).toContain('2400w');
  });

  it('assigned-pin style matches floorPlan.json:7 coordinates exactly (23.09% / 57.97%) — byte-identical regression guard', () => {
    const { container } = render(
      <FloorPlan
        tableNumber="7"
        assignedPinRef={noopRef}
        onImageLoad={() => {}}
      />,
    );

    const pin = container.querySelector<HTMLDivElement>(
      '.pin-assigned[data-table-id="7"]',
    );
    expect(pin).not.toBeNull();

    // floorPlan.json table 7: { x: 0.2309, y: 0.5797 } → 23.09% / 57.97%.
    // The component computes `${pos.x * 100}%` so the literal string must
    // agree with the JSON to full precision.
    expect(pin!.style.left).toBe('23.09%');
    expect(pin!.style.top).toBe('57.97%');

    // Only ONE pin renders (the assigned one) — all other 53 tables are
    // suppressed per Phase 3 decision.
    const allPins = container.querySelectorAll('.pin-assigned');
    expect(allPins.length).toBe(1);
  });

  it('fires onImageLoad when the fallback <img> completes loading', () => {
    const onImageLoad = vi.fn();
    const { container } = render(
      <FloorPlan
        tableNumber="7"
        assignedPinRef={noopRef}
        onImageLoad={onImageLoad}
      />,
    );
    const img = container.querySelector<HTMLImageElement>('picture img');
    expect(img).not.toBeNull();
    // jsdom does not decode images; dispatch the load event manually to hit
    // the onLoad prop wired to FloorPlan's onImageLoad callback.
    img!.dispatchEvent(new Event('load'));
    expect(onImageLoad).toHaveBeenCalled();
  });
});

describe('<FloorPlan /> — setup path (synthetic config + imageSrc)', () => {
  it('renders a plain <img> with src=imageSrc and NO <picture> element', () => {
    const syntheticConfig: FloorPlanConfig = {
      imageFileName: 'preview.png',
      tablePositions: { '99': { x: 0.5, y: 0.5 } },
    };

    const { container } = render(
      <FloorPlan
        tableNumber="99"
        assignedPinRef={noopRef}
        onImageLoad={() => {}}
        config={syntheticConfig}
        imageSrc="blob:fake-url"
      />,
    );

    // <picture> must not appear — the setup branch renders a bare <img>.
    expect(container.querySelector('picture')).toBeNull();

    const img = container.querySelector<HTMLImageElement>(
      'img.floor-plan-image',
    );
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('blob:fake-url');
    expect(img!.className).toContain('floor-plan-image');
    // The setup branch intentionally omits srcset (the admin's source image
    // is the ground truth for the preview; no AVIF/WebP fallbacks).
    expect(img!.hasAttribute('srcset')).toBe(false);
  });

  it('renders the pin at the synthetic config coordinates (50% / 50%)', () => {
    const syntheticConfig: FloorPlanConfig = {
      imageFileName: 'preview.png',
      tablePositions: { '99': { x: 0.5, y: 0.5 } },
    };

    const { container } = render(
      <FloorPlan
        tableNumber="99"
        assignedPinRef={noopRef}
        onImageLoad={() => {}}
        config={syntheticConfig}
        imageSrc="blob:fake-url"
      />,
    );

    const pin = container.querySelector<HTMLDivElement>(
      '.pin-assigned[data-table-id="99"]',
    );
    expect(pin).not.toBeNull();
    expect(pin!.style.left).toBe('50%');
    expect(pin!.style.top).toBe('50%');
  });

  it('does not render a pin when tableNumber is empty string (live-preview default)', () => {
    const syntheticConfig: FloorPlanConfig = {
      imageFileName: 'preview.png',
      tablePositions: {
        '1': { x: 0.25, y: 0.25 },
        '2': { x: 0.75, y: 0.75 },
      },
    };

    const { container } = render(
      <FloorPlan
        tableNumber=""
        assignedPinRef={noopRef}
        onImageLoad={() => {}}
        config={syntheticConfig}
        imageSrc="blob:fake-url"
      />,
    );
    expect(container.querySelectorAll('.pin-assigned').length).toBe(0);
  });
});

describe('warnDuplicatePositions() — duplicate detection (DEV warning source)', () => {
  it('returns one warning per duplicate (x,y) coordinate pair', () => {
    const dupConfig: FloorPlanConfig = {
      imageFileName: 'dup.png',
      tablePositions: {
        '1': { x: 0.3, y: 0.3 },
        '2': { x: 0.3, y: 0.3 }, // exact duplicate of 1
        '3': { x: 0.6, y: 0.6 },
      },
    };
    const warnings = warnDuplicatePositions(dupConfig);
    expect(warnings.length).toBe(1);
    // Order: the second occurrence references the first by ID in the message.
    expect(warnings[0]).toMatch(
      /Duplicate table position.*2.*1|Duplicate table position.*1.*2/,
    );
    expect(warnings[0]).toContain('0.3000,0.3000');
  });

  it('returns an empty array for a config with all unique coordinates', () => {
    const cleanConfig: FloorPlanConfig = {
      imageFileName: 'clean.png',
      tablePositions: {
        '1': { x: 0.1, y: 0.1 },
        '2': { x: 0.2, y: 0.2 },
        '3': { x: 0.3, y: 0.3 },
      },
    };
    expect(warnDuplicatePositions(cleanConfig)).toEqual([]);
  });

  it('treats coordinates that round to the same 4dp key as duplicates', () => {
    const nearDupConfig: FloorPlanConfig = {
      imageFileName: 'near.png',
      tablePositions: {
        'a': { x: 0.12345, y: 0.67890 }, // rounds to 0.1235, 0.6789
        'b': { x: 0.12346, y: 0.67889 }, // rounds to 0.1235, 0.6789 (same key)
      },
    };
    expect(warnDuplicatePositions(nearDupConfig).length).toBe(1);
  });
});

describe('<FloorPlan /> — adaptive labels (useTransformComponent scale gate)', () => {
  it('adds the labels-visible class when the transform scale reaches 1.8', () => {
    mockScale = 1.0;
    const { container, rerender } = render(
      <FloorPlan
        tableNumber="7"
        assignedPinRef={noopRef}
        onImageLoad={() => {}}
      />,
    );
    let wrapper = container.querySelector('.floor-plan-wrapper')!;
    expect(wrapper.className).not.toContain('labels-visible');

    mockScale = 2.0;
    rerender(
      <FloorPlan
        tableNumber="7"
        assignedPinRef={noopRef}
        onImageLoad={() => {}}
      />,
    );
    wrapper = container.querySelector('.floor-plan-wrapper')!;
    expect(wrapper.className).toContain('labels-visible');
  });
});
