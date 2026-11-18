'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** Replaces the current route with `href` once when `condition` becomes true. */
export function useRedirectWhen(condition: boolean, href: string): void {
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (!condition) {
      redirected.current = false;
      return;
    }
    if (redirected.current) return;
    redirected.current = true;
    router.replace(href);
  }, [condition, href, router]);
}
