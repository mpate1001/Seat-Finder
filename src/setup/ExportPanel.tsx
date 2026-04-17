/**
 * src/setup/ExportPanel.tsx — Download + Copy to Clipboard UI (D-17, D-18).
 *
 * Rendered by SetupApp when `mode === 'approved'`. Two side-by-side action
 * buttons produce byte-identical outputs:
 *  - Download floorPlan.json  → Blob + URL.createObjectURL + synthesized
 *                               <a download> click + setTimeout-revoke.
 *  - Copy to Clipboard        → navigator.clipboard.writeText(...) with a
 *                               <textarea readOnly> pre-selected fallback
 *                               for non-secure contexts / denied permission
 *                               (Pitfall 5 — clipboard only resolves in
 *                               secure contexts like https/localhost).
 *
 * D-18 reminder: this panel does NOT write back to the repo. The admin must
 * paste the downloaded/copied JSON into `src/config/floorPlan.json` and
 * reload the guest app to pick up the change.
 *
 * References:
 *  - .planning/phases/05-setup-tooling/05-CONTEXT.md D-17, D-18
 *  - .planning/phases/05-setup-tooling/05-RESEARCH.md §Code Examples "Download
 *    + clipboard export" + §Pitfall 5 (secure-context fallback)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DraftPin } from './types';
import {
  buildFloorPlanConfig,
  serializeFloorPlanConfig,
} from './exportConfig';
import './ExportPanel.css';

export interface ExportPanelProps {
  pins: DraftPin[];
  imageFileName: string;
  onBack: () => void;
}

/** Trigger a browser download of `text` under the given filename. Uses the
 *  Blob + createObjectURL + synthesized-anchor-click pattern from
 *  .planning/phases/05-setup-tooling/05-RESEARCH.md §Code Examples. */
function downloadJson(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on next tick so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface CopyResult {
  ok: boolean;
  error?: string;
}

/** Copy text via navigator.clipboard.writeText. Returns `{ ok: false }` if
 *  the clipboard API is unavailable (non-secure context, older browser) or
 *  if the call rejects (permission denied, transient error). */
async function copyToClipboard(text: string): Promise<CopyResult> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== 'function'
  ) {
    return { ok: false, error: 'Clipboard API unavailable' };
  }
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Copy failed' };
  }
}

export default function ExportPanel({
  pins,
  imageFileName,
  onBack,
}: ExportPanelProps): JSX.Element {
  const json = useMemo(
    () => serializeFloorPlanConfig(buildFloorPlanConfig(pins, imageFileName)),
    [pins, imageFileName],
  );

  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);

  // Clear the "Copied" toast after 2s. The effect owns the timer so
  // StrictMode double-invoke cleanup doesn't leak a pending setTimeout.
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  // When the textarea fallback appears, preselect its contents so the admin
  // can hit Cmd/Ctrl+C immediately.
  useEffect(() => {
    if (!showFallback) return;
    const textarea = fallbackRef.current;
    if (textarea) {
      textarea.focus();
      textarea.select();
    }
  }, [showFallback]);

  function handleDownload(): void {
    downloadJson(json, 'floorPlan.json');
  }

  async function handleCopy(): Promise<void> {
    const result = await copyToClipboard(json);
    if (result.ok) {
      setCopied(true);
      setShowFallback(false);
    } else {
      // Clipboard path failed — reveal the manual-select fallback.
      setShowFallback(true);
      setCopied(false);
    }
  }

  return (
    <section className="export-panel" aria-labelledby="export-panel-heading">
      <div className="export-panel-header">
        <h2 id="export-panel-heading" className="export-panel-title">
          Export floorPlan.json
        </h2>
        <button
          type="button"
          className="export-panel-back"
          onClick={onBack}
        >
          Back to edit
        </button>
      </div>

      <div className="export-panel-actions">
        <button
          type="button"
          className="export-panel-button export-panel-button--primary"
          onClick={handleDownload}
        >
          Download floorPlan.json
        </button>
        <button
          type="button"
          className="export-panel-button export-panel-button--primary"
          onClick={() => {
            void handleCopy();
          }}
        >
          Copy to Clipboard
        </button>
        {copied && (
          <span
            className="export-panel-toast"
            role="status"
            aria-live="polite"
          >
            Copied
          </span>
        )}
      </div>

      <p className="export-panel-reminder">
        This does not auto-commit to the repo. Save the downloaded file or
        paste the copied JSON into <code>src/config/floorPlan.json</code>,
        then reload the guest app.
      </p>

      {showFallback && (
        <div className="export-panel-fallback">
          <p className="export-panel-fallback-hint">
            Clipboard unavailable — press Cmd/Ctrl+C to copy the selected
            text.
          </p>
          <textarea
            ref={fallbackRef}
            className="export-panel-textarea"
            readOnly
            rows={12}
            value={json}
            aria-label="Generated floorPlan.json text for manual copy"
          />
        </div>
      )}
    </section>
  );
}
