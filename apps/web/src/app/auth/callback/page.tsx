'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { RETURN_TO_KEY } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';

/** Only same-site paths, so the return address can't send anyone elsewhere. */
function safeReturnTo(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}

/** OAuth return. The Supabase client exchanges the code on load; then we go back where sign-in started. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const finish = async () => {
      if (new URLSearchParams(window.location.search).has('error')) return false;
      const { data, error } = await supabase().auth.getSession();
      if (error || !data.session) return false;
      let returnTo: string | null = null;
      try {
        returnTo = sessionStorage.getItem(RETURN_TO_KEY);
        sessionStorage.removeItem(RETURN_TO_KEY);
      } catch {
        // No storage: go to the library.
      }
      router.replace(safeReturnTo(returnTo));
      return true;
    };
    void finish().then((ok) => {
      if (!ok) setFailed(true);
    });
  }, [router]);

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
