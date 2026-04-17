import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import StalenessBadge from './StalenessBadge';

// Mock both hooks so we can drive the render tree deterministically.
// vi.mock is hoisted — the factory must only reference module-scope vars.
const mockOnline = vi.fn();
const mockAge = vi.fn();

vi.mock('../pwa/useOnlineStatus', () => ({
  useOnlineStatus: () => mockOnline(),
}));
vi.mock('../pwa/useCacheAge', () => ({
  useCacheAge: () => mockAge(),
}));

describe('<StalenessBadge />', () => {
  beforeEach(() => {
    mockOnline.mockReset();
    mockAge.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when online and cache is fresh (<1h)', () => {
    mockOnline.mockReturnValue(true);
    mockAge.mockReturnValue(30 * 60 * 1000); // 30 minutes
    const { container } = render(
      <StalenessBadge fetchedAt="2026-04-17T11:00:00.000Z" onRefresh={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders "Updated Xm ago" when online and cache is >=1h old', () => {
    mockOnline.mockReturnValue(true);
    mockAge.mockReturnValue(90 * 60 * 1000); // 90 minutes
    render(
      <StalenessBadge fetchedAt="2026-04-17T10:00:00.000Z" onRefresh={() => {}} />,
    );
    expect(screen.getByRole('button')).toHaveTextContent(/Updated 90m ago/);
  });

  it('renders offline copy when navigator.onLine is false', () => {
    mockOnline.mockReturnValue(false);
    mockAge.mockReturnValue(5 * 60 * 1000);
    render(
      <StalenessBadge fetchedAt="2026-04-17T11:55:00.000Z" onRefresh={() => {}} />,
    );
    expect(screen.getByRole('button')).toHaveTextContent(
      /Offline — showing cached list/,
    );
  });

  it('fires onRefresh when the badge is tapped', () => {
    mockOnline.mockReturnValue(false);
    mockAge.mockReturnValue(null);
    const refresh = vi.fn();
    render(<StalenessBadge fetchedAt={null} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole('button'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
