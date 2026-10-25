'use client';

import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Where to go after the OAuth round trip (sessionStorage survives the redirect). */
export const RETURN_TO_KEY = 'tk:v1:auth-return-to';

export type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'guest'; session: null }
  | { status: 'signed-in'; session: Session };

type AuthContextValue = AuthState & {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null });

  useEffect(() => {
    const client = supabase();
    const apply = (session: Session | null) => {
      setState(session ? { status: 'signed-in', session } : { status: 'guest', session: null });
    };
    void client.auth.getSession().then(({ data }) => {
      apply(data.session);
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      apply(session);
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN')
        queryClient.removeQueries({ queryKey: ['me'] });
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signInWithGoogle: async () => {
        try {
          sessionStorage.setItem(RETURN_TO_KEY, window.location.pathname + window.location.search);
        } catch {
          // Storage can be unavailable (private mode); sign-in then returns to the library.
        }
        const { error } = await supabase().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
      },
      signOut: async () => {
        await supabase().auth.signOut();
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth needs an AuthProvider');
  return value;
}
