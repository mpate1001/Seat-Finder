/**
 * src/setup/FileDrop.tsx — upload surface for the setup tool.
 *
 * Responsibilities:
 *  - Drag-and-drop zone AND a hidden `<input type="file">` wrapped in a label
 *    (single component, two input affordances) — clicking the zone opens the
 *    file picker; dropping a file decodes it immediately.
 *  - Accept whitelist (Pitfall 7): only PNG / JPEG / WebP / AVIF. Rejects
 *    HEIC and anything else with the Pitfall-7 copy.
 *  - Creates a blob URL via `URL.createObjectURL(file)` and hands it to the
 *    owner (SetupApp) alongside the decoded ImageBitmap + file name. The
 *    OWNER is responsible for `URL.revokeObjectURL` lifecycle (to avoid
 *    revoking a URL still in use by the `<img>` behind the review canvas).
 *  - Decodes via `createImageBitmap(file, { resizeWidth: 3000, resizeQuality:
 *    'high' })` — the browser caps the long edge at 3000px automatically
 *    (Pitfall 4). Small clean PNGs pass through at native resolution since
 *    createImageBitmap only upscales / downscales, not both.
 *
 * No `useEffect` — all work happens inside user-gesture handlers, satisfying
 * Pitfall 3 (StrictMode double-mount cannot spawn a duplicate decode).
 *
 * References:
 *  - .planning/phases/05-setup-tooling/05-RESEARCH.md §Code Examples
 *    "Upload → decoded image", §Pitfall 4 (downscale), §Pitfall 7 (accept list)
 *  - src/App.tsx (error-card visual pattern — matches tone/copy)
 */

import { useRef } from 'react';

/** Whitelisted MIME types (Pitfall 7). HEIC is explicitly excluded because
 *  Safari's decoder gate varies by iOS version — we'd rather tell the admin
 *  to convert than ship a partially-working decode path. */
const ACCEPTED_MIME_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
]);

const ACCEPT_ATTR = 'image/png,image/jpeg,image/webp,image/avif';

const REJECT_MESSAGE =
  "This image format isn't supported. Please upload a PNG, JPEG, WebP, or AVIF.";

const DECODE_ERROR_MESSAGE =
  "We couldn't read that image. Please upload a PNG, JPEG, WebP, or AVIF.";

/** Largest dimension (long edge, pixels) passed to createImageBitmap. Matches
 *  the pipeline's MAX_DIMENSION — any downscale here is a pre-emptive cap that
 *  reduces the amount of bitmap data retained in memory before the pipeline
 *  re-examines sizes (Pitfall 4). */
const MAX_DIMENSION = 3000;

export interface FileDropProps {
  /**
   * Called when a file has been accepted + decoded. `objectUrl` is produced
   * via `URL.createObjectURL(file)` — the owner must call
   * `URL.revokeObjectURL(objectUrl)` when this image is replaced or the
   * component unmounts, to avoid leaking blob handles.
   */
  onImageReady: (bitmap: ImageBitmap, fileName: string, objectUrl: string) => void;
  /**
   * Called when a file is rejected (wrong type) or fails to decode. The copy
   * mirrors the App.tsx error-card tone — the caller typically surfaces it in
   * an inline error strip next to the drop zone.
   */
  onError: (message: string) => void;
}

export default function FileDrop({ onImageReady, onError }: FileDropProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File): Promise<void> {
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      onError(REJECT_MESSAGE);
      return;
    }

    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
      const bitmap = await createImageBitmap(file, {
        resizeWidth: MAX_DIMENSION,
        resizeQuality: 'high',
      });
      onImageReady(bitmap, file.name, objectUrl);
    } catch {
      // Revoke the URL we just created — we're not handing it off.
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
      onError(DECODE_ERROR_MESSAGE);
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
    // Clear the input so the admin can re-select the same file after a retry.
    event.target.value = '';
  }

  function handleDragOver(event: React.DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    // Let the browser surface the drop cursor.
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  }

  return (
    <label
      className="setup-file-drop"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={handleInputChange}
        className="setup-file-drop-input"
        aria-label="Upload floor-plan image"
      />
      <div className="setup-file-drop-copy">
        <strong>Drop floor-plan image here</strong>
        <span>or click to choose (PNG, JPEG, WebP, AVIF)</span>
      </div>
    </label>
  );
}
