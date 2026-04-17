/**
 * Dispatch-contract lock for plan 05-01.
 *
 * Verifies three invariants produced by the route-split scaffold:
 *   1. `/` renders the guest <App /> (Seat Finder title reachable; "Setup
 *      tool" heading is not).
 *   2. `/setup` renders the <SetupApp /> branch — observed synchronously via
 *      the <Suspense fallback> copy, which is the deterministic marker before
 *      the lazy chunk resolves under the jsdom test env.
 *   3. src/main.tsx + src/Root.tsx contain NO static import of `./setup/*` —
 *      only the dynamic `lazy(() => import('./setup/SetupApp'))` edge inside
 *      Root.tsx is allowed (D-01). Plan 05-07 hardens this with a post-build
 *      grep over dist/assets/; this unit-level guard catches regressions at
 *      edit time before the build step runs.
 *
 * Root is imported directly (NOT main.tsx) so jsdom never executes the
 * `createRoot(document.getElementById('root')!)` entry — that crashes when
 * no #root element is pre-mounted in the test document.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

// Mock the guest-data layer so <App /> can mount in the '/' test without
// hitting Google Sheets. Mirrors the pattern from src/App.test.tsx.
const fetchGuestsCachedMock = vi.fn();

vi.mock('./services/guestsCache', () => ({
  fetchGuestsCached: (...args: unknown[]) => fetchGuestsCachedMock(...args),
}));

vi.mock('./services/googleSheets', () => ({
  SHEET_URL: 'https://example.test/csv',
  fetchGuests: vi.fn().mockResolvedValue([]),
  parseGuestsCsv: vi.fn(),
}));

// MapView mounts react-zoom-pan-pinch lazily when a guest is selected. It
// never fires during Root dispatch tests, but the stub guards against any
// accidental transitive import of the library internals under jsdom.
vi.mock('react-zoom-pan-pinch', async () => {
  const ReactActual = await vi.importActual<typeof import('react')>('react');
  return {
    TransformWrapper: ReactActual.forwardRef<unknown, { children: React.ReactNode }>(
      function TransformWrapperMock({ children }, ref) {
        ReactActual.useImperativeHandle(ref, () => ({ zoomToElement: vi.fn() }));
        return ReactActual.createElement('div', null, children);
      },
    ),
    TransformComponent: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement('div', null, children),
    useTransformComponent: (
      fn: (args: { state: { scale: number } }) => React.ReactNode,
    ) => fn({ state: { scale: 1 } }),
  };
});

import Root from './Root';

/**
 * Render helper: stubs window.location.pathname for the current test and
 * mounts <Root />. Exported for downstream tests that want to exercise more
 * pathname variants without re-implementing the stub.
 */
export function renderRootAt(pathname: string): ReturnType<typeof render> {
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: { ...window.location, pathname },
  });
  return render(<Root />);
}

describe('<Root /> pathname dispatch', () => {
  beforeEach(() => {
    fetchGuestsCachedMock.mockReset();
    // Keep <App /> in the loading branch so the test is deterministic without
    // waiting on async state. "Seat Finder" still renders in the loading card.
    fetchGuestsCachedMock.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('dispatches the guest <App /> on pathname "/"', () => {
    renderRootAt('/');

    // Guest surface is visible...
    expect(screen.getByText('Seat Finder')).toBeInTheDocument();
    // ...and the setup shell is NOT.
    expect(screen.queryByText('Setup tool')).toBeNull();
    expect(screen.queryByText(/Loading setup tool/)).toBeNull();
  });

  it('dispatches <SetupApp /> on pathname "/setup" (Suspense fallback visible)', () => {
    renderRootAt('/setup');

    // The lazy chunk has not resolved synchronously under jsdom — the
    // fallback copy is the deterministic observable that proves we took the
    // setup branch, not the guest branch.
    expect(screen.getByText(/Loading setup tool/)).toBeInTheDocument();
    // Guest surface is NOT mounted.
    expect(screen.queryByText('Seat Finder')).toBeNull();
  });
});

describe('static-import invariant (D-01)', () => {
  it('src/main.tsx contains no static import from "./setup/"', () => {
    const source = readFileSync(
      resolve(__dirname, 'main.tsx'),
      'utf8',
    );
    // Any `import ... from './setup/...'` line (ES module static form) is
    // disallowed. The only valid edge is `lazy(() => import('./setup/...'))`
    // which is a function call — not a top-level `import ... from` statement.
    const staticImportRe = /^\s*import\s[^;]*\sfrom\s+['"]\.\/setup\//m;
    expect(staticImportRe.test(source)).toBe(false);
  });

  it('src/Root.tsx static imports from "./setup/" are forbidden', () => {
    const source = readFileSync(
      resolve(__dirname, 'Root.tsx'),
      'utf8',
    );
    const staticImportRe = /^\s*import\s[^;]*\sfrom\s+['"]\.\/setup\//m;
    expect(staticImportRe.test(source)).toBe(false);

    // And the dynamic edge MUST exist — this is the one allowed boundary.
    expect(source).toMatch(
      /lazy\(\s*\(\s*\)\s*=>\s*import\(\s*['"]\.\/setup\/SetupApp['"]\s*\)\s*\)/,
    );
  });
});
