'use client';

import {
  dorfromantik,
  DorfromantikCampaignSchema,
  initialCampaign,
  type Campaign,
  type DorfromantikCampaign,
} from '@tablekeeper/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/components/auth-provider';
import type { SessionStore } from '@/lib/session-store/session-store';
import { sessionKeys, useSessionStore } from '@/lib/session-store/use-session-store';

export type ActiveCampaign = { id: string | null; state: DorfromantikCampaign };

/** A stored campaign read with the game's schema; none yet reads as a fresh one. */
export function readCampaign(campaign: Campaign | null): ActiveCampaign {
  if (!campaign) return { id: null, state: initialCampaign() };
  const parsed = DorfromantikCampaignSchema.safeParse(campaign.state);
  if (!parsed.success) throw new Error('The stored campaign is invalid.');
  return { id: campaign.id, state: parsed.data };
}

export async function writeCampaign(
  store: SessionStore,
  state: DorfromantikCampaign,
): Promise<ActiveCampaign> {
  return readCampaign(await store.saveCampaign(dorfromantik.id, state, dorfromantik.stateVersion));
}

/** The active campaign through the session store (device for guests, account when signed in). */
export function useCampaign() {
  const store = useSessionStore();
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const key = sessionKeys.campaign(dorfromantik.id, status === 'signed-in');

  const query = useQuery({
    queryKey: key,
    enabled: store !== null,
    queryFn: async () => {
      if (!store) throw new Error('Store not ready');
      return readCampaign(await store.getCampaign(dorfromantik.id));
    },
  });

  const save = useMutation({
    mutationFn: (state: DorfromantikCampaign) => {
      if (!store) throw new Error('Store not ready');
      return writeCampaign(store, state);
    },
    onSuccess: (campaign) => {
      queryClient.setQueryData(key, campaign);
    },
  });

  return { store, key, query, save };
}
