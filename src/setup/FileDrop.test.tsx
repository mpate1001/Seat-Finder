/**
 * Tests for src/setup/FileDrop.tsx — upload decode + reject paths.
 *
 * jsdom does not implement `createImageBitmap` or `URL.createObjectURL`; both
 * are stubbed via `vi.stubGlobal` so specs can assert call arguments + error
 * paths without a real decoder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileDrop from './FileDrop';

/** Minimal File constructor — jsdom's File exists but the constructor expects
 *  a Blob bits array + name + options. Matches the shape of a <input
 *  type='file'> selection. */
function makeFile(name: string, type: string): File {
  return new File(['fake-bytes'], name, { type });
}

describe('FileDrop', () => {
  beforeEach(() => {
    // Each spec resets the stubs so call counts don't leak.
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 2400, height: 1831, close: () => {} })),
    );
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the drop zone with a hidden file input using the accept whitelist', () => {
    render(<FileDrop onImageReady={vi.fn()} onError={vi.fn()} />);
    expect(screen.getByText(/drop floor-plan image here/i)).toBeInTheDocument();
    const input = screen.getByLabelText(/upload floor-plan image/i) as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('image/png,image/jpeg,image/webp,image/avif');
  });

  it('rejects HEIC uploads with the Pitfall-7 error copy', async () => {
    // @testing-library/user-event v14's `upload` pre-validates against the
    // input's `accept` attribute and no-ops on a mismatch BEFORE the change
    // event fires. That's not what we're asserting here — we're asserting the
    // component's OWN defense-in-depth check (in case a browser doesn't
    // enforce the accept hint, or the file comes in via drag-and-drop).
    // `fireEvent.change` bypasses the library's pre-validation.
    const onImageReady = vi.fn();
    const onError = vi.fn();
    render(<FileDrop onImageReady={onImageReady} onError={onError} />);

    const input = screen.getByLabelText(/upload floor-plan image/i) as HTMLInputElement;
    const heicFile = makeFile('photo.heic', 'image/heic');
    Object.defineProperty(input, 'files', { value: [heicFile], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        "This image format isn't supported. Please upload a PNG, JPEG, WebP, or AVIF.",
      );
    });
    expect(onImageReady).not.toHaveBeenCalled();
  });

  it('on PNG upload: calls onImageReady with bitmap + filename + objectUrl', async () => {
    const onImageReady = vi.fn();
    const onError = vi.fn();
    render(<FileDrop onImageReady={onImageReady} onError={onError} />);

    const input = screen.getByLabelText(/upload floor-plan image/i) as HTMLInputElement;
    const user = userEvent.setup();
    await user.upload(input, makeFile('reception.png', 'image/png'));

    expect(onImageReady).toHaveBeenCalledTimes(1);
    const [bitmap, fileName, objectUrl] = onImageReady.mock.calls[0];
    expect(bitmap).toEqual(
      expect.objectContaining({ width: 2400, height: 1831 }),
    );
    expect(fileName).toBe('reception.png');
    expect(objectUrl).toBe('blob:fake-url');
    expect(onError).not.toHaveBeenCalled();
  });

  it('passes resizeWidth: 3000 + resizeQuality: "high" to createImageBitmap (Pitfall 4)', async () => {
    const onImageReady = vi.fn();
    render(<FileDrop onImageReady={onImageReady} onError={vi.fn()} />);
    const input = screen.getByLabelText(/upload floor-plan image/i) as HTMLInputElement;
    const user = userEvent.setup();
    await user.upload(input, makeFile('big.jpg', 'image/jpeg'));

    const createImageBitmapSpy = globalThis.createImageBitmap as unknown as ReturnType<typeof vi.fn>;
    expect(createImageBitmapSpy).toHaveBeenCalledTimes(1);
    const opts = createImageBitmapSpy.mock.calls[0][1];
    expect(opts).toEqual({ resizeWidth: 3000, resizeQuality: 'high' });
  });

  it('on decode error: calls onError with the Pitfall-7 fallback copy + revokes the blob URL', async () => {
    // Override createImageBitmap to throw (simulate corrupt image).
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode failed');
      }),
    );
    const revokeSpy = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake-bad'),
      revokeObjectURL: revokeSpy,
    });

    const onImageReady = vi.fn();
    const onError = vi.fn();
    render(<FileDrop onImageReady={onImageReady} onError={onError} />);

    const input = screen.getByLabelText(/upload floor-plan image/i) as HTMLInputElement;
    const user = userEvent.setup();
    await user.upload(input, makeFile('bad.png', 'image/png'));

    expect(onError).toHaveBeenCalledWith(
      "We couldn't read that image. Please upload a PNG, JPEG, WebP, or AVIF.",
    );
    expect(onImageReady).not.toHaveBeenCalled();
    // We must not leak the URL we created for a file we couldn't decode.
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake-bad');
  });
});
