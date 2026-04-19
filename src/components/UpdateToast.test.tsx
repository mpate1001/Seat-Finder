import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpdateToast from './UpdateToast';

const updateSpy = vi.fn();
const setNeedRefresh = vi.fn();
let mockNeedRefresh = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, setNeedRefresh],
    updateServiceWorker: updateSpy,
  }),
}));

describe('<UpdateToast />', () => {
  beforeEach(() => {
    mockNeedRefresh = false;
    updateSpy.mockReset();
    setNeedRefresh.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no update is pending', () => {
    mockNeedRefresh = false;
    const { container } = render(<UpdateToast />);
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('.update-toast')).toBeNull();
  });

  it('renders toast and fires updateServiceWorker(true) on click', () => {
    mockNeedRefresh = true;
    render(<UpdateToast />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(updateSpy).toHaveBeenCalledWith(true);
  });

  it('respects the suppressed prop', () => {
    mockNeedRefresh = true;
    const { container } = render(<UpdateToast suppressed />);
    // Portal mounts to document.body — check there too.
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('.update-toast')).toBeNull();
  });

  it('auto-dismisses after 10s', () => {
    vi.useFakeTimers();
    mockNeedRefresh = true;
    render(<UpdateToast />);
    vi.advanceTimersByTime(10_000);
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
