/**
 * Tests for src/setup/ExportPanel.tsx — Download + Copy + fallback paths.
 *
 * jsdom does not implement URL.createObjectURL or anchor download clicks,
 * so we stub both. navigator.clipboard is stubbed per-spec because the
 * happy-path and the fallback paths need different shapes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportPanel from './ExportPanel';
import type { DraftPin } from './types';

function pin(overrides: Partial<DraftPin> = {}): DraftPin {
  return {
    id: overrides.id ?? 'pin-1',
    x: overrides.x ?? 0.5,
    y: overrides.y ?? 0.5,
    detectedRadius: 0.02,
    tableNumber: overrides.tableNumber === undefined ? '1' : overrides.tableNumber,
    confidence: 100,
    status: 'ok',
    ...overrides,
  };
}

describe('ExportPanel', () => {
  beforeEach(() => {
    // jsdom does not implement URL.createObjectURL — stub via defineProperty so
    // `vi.unstubAllGlobals` (which uses delete) does not strip the whole URL
    // class from global.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mock-url'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Download + Copy + Back-to-edit buttons and the D-18 reminder copy', () => {
    render(
      <ExportPanel
        pins={[pin({ id: 'a', tableNumber: '1' })]}
        imageFileName="plan.png"
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /download floorplan\.json/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to edit/i })).toBeInTheDocument();
    expect(
      screen.getByText(/does not auto-commit to the repo/i),
    ).toBeInTheDocument();
  });

  it('Download click: synthesizes <a download="floorPlan.json"> + clicks it + revokes the URL on next tick', async () => {
    vi.useFakeTimers();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    render(
      <ExportPanel
        pins={[pin({ id: 'a', tableNumber: '1' })]}
        imageFileName="plan.png"
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /download floorplan\.json/i }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Revoke happens on the next tick (setTimeout 0).
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    vi.useRealTimers();
  });

  it('Copy click (happy path): writes serialized JSON to navigator.clipboard and shows "Copied" toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <ExportPanel
        pins={[pin({ id: 'a', tableNumber: '1', x: 0.1, y: 0.2 })]}
        imageFileName="plan.png"
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const payload = writeText.mock.calls[0][0] as string;
    expect(payload).toContain('"imageFileName": "plan.png"');
    expect(payload).toContain('"1": { "x": 0.1000, "y": 0.2000 }');
    expect(await screen.findByText(/^copied$/i)).toBeInTheDocument();
  });

  it('Copy click (no clipboard): textarea fallback appears containing the JSON', async () => {
    // Remove clipboard entirely — represents a non-secure context.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    render(
      <ExportPanel
        pins={[pin({ id: 'a', tableNumber: '1' })]}
        imageFileName="plan.png"
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));

    const textarea = (await screen.findByLabelText(
      /generated floorplan\.json text for manual copy/i,
    )) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toContain('"imageFileName": "plan.png"');
    expect(
      screen.getByText(/press cmd\/ctrl\+c to copy the selected text/i),
    ).toBeInTheDocument();
  });

  it('Copy click (clipboard writeText rejects): same textarea fallback appears', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      },
    });

    render(
      <ExportPanel
        pins={[pin({ id: 'a', tableNumber: '1' })]}
        imageFileName="plan.png"
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));

    expect(
      await screen.findByLabelText(
        /generated floorplan\.json text for manual copy/i,
      ),
    ).toBeInTheDocument();
  });

  it('Back-to-edit click: invokes onBack exactly once', () => {
    const onBack = vi.fn();
    render(
      <ExportPanel
        pins={[pin({ id: 'a', tableNumber: '1' })]}
        imageFileName="plan.png"
        onBack={onBack}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /back to edit/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
