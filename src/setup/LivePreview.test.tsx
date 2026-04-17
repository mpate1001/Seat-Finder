/**
 * Tests for src/setup/LivePreview.tsx — buildSyntheticConfig + render.
 *
 * LivePreview wraps the REAL `<FloorPlan/>` component. These specs assert:
 *  - buildSyntheticConfig shape correctness (tableNumber null → skipped).
 *  - LivePreview renders the FloorPlan markup (floor-plan-wrapper present).
 *  - focusedTableNumber propagates → the matching pin-assigned overlay is
 *    rendered inside the preview.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import LivePreview, { buildSyntheticConfig } from './LivePreview';
import type { DraftPin } from './types';

function pin(overrides: Partial<DraftPin> = {}): DraftPin {
  return {
    id: overrides.id ?? 'pin-x',
    x: overrides.x ?? 0.5,
    y: overrides.y ?? 0.5,
    detectedRadius: 0.02,
    tableNumber: overrides.tableNumber ?? '1',
    confidence: 90,
    status: overrides.status ?? 'ok',
    ...overrides,
  };
}

// Silence the FloorPlan DEV dup-warning log noise (the preview tests are
// exercising deliberately-small configs where duplicates would not occur
// anyway, but we don't want flaky passes hinged on console state).
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('buildSyntheticConfig', () => {
  it('maps pins with tableNumbers to FloorPlanConfig.tablePositions', () => {
    const pins: DraftPin[] = [
      pin({ id: 'a', tableNumber: '1', x: 0.1, y: 0.2 }),
      pin({ id: 'b', tableNumber: '2', x: 0.3, y: 0.4 }),
      pin({ id: 'c', tableNumber: '3', x: 0.5, y: 0.6 }),
    ];
    const config = buildSyntheticConfig(pins, 'plan.png');
    expect(config.imageFileName).toBe('plan.png');
    expect(Object.keys(config.tablePositions)).toEqual(['1', '2', '3']);
    expect(config.tablePositions['1']).toEqual({ x: 0.1, y: 0.2 });
    expect(config.tablePositions['2']).toEqual({ x: 0.3, y: 0.4 });
    expect(config.tablePositions['3']).toEqual({ x: 0.5, y: 0.6 });
  });

  it('skips pins with tableNumber: null (needs-number placeholders)', () => {
    const pins: DraftPin[] = [
      pin({ id: 'a', tableNumber: '1', x: 0.1, y: 0.2 }),
      pin({ id: 'b', tableNumber: null, status: 'needs-number' }),
    ];
    const config = buildSyntheticConfig(pins, 'plan.png');
    expect(Object.keys(config.tablePositions)).toEqual(['1']);
  });

  it('carries the imageFileName through unchanged (D-16)', () => {
    const config = buildSyntheticConfig([], 'wedding-layout.png');
    expect(config.imageFileName).toBe('wedding-layout.png');
  });
});

describe('LivePreview', () => {
  it('renders a .floor-plan-wrapper inside the TransformComponent', () => {
    const { container } = render(
      <LivePreview
        pins={[pin({ id: 'a', tableNumber: '1', x: 0.2, y: 0.3 })]}
        imageUrl="blob:fake"
        imageFileName="plan.png"
      />,
    );
    // FloorPlan's root element (verified in src/components/FloorPlan.tsx).
    expect(container.querySelector('.floor-plan-wrapper')).not.toBeNull();
  });

  it('propagates focusedTableNumber → matching pin renders the pin-assigned overlay', () => {
    const { container } = render(
      <LivePreview
        pins={[
          pin({ id: 'a', tableNumber: '1', x: 0.2, y: 0.3 }),
          pin({ id: 'b', tableNumber: '2', x: 0.7, y: 0.6 }),
        ]}
        imageUrl="blob:fake"
        imageFileName="plan.png"
        focusedTableNumber="2"
      />,
    );
    const assigned = container.querySelector('[data-table-id="2"]');
    expect(assigned).not.toBeNull();
    expect(assigned?.classList.contains('pin-assigned')).toBe(true);
    // Non-focused table does NOT render an assigned pin.
    const notAssigned = container.querySelector('[data-table-id="1"]');
    expect(notAssigned).toBeNull();
  });

  it('defaults focusedTableNumber to "" (no pin-assigned overlay rendered)', () => {
    const { container } = render(
      <LivePreview
        pins={[pin({ id: 'a', tableNumber: '1', x: 0.2, y: 0.3 })]}
        imageUrl="blob:fake"
        imageFileName="plan.png"
      />,
    );
    expect(container.querySelector('.pin-assigned')).toBeNull();
  });

  it('passes imageSrc to FloorPlan so the single-<img> branch is used', () => {
    const { container } = render(
      <LivePreview
        pins={[]}
        imageUrl="blob:admin-upload"
        imageFileName="plan.png"
      />,
    );
    const img = container.querySelector('img.floor-plan-image') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('blob:admin-upload');
    // No <picture> fallback siblings when imageSrc is provided.
    expect(container.querySelector('picture')).toBeNull();
  });
});
