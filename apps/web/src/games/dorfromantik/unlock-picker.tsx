'use client';

import {
  addUnlocks,
  dorfromantik,
  MAX_RED_HEARTS,
  UNLOCKABLES,
  type DorfromantikCampaign,
  type UnlockId,
  type UnlockSection,
} from '@tablekeeper/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';

import { Counter } from '@/components/counter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { readCampaign, useCampaign, writeCampaign } from './use-campaign';

const SECTIONS: UnlockSection[] = ['Advancement Track', 'Achievements', 'Boxes'];

export type SavedUnlocks = { names: string[] };

/** Names of the picked items, hearts as a count. */
function describePicks(ids: UnlockId[], redHearts: number): string[] {
  const names = UNLOCKABLES.filter((item) => ids.includes(item.id)).map((item) => item.name);
  if (redHearts > 0) names.push(redHearts === 1 ? '1 Red Heart' : `${redHearts} Red Hearts`);
  return names;
}

function Pick({
  name,
  checked,
  disabled,
  onChange,
}: {
  name: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={disabled ? `${name}: already unlocked` : name}
      className={cn(
        'flex min-h-11 items-center justify-between gap-3 rounded-control border px-3 text-left transition-colors duration-150 ease-calm',
        checked && !disabled ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
        disabled && 'text-muted',
      )}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <span>{name}</span>
      {disabled ? (
        <span className="text-sm">Unlocked</span>
      ) : (
        checked && <Check className="size-5 stroke-[1.5] text-accent" />
      )}
    </button>
  );
}

/**
 * "Any Unlocks?": every campaign-sheet item by name only (spoiler-safe), Red Hearts as a
 * count of hearts to add.
 */
export function UnlockPicker({
  campaign,
  gameNumber,
  onDone,
}: {
  campaign: DorfromantikCampaign;
  gameNumber: number;
  onDone: (saved: SavedUnlocks) => void;
}) {
  const { store, key } = useCampaign();
  const queryClient = useQueryClient();
  const [ids, setIds] = useState<UnlockId[]>([]);
  const [hearts, setHearts] = useState(0);
  const [refused, setRefused] = useState(false);
  const heartsLeft = MAX_RED_HEARTS - campaign.redHearts;
  const others = UNLOCKABLES.filter((item) => item.id !== 'DOR-U-REDHEART');
  const nothingLeft = heartsLeft === 0 && others.every((i) => campaign.unlocked.includes(i.id));

  const save = useMutation({
    mutationFn: async () => {
      if (!store) throw new Error('Store not ready');
      // Read the campaign fresh, so another tab's change isn't overwritten.
      const fresh = readCampaign(await store.getCampaign(dorfromantik.id));
      const result = addUnlocks(fresh.state, { ids, redHearts: hearts }, gameNumber);
      if (!result.ok) return { refused: true as const, campaign: fresh };
      return { refused: false as const, campaign: await writeCampaign(store, result.value) };
    },
    onSuccess: ({ refused: wasRefused, campaign: saved }) => {
      queryClient.setQueryData(key, saved);
      if (wasRefused) {
        setRefused(true);
        setIds([]);
        setHearts(0);
        return;
      }
      onDone({ names: describePicks(ids, hearts) });
    },
  });

  if (nothingLeft) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Any Unlocks?</h2>
        <p className="text-muted">Everything is unlocked.</p>
      </section>
    );
  }

  const picked = ids.length > 0 || hearts > 0;

  return (
    <section className="flex flex-col gap-4" aria-label="Any Unlocks?">
      <h2 className="text-lg">Any Unlocks?</h2>
      {refused && (
        <p className="text-danger" role="alert">
          Some of those were already unlocked. Pick again.
        </p>
      )}
      {SECTIONS.map((section) => (
        <div key={section} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted">{section}</h3>
          {others
            .filter((item) => item.section === section)
            .map((item) => (
              <Pick
                key={item.id}
                name={item.name}
                checked={campaign.unlocked.includes(item.id) || ids.includes(item.id)}
                disabled={campaign.unlocked.includes(item.id)}
                onChange={(checked) => {
                  setIds(checked ? [...ids, item.id] : ids.filter((id) => id !== item.id));
                }}
              />
            ))}
          {section === 'Boxes' &&
            (heartsLeft > 0 ? (
              <div className="flex flex-col gap-1 rounded-control border border-line px-3 py-1">
                <Counter label="Red Hearts" value={hearts} max={heartsLeft} onChange={setHearts} />
                <p className="pb-2 text-sm text-muted">
                  {campaign.redHearts === 0
                    ? `Hearts gained this game, up to ${MAX_RED_HEARTS}.`
                    : `${campaign.redHearts} of ${MAX_RED_HEARTS} unlocked. ${heartsLeft} left.`}
                </p>
              </div>
            ) : (
              <Pick name="Red Hearts" checked disabled onChange={() => undefined} />
            ))}
        </div>
      ))}
      {save.isError && (
        <p className="text-danger" role="alert">
          Couldn&apos;t save the unlocks. Try again.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button
          disabled={!picked || save.isPending || !store}
          onClick={() => {
            setRefused(false);
            save.mutate();
          }}
        >
          {save.isPending ? 'Saving' : 'Save Unlocks'}
        </Button>
        <Button
          variant="secondary"
          disabled={save.isPending}
          onClick={() => {
            onDone({ names: [] });
          }}
        >
          No Unlocks
        </Button>
      </div>
    </section>
  );
}
