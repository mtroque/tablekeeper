'use client';

import { useMemo } from 'react';

import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api';

import { ApiStore } from './api-store';
import { LocalStore } from './local-store';
import { resumePendingSaveWith } from './pending-save';
import type { SessionStore } from './session-store';

/** `ApiStore` when signed in, `LocalStore` for guests; null while auth is loading. */
export function useSessionStore(): SessionStore | null {
  const { status } = useAuth();
  return useMemo(() => {
    if (status === 'loading') return null;
    return status === 'signed-in' ? new ApiStore(api()) : new LocalStore(localStorage);
  }, [status]);
}

/** For `/auth/callback`: saves a guest's pending result to the account just signed in to. */
export function resumePendingSave(): Promise<string | null> {
  return resumePendingSaveWith(sessionStorage, new ApiStore(api()));
}

/** Query keys for session data, so a save can refresh history. */
export const sessionKeys = {
  list: (gameId: string) => ['sessions', gameId] as const,
  detail: (id: string) => ['session', id] as const,
  campaign: (gameId: string, signedIn: boolean) => ['campaign', gameId, signedIn] as const,
};
