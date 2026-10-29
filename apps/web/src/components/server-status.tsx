'use client';

import { LoaderCircle, WifiOff } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { api } from '@/lib/api';

type Health = 'checking' | 'slow' | 'settled';

/**
 * How long `/health` may take before we say the server is waking up (Render cold start). Above
 * the API client's 1500ms retry delay, so a blocked `/health` settles before the line shows.
 */
const SLOW_AFTER_MS = 2500;
const GIVE_UP_AFTER_MS = 75_000;

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/**
 * Pings `/health` on load (fire and forget, so the API starts waking) and shows a quiet line
 * while it's slow or when the browser is offline. A failed `/health` shows nothing: ad blockers
 * block it while the API is up, and each feature reports its own failed calls. Nothing here
 * blocks the page.
 */
export function ServerStatus() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [health, setHealth] = useState<Health>('checking');

  useEffect(() => {
    let unmounted = false;
    const controller = new AbortController();
    const slow = setTimeout(() => {
      setHealth('slow');
    }, SLOW_AFTER_MS);
    const giveUp = setTimeout(() => {
      controller.abort();
    }, GIVE_UP_AFTER_MS);
    api()
      .health(controller.signal)
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(slow);
        clearTimeout(giveUp);
        if (!unmounted) setHealth('settled');
      });
    return () => {
      unmounted = true;
      clearTimeout(slow);
      clearTimeout(giveUp);
      controller.abort();
    };
  }, []);

  if (!online) {
    return (
      <StatusLine icon={<WifiOff />} testId="status-offline">
        You&apos;re offline. Scoring still works; saving and rules need a connection.
      </StatusLine>
    );
  }
  if (health === 'slow') {
    return (
      <StatusLine
        icon={<LoaderCircle className="animate-spin motion-reduce:animate-none" />}
        testId="status-waking"
      >
        Waking up the server. This can take up to a minute.
      </StatusLine>
    );
  }
  return null;
}

function StatusLine({
  icon,
  testId,
  children,
}: {
  icon: React.ReactNode;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      data-testid={testId}
      className="flex items-center gap-2 border-b border-line bg-warn-soft px-4 py-2 text-sm text-ink [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:stroke-[1.5]"
    >
      {icon}
      {children}
    </div>
  );
}
