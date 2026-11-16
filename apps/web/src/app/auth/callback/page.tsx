'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { RETURN_TO_KEY, useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { resumePendingSave } from '@/lib/session-store/use-session-store';

/** Only same-site paths, so the return address can't send anyone elsewhere. */
function safeReturnTo(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}

/** OAuth return. Neon Auth exchanges the session verifier on load; then we go back where sign-in started. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const finish = async () => {
      if (new URLSearchParams(window.location.search).has('error')) return false;
      const session = await refresh();
      if (!session) return false;
      let returnTo: string | null = null;
      try {
        returnTo = sessionStorage.getItem(RETURN_TO_KEY);
        sessionStorage.removeItem(RETURN_TO_KEY);
      } catch {
        // No storage: go to the library.
      }
      // A guest's result kept through sign-in is saved now, and that saved game opens.
      const resumed = await resumePendingSave();
      if (resumed) {
        router.replace(resumed);
        return true;
      }
      router.replace(safeReturnTo(returnTo));
      return true;
    };
    void finish().then((ok) => {
      if (!ok) setFailed(true);
    });
  }, [router, refresh]);

  if (failed) {
    return (
      <section className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <h1 className="text-2xl">Sign-In Failed</h1>
        <p className="text-muted">Couldn&apos;t finish signing in with Google.</p>
        <Button asChild variant="secondary">
          <Link href="/">Try Again</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center gap-3 px-6 py-16" role="status">
      <p className="text-muted">Signing you in.</p>
      <Skeleton className="h-4 w-40" />
    </section>
  );
}
