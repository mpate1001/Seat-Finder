import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary, { ERROR_BOUNDARY_STORAGE_KEY } from './ErrorBoundary';

/** Throws on render so we can assert ErrorBoundary catches it. Defined at
 *  module scope so the same reference is used across specs. */
function ExplodingChild(): JSX.Element {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught errors via console.error during the offending render
    // — silence the expected noise so the test output stays clean while still
    // letting our own [ErrorBoundary] log fire (the spy lets it through).
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.removeItem(ERROR_BOUNDARY_STORAGE_KEY);
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <p>healthy child</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy child')).toBeInTheDocument();
  });

  it('renders the fallback UI when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <ExplodingChild />
      </ErrorBoundary>,
    );
    // role="alert" so assistive tech announces the failure
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reload/i }),
    ).toBeInTheDocument();
    // Children are NOT rendered alongside the fallback
    expect(screen.queryByText('healthy child')).not.toBeInTheDocument();
  });

  it('persists the error to localStorage for post-event inspection', () => {
    render(
      <ErrorBoundary>
        <ExplodingChild />
      </ErrorBoundary>,
    );
    const stored = localStorage.getItem(ERROR_BOUNDARY_STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as {
      ts: string;
      message: string;
      stack?: string;
      componentStack?: string;
    };
    expect(parsed.message).toBe('boom');
    // ts is an ISO8601 string — Date.parse must yield a finite number
    expect(Number.isFinite(Date.parse(parsed.ts))).toBe(true);
    // componentStack should mention the offending component name
    expect(parsed.componentStack ?? '').toContain('ExplodingChild');
  });

  it('does not throw if localStorage is unavailable', () => {
    // Simulate a private-mode browser where setItem rejects.
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      // The render itself must not throw — the ErrorBoundary swallows
      // the storage failure so we still get the fallback UI on screen.
      expect(() => {
        render(
          <ErrorBoundary>
            <ExplodingChild />
          </ErrorBoundary>,
        );
      }).not.toThrow();
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
  });
});
