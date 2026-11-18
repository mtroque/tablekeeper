'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import {
  getAuthSession,
  signInWithGoogle as startGoogleSignIn,
  signOutUser,
  type AuthSession,
} from '@/lib/auth';
import { useOnMount } from '@/lib/hooks';

/** Where to go after the OAuth round trip (sessionStorage survives the redirect). */
export const RETURN_TO_KEY = 'tk:v1:auth-return-to';

export type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'guest'; session: null }
  | { status: 'signed-in'; session: AuthSession };

type AuthContextValue = AuthState & {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<AuthSession | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null });

  const refresh = useCallback(async (): Promise<AuthSession | null> => {
    const session = await getAuthSession();
    setState(session ? { status: 'signed-in', session } : { status: 'guest', session: null });
    return session;
  }, []);

  useOnMount(async (signal) => {
    const session = await getAuthSession();
    if (signal.aborted) return;
    setState(session ? { status: 'signed-in', session } : { status: 'guest', session: null });
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      refresh,
      signInWithGoogle: async () => {
        try {
          sessionStorage.setItem(RETURN_TO_KEY, window.location.pathname + window.location.search);
        } catch {
          // Storage can be unavailable (private mode); sign-in then returns to the library.
        }
        await startGoogleSignIn();
      },
      signOut: async () => {
        await signOutUser();
        setState({ status: 'guest', session: null });
        queryClient.removeQueries({ queryKey: ['me'] });
      },
    }),
    [state, refresh, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth needs an AuthProvider');
  return value;
}
