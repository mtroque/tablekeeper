'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Counter } from '@/components/counter';
import { Button } from '@/components/ui/button';

export type Card = { points: number };

/** A list of scored cards, each one a points counter (`HAR-ANIMAL-1`, `HAR-SPIRIT-1`). */
export function CardList({
  title,
  item,
  empty,
  cards,
  onChange,
}: {
  title: string;
  /** Singular name of one card, in Title Case. */
  item: string;
  /** What goes here, shown while the list is empty. */
  empty: string;
  cards: readonly Card[];
  onChange: (cards: Card[]) => void;
}) {
  const total = cards.reduce((sum, card) => sum + card.points, 0);
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {cards.length > 0 && <span className="text-muted tabular">{total}</span>}
      </div>
      {cards.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      <ul className="flex flex-col gap-1">
        {cards.map((card, i) => (
          <li key={i} className="flex items-center gap-1">
            <Counter
              className="flex-1"
              label={`${item} ${i + 1}`}
              value={card.points}
              onChange={(points) => {
                onChange(cards.map((c, j) => (j === i ? { points } : c)));
              }}
            />
            <Button
              variant="quiet"
              size="icon"
              aria-label={`Remove ${item} ${i + 1}`}
              onClick={() => {
                onChange(cards.filter((_, j) => j !== i));
              }}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        onClick={() => {
          onChange([...cards, { points: 0 }]);
        }}
      >
        <Plus />
        Add {item}
      </Button>
    </section>
  );
}
