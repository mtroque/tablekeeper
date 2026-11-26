import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const FIRST_PLAYER_HREF = '/tools/first-player';

/** The table split into wedges with numbered markers, drawn from the tool's own screen. */
function WedgeMotif({ className }: { className?: string }) {
  const fills = ['var(--accent-soft)', 'var(--warn-soft)', 'var(--accent)'];
  const wedges = [
    { d: 'M32 32L32 2A30 30 0 0 1 58 47Z', marker: [46, 22] },
    { d: 'M32 32L58 47A30 30 0 0 1 6 47Z', marker: [32, 50] },
    { d: 'M32 32L6 47A30 30 0 0 1 32 2Z', marker: [18, 22] },
  ] as const;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {wedges.map((wedge, i) => (
        <path
          key={wedge.d}
          d={wedge.d}
          fill={fills[i]}
          stroke="var(--muted)"
          strokeOpacity="0.6"
          strokeWidth="1"
        />
      ))}
      {wedges.map((wedge, i) => (
        <circle
          key={`marker-${wedge.d}`}
          cx={wedge.marker[0]}
          cy={wedge.marker[1]}
          r="5"
          fill={i === 2 ? 'var(--on-accent)' : 'var(--surface)'}
          stroke="var(--ink)"
          strokeOpacity="0.5"
        />
      ))}
      <circle cx="32" cy="32" r="7" fill="var(--surface)" stroke="var(--ink)" strokeOpacity="0.5" />
    </svg>
  );
}

/** "Table Tools" at the foot of the game library: utilities for any game, supported or not. */
export function TableTools() {
  return (
    <section aria-labelledby="table-tools-heading" className="flex flex-col gap-3 pt-2">
      <h2 id="table-tools-heading" className="text-xl">
        Table Tools
      </h2>
      <Link
        href={FIRST_PLAYER_HREF}
        className="flex items-center gap-4 rounded-card border border-line bg-surface p-3 transition-colors duration-150 ease-calm hover:border-muted"
      >
        <WedgeMotif className="size-16 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-lg leading-tight">Who Goes First</h3>
          <p className="text-sm text-muted">
            Each player taps where they sit and the phone picks one. Works for any game.
          </p>
        </div>
      </Link>
    </section>
  );
}

/** Small link in a game hub's header; the hub's tabs come from the game's features. */
export function FirstPlayerHubLink() {
  return (
    <Link
      href={FIRST_PLAYER_HREF}
      className={cn(
        buttonVariants({ variant: 'secondary', size: 'default' }),
        'ml-auto w-24 px-2 text-center text-sm leading-tight whitespace-normal',
      )}
    >
      Who Goes First
    </Link>
  );
}
