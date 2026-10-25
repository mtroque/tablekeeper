'use client';

import { exampleGame, ExampleCampaignSchema } from '@tablekeeper/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { Counter } from '@/components/counter';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { sessionKeys, useSessionStore } from '@/lib/session-store/use-session-store';

/** A games-played counter, enough to exercise campaign storage for guests and accounts. */
export function Campaign() {
  const store = useSessionStore();
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const key = sessionKeys.campaign(exampleGame.id, status === 'signed-in');
  const [edited, setEdited] = useState<number | null>(null);

  const query = useQuery({
    queryKey: key,
    enabled: store !== null,
    queryFn: async () => (store ? store.getCampaign(exampleGame.id) : null),
  });
  const save = useMutation({
    mutationFn: async (gamesPlayed: number) => {
      if (!store) throw new Error('Store not ready');
      return store.saveCampaign(exampleGame.id, { gamesPlayed }, 1);
    },
    onSuccess: (campaign) => {
      queryClient.setQueryData(key, campaign);
      setEdited(null);
    },
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3 px-4 py-5" aria-busy="true">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex flex-col gap-3 px-4 py-5" role="alert">
        <p>Couldn&apos;t load the campaign.</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  const stored = ExampleCampaignSchema.safeParse(query.data?.state);
  const gamesPlayed = edited ?? (stored.success ? stored.data.gamesPlayed : 0);

  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h2 className="text-lg">Campaign</h2>
      <Counter label="Games Played" value={gamesPlayed} onChange={setEdited} />
      {save.isError && (
        <p className="text-danger" role="alert">
          Couldn&apos;t save the campaign. Try again.
        </p>
      )}
      <Button
        disabled={edited === null || save.isPending}
        onClick={() => {
          save.mutate(gamesPlayed);
        }}
      >
        Save Campaign
      </Button>
    </section>
  );
}
