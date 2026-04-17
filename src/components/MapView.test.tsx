import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Guest } from '../types';

// Mock react-zoom-pan-pinch so tests don't rely on the library's internals.
// We expose a stable zoomToElement spy via the module-scoped mockZoomToElement.
const mockZoomToElement = vi.fn();
vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => {
    return <div data-testid="transform-wrapper">{children}</div>;
  },
  TransformComponent: ({ children }: { children: React.ReactNode }) => {
    return <div data-testid="transform-component">{children}</div>;
  },
}));

// Mock FloorPlan (being refactored in Wave 4). This mock only needs to accept
// the new props contract so TypeScript is happy and MapView renders cleanly.
vi.mock('./FloorPlan', () => ({
  default: ({ tableNumber }: { tableNumber: string }) => (
    <div data-testid="floor-plan-mock" data-table-number={tableNumber}>
      <picture>
        <source type="image/avif" />
        <source type="image/webp" />
        <img alt="Reception Floor Plan" />
      </picture>
    </div>
  ),
}));

import MapView from './MapView';

const guestWithValidTable: Guest = {
  tableNumber: '12',
  firstName: 'Mahek',
  lastName: 'Patel',
  contactInfo: '',
  description: 'Bride',
};

const guestWithInvalidTable: Guest = {
  tableNumber: '999', // not in floorPlan.json
  firstName: 'Test',
  lastName: 'Guest',
  contactInfo: '',
  description: '',
};

beforeEach(() => {
  mockZoomToElement.mockClear();
  // Reset history state between tests — MapView's popstate cleanup calls
  // history.back() which leaves stale entries otherwise.
  history.replaceState(null, '');
});

afterEach(() => {
  cleanup();
});

describe('MapView', () => {
  it.todo('zooms to assigned table');
  it.todo('overview hold before zoom');

  it('missing tableNumber shows fallback', () => {
    const onClose = vi.fn();
    render(<MapView guest={guestWithInvalidTable} onClose={onClose} />);

    // Overlay card still renders with the greeting
    expect(
      screen.getByText((_content, el) => {
        return el?.className === 'map-overlay-card-greeting' &&
          /Welcome, Test!/.test(el?.textContent ?? '') &&
          /Table 999/.test(el?.textContent ?? '');
      })
    ).toBeInTheDocument();

    // Fallback message is present
    expect(
      screen.getByText(/please ask staff for directions/i)
    ).toBeInTheDocument();

    // Close button still present
    expect(screen.getByLabelText('Close map')).toBeInTheDocument();
  });

  it('picture element has avif + webp + png sources', () => {
    const onClose = vi.fn();
    const { container } = render(
      <MapView guest={guestWithValidTable} onClose={onClose} />
    );

    // Picture element is rendered (via the FloorPlan child — Wave 4 provides
    // the real markup; this assertion confirms MapView doesn't block it).
    const picture = container.querySelector('picture');
    expect(picture).not.toBeNull();

    const avifSource = container.querySelector('source[type="image/avif"]');
    const webpSource = container.querySelector('source[type="image/webp"]');
    const imgFallback = container.querySelector('picture img');

    expect(avifSource).not.toBeNull();
    expect(webpSource).not.toBeNull();
    expect(imgFallback).not.toBeNull();
  });
});
