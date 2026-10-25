'use client';

import { CloudOff, LoaderCircle, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type Health = 'checking' | 'slow' | 'ok' | 'down';

/** How long `/health` may take before we say the server is waking up (Render cold start). */
const SLOW_AFTER_MS = 1500;
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
 * while it's slow, if it fails, or when the browser is offline. Nothing here blocks the page.
 */
export function ServerStatus() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [health, setHealth] = useState<Health>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const slow = setTimeout(() => {
      setHealth('slow');
    }, SLOW_AFTER_MS);
    const giveUp = setTimeout(() => {
      controller.abort();
    }, GIVE_UP_AFTER_MS);
    api()
      .health(controller.signal)
      .then(() => {
        setHealth('ok');
      })
      .catch(() => {
        setHealth('down');
      })
      .finally(() => {
        clearTimeout(slow);
        clearTimeout(giveUp);
      });
    return () => {
      clearTimeout(slow);
      clearTimeout(giveUp);
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setHealth('checking');
    setAttempt((n) => n + 1);
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
  if (health === 'down') {
    return (
      <StatusLine icon={<CloudOff />} testId="status-down">
        <span className="flex-1">Couldn&apos;t reach the server. Scoring still works.</span>
        <Button variant="quiet" size="small" onClick={retry}>
          Retry
        </Button>
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
