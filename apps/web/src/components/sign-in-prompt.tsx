'use client';

import { useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';

/** Contextual sign-in, shown in place of a feature that needs an account. */
export function SignInPrompt({
  title,
  children,
  beforeSignIn,
}: {
  title: string;
  children: React.ReactNode;
  /** Runs just before the Google redirect, e.g. to keep a result for saving on return. */
  beforeSignIn?: () => void;
}) {
  const { signInWithGoogle } = useAuth();
  const [failed, setFailed] = useState(false);

  return (
    <section className="flex flex-col gap-3 border-y border-line px-4 py-5">
      <h2 className="text-lg">{title}</h2>
      <p className="text-muted">{children}</p>
      {failed && (
        <p className="text-danger" role="alert">
          Couldn&apos;t start Google sign-in. Try again.
        </p>
      )}
      <Button
        onClick={() => {
          setFailed(false);
          beforeSignIn?.();
          signInWithGoogle().catch(() => {
            setFailed(true);
          });
        }}
      >
        Sign In with Google
      </Button>
    </section>
  );
}
