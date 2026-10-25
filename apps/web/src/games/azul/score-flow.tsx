'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { resumePendingSave } from '@/lib/session-store/use-session-store';

import type { ScoreFlowProps } from '../types';

import { AzulGame } from './game';
import { AZUL_SCORE, AzulScoreHome } from './score-home';

/** Where a pending save comes back to when saving after sign-in failed: try again. */
function RetryPendingSave() {
  const router = useRouter();
  const auth = useAuth();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (auth.status === 'guest') router.replace(AZUL_SCORE);
  }, [auth.status, router]);

  return (
    <section className="flex flex-col gap-3 px-4 py-5">
      <p role="alert">Couldn&apos;t save your game. Try again.</p>
      {failed && <p className="text-danger">Still couldn&apos;t save it.</p>}
      <Button
        disabled={saving || auth.status !== 'signed-in'}
        onClick={() => {
          setSaving(true);
          setFailed(false);
          void resumePendingSave().then((next) => {
            setSaving(false);
            if (next === null) router.push(AZUL_SCORE);
            else if (next === `${AZUL_SCORE}/result`) setFailed(true);
            else router.push(next);
          });
        }}
      >
        {saving ? 'Saving' : 'Save Game'}
      </Button>
    </section>
  );
}

/** `/score`: home; `/score/<sessionId>`: the game in progress; `/score/result`: save retry. */
export function ScoreFlow({ slug }: ScoreFlowProps) {
  const [first, ...rest] = slug;
  if (first === undefined) return <AzulScoreHome />;
  if (first === 'result' && rest.length === 0) return <RetryPendingSave />;
  if (rest.length === 0) return <AzulGame sessionId={first} />;
  return (
    <section className="flex flex-col gap-3 px-4 py-5">
      <p className="text-muted">There&apos;s no game here.</p>
      <Button asChild variant="quiet">
        <Link href={AZUL_SCORE}>Games in Progress</Link>
      </Button>
    </section>
  );
}
