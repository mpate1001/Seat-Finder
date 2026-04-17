import { useEffect, useMemo, useState } from 'react';
import './SetupApp.css';
import FileDrop from './FileDrop';
import ReviewCanvas from './ReviewCanvas';
import LivePreview from './LivePreview';
import { runDetectionPipeline } from './pipeline';
import type { DraftPin, PipelineProgress } from './types';

/**
 * SetupApp — the floor-plan admin root (TOOL-01 + TOOL-04 wiring).
 *
 * Flow: upload → click Detect → pipeline runs → review pane (drag / edit /
 * delete / add) + live-preview pane (real <FloorPlan/>) update in sync.
 * Approve + export is plan 05-06; Approve button is visible but disabled
 * here to signal the upcoming gate.
 *
 * StrictMode discipline (Pitfall 3): `runDetectionPipeline` is invoked ONLY
 * from inside the Detect button's onClick handler — never in a useEffect —
 * so the StrictMode double-mount cannot spawn a duplicate worker or WASM
 * init. The module-level cvPromise singleton inside detect.ts provides
 * belt-and-suspenders for any later caller that does not follow this rule.
 *
 * Single-flight discipline (Pitfall 2): the Detect button is disabled while
 * `mode === 'detecting'`. A second click cannot start a second pipeline.
 *
 * Blob-URL lifecycle (Pitfall 7): the uploaded image's object URL is owned
 * by SetupApp. A useEffect cleanup revokes the previous URL when the
 * uploaded image changes, and on unmount — no leaked blob handles.
 *
 * D-04: route-obscurity warning stays visible in the card header at all
 * times (from plan 05-01) — DO NOT share this URL.
 */

type SetupMode = 'idle' | 'detecting' | 'review';

export default function SetupApp(): JSX.Element {
  const [uploadedBitmap, setUploadedBitmap] = useState<ImageBitmap | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [draftPins, setDraftPins] = useState<DraftPin[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [status, setStatus] = useState<PipelineProgress | null>(null);
  const [mode, setMode] = useState<SetupMode>('idle');
  const [error, setError] = useState<string | null>(null);

  // Revoke the previous object URL whenever it's replaced or the component
  // unmounts. The cleanup captures the URL value at the time the effect ran,
  // so a later-replaced URL will be revoked correctly.
  useEffect(() => {
    if (uploadedImageUrl === null) return;
    const url = uploadedImageUrl;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [uploadedImageUrl]);

  // Pin-status counts for the summary bar — cheap derived state.
  const pinStatusCounts = useMemo(() => {
    const counts = { ok: 0, low: 0, needs: 0 };
    for (const pin of draftPins) {
      if (pin.status === 'ok') counts.ok += 1;
      else if (pin.status === 'low-confidence') counts.low += 1;
      else if (pin.status === 'needs-number') counts.needs += 1;
    }
    return counts;
  }, [draftPins]);

  // The review canvas's selected pin feeds into LivePreview's focused-table
  // spotlight. Empty string = no highlight (the FloorPlan's default branch).
  const focusedTableNumber = useMemo(() => {
    if (selectedPinId === null) return '';
    const pin = draftPins.find((p) => p.id === selectedPinId);
    return pin?.tableNumber ?? '';
  }, [selectedPinId, draftPins]);

  function handleImageReady(
    bitmap: ImageBitmap,
    fileName: string,
    objectUrl: string,
  ): void {
    // useEffect cleanup will revoke the *previous* URL when uploadedImageUrl
    // is replaced — we don't need to revoke here.
    setUploadedBitmap(bitmap);
    setUploadedFileName(fileName);
    setUploadedImageUrl(objectUrl);
    setDraftPins([]);
    setSelectedPinId(null);
    setStatus(null);
    setMode('idle');
    setError(null);
  }

  function handleUploadError(message: string): void {
    setError(message);
  }

  async function handleDetect(): Promise<void> {
    if (uploadedBitmap === null || uploadedFileName === null) return;
    if (mode === 'detecting') return; // single-flight guard (Pitfall 2)
    setMode('detecting');
    setError(null);
    setStatus({ stage: 'preparing', message: 'Preparing image...' });
    try {
      const pins = await runDetectionPipeline(
        uploadedBitmap,
        uploadedFileName,
        (p) => setStatus(p),
      );
      setDraftPins(pins);
      setMode('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Detection failed');
      setMode('idle');
    }
  }

  function handleReupload(): void {
    // The useEffect cleanup revokes the object URL when we null it out.
    setUploadedBitmap(null);
    setUploadedFileName(null);
    setUploadedImageUrl(null);
    setDraftPins([]);
    setSelectedPinId(null);
    setStatus(null);
    setMode('idle');
    setError(null);
  }

  // Status line text — the OCR stage prints "(done/total)" so long runs show
  // "Reading circle numbers... (12/54)" style progress.
  const statusLine =
    status === null
      ? ''
      : typeof status.done === 'number' && typeof status.total === 'number'
        ? `${status.message} (${status.done}/${status.total})`
        : status.message;

  const hasUpload = uploadedBitmap !== null && uploadedImageUrl !== null;

  return (
    <main className="setup-app">
      <div className="setup-card">
        <h1>Setup tool</h1>
        <p className="setup-subtitle">
          Floor-plan admin — route obscurity only, DO NOT share this URL.
        </p>

        {error !== null && (
          <div className="setup-error-card" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="setup-retry-button"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {!hasUpload && (
          <FileDrop onImageReady={handleImageReady} onError={handleUploadError} />
        )}

        {hasUpload && mode !== 'review' && (
          <div className="setup-preflight">
            <p className="setup-preflight-filename">
              <strong>Loaded:</strong> {uploadedFileName} (
              {uploadedBitmap?.width}×{uploadedBitmap?.height})
            </p>
            <div className="setup-preflight-actions">
              <button
                type="button"
                className="setup-detect-button"
                onClick={handleDetect}
                disabled={mode === 'detecting'}
              >
                {mode === 'detecting' ? 'Detecting...' : 'Detect tables'}
              </button>
              <button
                type="button"
                className="setup-reupload-button"
                onClick={handleReupload}
                disabled={mode === 'detecting'}
              >
                Re-upload
              </button>
            </div>
            {statusLine !== '' && (
              <p className="setup-status-line" aria-live="polite">
                {statusLine}
              </p>
            )}
          </div>
        )}

        {hasUpload && mode === 'review' && uploadedImageUrl !== null && (
          <div className="setup-review">
            <div className="setup-review-summary">
              <p className="setup-review-summary-headline">
                Found <strong>{draftPins.length}</strong> table
                {draftPins.length === 1 ? '' : 's'}. Review, correct, then
                approve below.
              </p>
              <p className="setup-review-summary-counts">
                <span className="setup-count setup-count--ok">
                  {pinStatusCounts.ok} OK
                </span>{' '}
                <span className="setup-count setup-count--low">
                  {pinStatusCounts.low} low-confidence
                </span>{' '}
                <span className="setup-count setup-count--needs">
                  {pinStatusCounts.needs} needs number
                </span>
              </p>
            </div>

            <div className="setup-review-grid">
              <div className="setup-review-pane">
                <h2 className="setup-pane-title">Review</h2>
                <ReviewCanvas
                  imageUrl={uploadedImageUrl}
                  imageNaturalWidth={uploadedBitmap?.width ?? 1}
                  imageNaturalHeight={uploadedBitmap?.height ?? 1}
                  pins={draftPins}
                  selectedPinId={selectedPinId}
                  onChange={setDraftPins}
                  onSelect={setSelectedPinId}
                />
              </div>
              <div className="setup-review-pane">
                <h2 className="setup-pane-title">Live preview</h2>
                <LivePreview
                  pins={draftPins}
                  imageUrl={uploadedImageUrl}
                  imageFileName={uploadedFileName ?? 'floor-plan'}
                  focusedTableNumber={focusedTableNumber}
                />
              </div>
            </div>

            <div className="setup-review-actions">
              <button
                type="button"
                className="setup-approve-button"
                disabled
                aria-disabled="true"
                title="Approve + export lands in the next plan"
              >
                Approve + export (coming in next plan)
              </button>
              <button
                type="button"
                className="setup-reupload-button"
                onClick={handleReupload}
              >
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
