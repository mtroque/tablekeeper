'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

import { useAuth } from './auth-provider';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase() ||
    '?'
  );
}

/** Header sign-in button for guests; avatar and account sheet when signed in. */
export function AccountMenu() {
  const auth = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const signedIn = auth.status === 'signed-in';
  const me = useQuery({ queryKey: ['me'], queryFn: () => api().me(), enabled: signedIn });

  if (auth.status === 'loading') {
    return <Skeleton className="h-11 w-24" data-testid="account-loading" />;
  }

  if (auth.status === 'guest') {
    return (
      <Button
        variant="secondary"
        disabled={signingIn}
        onClick={() => {
          setSigningIn(true);
          auth.signInWithGoogle().catch(() => {
            setSigningIn(false);
            toast.error("Couldn't start Google sign-in. Try again.");
          });
        }}
      >
        Sign In
      </Button>
    );
  }

  const email = auth.session.user.email ?? null;
  const metaName: unknown = auth.session.user.user_metadata.full_name;
  const fallbackName =
    typeof metaName === 'string' && metaName ? metaName : (email ?? 'Your Account');
  const name = me.data?.displayName ?? fallbackName;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Account: ${name}`}
          className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-accent-soft font-semibold text-ink"
        >
          {initials(name)}
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          {me.isPending ? (
            <Skeleton className="h-7 w-40" />
          ) : (
            <SheetTitle data-testid="account-name">{name}</SheetTitle>
          )}
          <SheetDescription>{email ?? 'Signed in with Google'}</SheetDescription>
        </SheetHeader>
        {me.isError ? (
          <p className="text-sm text-muted">
            Couldn&apos;t load your profile. Showing your email instead.
          </p>
        ) : null}
        <Button
          variant="secondary"
          onClick={() => {
            auth.signOut().catch(() => toast.error("Couldn't sign out. Try again."));
          }}
        >
          Sign Out
        </Button>
      </SheetContent>
    </Sheet>
  );
}
