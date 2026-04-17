import './StalenessBadge.css';
import { useOnlineStatus } from '../pwa/useOnlineStatus';
import { useCacheAge } from '../pwa/useCacheAge';

export interface StalenessBadgeProps {
  /** ISO-8601 timestamp of last successful cache write. null = no cache yet. */
  fetchedAt: string | null;
  /** Invoked when the user taps the badge — App should retry fetchGuestsCached. */
  onRefresh: () => void;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export default function StalenessBadge({ fetchedAt, onRefresh }: StalenessBadgeProps) {
  const online = useOnlineStatus();
  const ageMs = useCacheAge(fetchedAt);

  // Offline takes priority (D-09 — no modal, no blocker, just a muted badge).
  if (!online) {
    return (
      <button
        type="button"
        className="staleness-badge staleness-badge-offline"
        onClick={onRefresh}
        aria-label="Offline — showing cached guest list. Tap to retry."
      >
        Offline — showing cached list
      </button>
    );
  }

  // Silent when we have no cache to describe, or it's fresher than 1h (D-07).
  if (ageMs === null || ageMs < ONE_HOUR_MS) {
    return null;
  }

  // Muted "Updated Xm ago" badge (D-08).
  const minutes = Math.floor(ageMs / 60_000);
  return (
    <button
      type="button"
      className="staleness-badge staleness-badge-stale"
      onClick={onRefresh}
      aria-label={`Guest list updated ${minutes} minutes ago. Tap to refresh.`}
    >
      Updated {minutes}m ago
    </button>
  );
}
