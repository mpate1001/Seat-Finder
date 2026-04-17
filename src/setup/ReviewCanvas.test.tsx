/**
 * Tests for src/setup/ReviewCanvas.tsx — interaction specs.
 *
 * jsdom does not fully model `getBoundingClientRect` sizing for positioned
 * elements; we override `getBoundingClientRect` on the container so the
 * fraction math is deterministic. Pointer events are fired via `fireEvent`
 * because @testing-library/user-event's pointer API does not preserve the
 * PointerEvent.clientX/Y semantics we need for drag math.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, createEvent } from '@testing-library/react';
import ReviewCanvas from './ReviewCanvas';
import type { DraftPin } from './types';

/** Fire a pointer event with clientX/Y reliably populated. jsdom 26's
 *  PointerEvent constructor does not propagate clientX/Y from the init dict;
 *  createEvent.pointerDown/Move/Up constructs a partial event that we then
 *  defineProperty on for the coordinates the component reads. */
function firePointer(
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  target: Element,
  init: { clientX: number; clientY: number; pointerId?: number },
): void {
  const event = createEvent[type](target, {
    bubbles: true,
    cancelable: true,
    pointerId: init.pointerId ?? 1,
    pointerType: 'mouse',
  });
  Object.defineProperty(event, 'clientX', { value: init.clientX, configurable: true });
  Object.defineProperty(event, 'clientY', { value: init.clientY, configurable: true });
  fireEvent(target, event);
}

function samplePin(overrides: Partial<DraftPin> = {}): DraftPin {
  return {
    id: overrides.id ?? 'pin-1',
    x: overrides.x ?? 0.5,
    y: overrides.y ?? 0.5,
    detectedRadius: 0.02,
    tableNumber: overrides.tableNumber ?? '1',
    confidence: 90,
    status: overrides.status ?? 'ok',
    ...overrides,
  };
}

/** Install a deterministic bounding rect on the review canvas container so
 *  pointer fraction math is predictable (jsdom otherwise returns 0/0). */
const FAKE_RECT = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: 1000,
  bottom: 800,
  width: 1000,
  height: 800,
  toJSON() {
    return this;
  },
} as DOMRect;

function stubAllRects(): void {
  // Patch BOTH Element and HTMLElement prototypes — some jsdom versions shadow
  // the prototype chain per-element-class. Covers everything in the tree.
  const fn = function getBoundingClientRect(): DOMRect {
    return FAKE_RECT;
  };
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    value: fn,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    value: fn,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  stubAllRects();
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
});

describe('ReviewCanvas', () => {
  it('renders each pin at its fractional left/top percentage', () => {
    const pins: DraftPin[] = [
      samplePin({ id: 'a', x: 0.25, y: 0.5, tableNumber: '1' }),
      samplePin({ id: 'b', x: 0.75, y: 0.5, tableNumber: '2' }),
    ];
    render(
      <ReviewCanvas
        imageUrl="blob:plan"
        imageNaturalWidth={1000}
        imageNaturalHeight={800}
        pins={pins}
        selectedPinId={null}
        onChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const pinA = document.querySelector('[data-pin-id="a"]') as HTMLElement;
    const pinB = document.querySelector('[data-pin-id="b"]') as HTMLElement;
    expect(pinA.style.left).toBe('25%');
    expect(pinA.style.top).toBe('50%');
    expect(pinB.style.left).toBe('75%');
    expect(pinB.style.top).toBe('50%');
  });

  it('drag: pointerdown + move beyond threshold + up → onChange with updated fractions', () => {
    const pins: DraftPin[] = [
      samplePin({ id: 'a', x: 0.5, y: 0.5, tableNumber: '1' }),
    ];
    const onChange = vi.fn();
    render(
      <ReviewCanvas
        imageUrl="blob:plan"
        imageNaturalWidth={1000}
        imageNaturalHeight={800}
        pins={pins}
        selectedPinId={null}
        onChange={onChange}
        onSelect={vi.fn()}
      />,
    );
    const container = screen.getByTestId('review-canvas-container') as HTMLElement;
    container.getBoundingClientRect = () => FAKE_RECT;

    const pinA = document.querySelector('[data-pin-id="a"]') as HTMLElement;
    // Move by 200px horizontally — above the 4px click-vs-drag threshold.
    firePointer('pointerDown', pinA, { clientX: 500, clientY: 400 });
    firePointer('pointerMove', pinA, { clientX: 700, clientY: 500 });
    firePointer('pointerUp', pinA, { clientX: 700, clientY: 500 });

    expect(onChange).toHaveBeenCalled();
    // The final onChange call reflects the last pointermove fraction:
    //   clientX=700 → x=0.7, clientY=500 → y=0.625.
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const movedPin = lastCall.find((p: DraftPin) => p.id === 'a');
    expect(movedPin.x).toBeCloseTo(0.7);
    expect(movedPin.y).toBeCloseTo(0.625);
  });

  it('click (short + small movement): opens inline editor seeded with tableNumber; Enter commits', async () => {
    const pins: DraftPin[] = [
      samplePin({ id: 'a', tableNumber: null, status: 'needs-number' }),
    ];
    const onChange = vi.fn();
    render(
      <ReviewCanvas
        imageUrl="blob:plan"
        imageNaturalWidth={1000}
        imageNaturalHeight={800}
        pins={pins}
        selectedPinId={null}
        onChange={onChange}
        onSelect={vi.fn()}
      />,
    );
    const pinA = document.querySelector('[data-pin-id="a"]') as HTMLElement;
    // Short press, no movement.
    firePointer('pointerDown', pinA, { clientX: 500, clientY: 400 });
    firePointer('pointerUp', pinA, { clientX: 501, clientY: 400 });

    const editor = (await screen.findByLabelText(/edit number for pin/i)) as HTMLInputElement;
    expect(editor).toBeInTheDocument();
    expect(editor.value).toBe('');

    fireEvent.change(editor, { target: { value: '99' } });
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const committed = lastCall.find((p: DraftPin) => p.id === 'a');
    expect(committed.tableNumber).toBe('99');
    expect(committed.status).toBe('ok');
  });

  it("'×' delete button: click removes the pin via onChange", () => {
    const pins: DraftPin[] = [
      samplePin({ id: 'a', tableNumber: '1' }),
      samplePin({ id: 'b', tableNumber: '2' }),
    ];
    const onChange = vi.fn();
    render(
      <ReviewCanvas
        imageUrl="blob:plan"
        imageNaturalWidth={1000}
        imageNaturalHeight={800}
        pins={pins}
        selectedPinId={null}
        onChange={onChange}
        onSelect={vi.fn()}
      />,
    );
    const deleteButton = screen.getByLabelText(/delete pin 1/i);
    fireEvent.click(deleteButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextPins = onChange.mock.calls[0][0];
    expect(nextPins).toHaveLength(1);
    expect(nextPins[0].id).toBe('b');
  });

  it('add mode: toggle Add → click container → onChange called with new needs-number pin at click fraction', async () => {
    const onChange = vi.fn();
    render(
      <ReviewCanvas
        imageUrl="blob:plan"
        imageNaturalWidth={1000}
        imageNaturalHeight={800}
        pins={[]}
        selectedPinId={null}
        onChange={onChange}
        onSelect={vi.fn()}
      />,
    );
    const addToggle = screen.getByRole('button', { name: /add pin/i });
    fireEvent.click(addToggle);

    const container = screen.getByTestId('review-canvas-container') as HTMLElement;
    container.getBoundingClientRect = () => FAKE_RECT;
    firePointer('pointerDown', container, { clientX: 500, clientY: 400 });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
    const newPins = onChange.mock.calls[0][0];
    expect(newPins).toHaveLength(1);
    expect(newPins[0].x).toBeCloseTo(0.5);
    expect(newPins[0].y).toBeCloseTo(0.5);
    expect(newPins[0].status).toBe('needs-number');
    expect(newPins[0].tableNumber).toBeNull();
  });

  it('renders the duplicate-positions warning when two pins are within 3%', () => {
    const pins: DraftPin[] = [
      samplePin({ id: 'a', x: 0.5, y: 0.5, tableNumber: '1' }),
      samplePin({ id: 'b', x: 0.51, y: 0.5, tableNumber: '2' }),
    ];
    render(
      <ReviewCanvas
        imageUrl="blob:plan"
        imageNaturalWidth={1000}
        imageNaturalHeight={800}
        pins={pins}
        selectedPinId={null}
        onChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/duplicate positions detected/i)).toBeInTheDocument();
    // The list item mentions the two labels.
    expect(screen.getByText(/pins.*“1”.*“2”/i)).toBeInTheDocument();
  });

  it('disabled=true: pointerdown on a pin does not trigger onChange (interactions disabled)', () => {
    const pins: DraftPin[] = [samplePin({ id: 'a', tableNumber: '1' })];
    const onChange = vi.fn();
    render(
      <ReviewCanvas
        imageUrl="blob:plan"
        imageNaturalWidth={1000}
        imageNaturalHeight={800}
        pins={pins}
        selectedPinId={null}
        onChange={onChange}
        onSelect={vi.fn()}
        disabled
      />,
    );
    const pinA = document.querySelector('[data-pin-id="a"]') as HTMLElement;
    firePointer('pointerDown', pinA, { clientX: 500, clientY: 400 });
    firePointer('pointerMove', pinA, { clientX: 700, clientY: 500 });
    firePointer('pointerUp', pinA, { clientX: 700, clientY: 500 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
