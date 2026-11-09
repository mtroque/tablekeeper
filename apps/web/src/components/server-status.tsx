'use client';

import { WifiOff } from 'lucide-react';
import { useSyncExternalStore } from 'react';

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/**
 * A quiet line while the browser is offline. The API never sleeps (it runs on Vercel), so
 * nothing is pinged on load; each feature reports its own failed calls. Never blocks the page.
 */
export function ServerStatus() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  return <ServerStatusLine online={online} />;
}

export function ServerStatusLine({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div
      role="status"
      data-testid="status-offline"
      className="flex items-center gap-2 border-b border-line bg-warn-soft px-4 py-2 text-sm text-ink [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:stroke-[1.5]"
    >
      <WifiOff />
      You&apos;re offline. Scoring still works; saving and rules need a connection.
    </div>
  );
}
