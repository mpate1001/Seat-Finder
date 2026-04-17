import { useEffect, useState } from 'react';

/**
 * Subscribes to the browser's online/offline state.
 * StrictMode-safe: cleanup removes both listeners.
 *
 * Caveat (RESEARCH.md §5): navigator.onLine === true does NOT prove real
 * connectivity (captive portals, firewalls lie). Only use `false` as a
 * UI hint; rely on fetch failure for the definitive signal.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
