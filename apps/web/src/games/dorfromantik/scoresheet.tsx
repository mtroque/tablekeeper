'use client';

import {
  lockedRowCount,
  subtotals,
  visibleRows,
  type DorfromantikCampaign,
  type DorfromantikState,
  type ExtraRow,
} from '@tablekeeper/core';
import { Check, Plus, X } from 'lucide-react';

import { Counter } from '@/components/counter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_PLAYERS = 6;

type Tasks = DorfromantikState['tasks'];
type Flags = DorfromantikState['flags'];
type Longest = DorfromantikState['longest'];

const TASK_ROWS: Array<{ key: keyof Tasks; label: string }> = [
  { key: 'forest', label: 'Forest' },
  { key: 'grain', label: 'Grain' },
  { key: 'village', label: 'Village' },
  { key: 'track', label: 'Track' },
  { key: 'stream', label: 'Stream' },
];

const FLAG_ROWS: Array<{ key: keyof Flags; label: string }> = [
  { key: 'green', label: 'Green Flags' },
  { key: 'yellow', label: 'Yellow Flags' },
  { key: 'red', label: 'Red Flags' },
];

const LONGEST_ROWS: Array<{ key: keyof Longest; label: string }> = [
  { key: 'track', label: 'Longest Track' },
  { key: 'stream', label: 'Longest Stream' },
];

function Section({
  title,
  hint,
  subtotal,
  subtotalLabel,
  children,
}: {
  title: string;
  hint?: string;
  subtotal: number;
  subtotalLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 py-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
      <p
        className="flex items-baseline justify-between border-t border-line pt-3 font-semibold"
        data-testid={`subtotal-${subtotalLabel}`}
      >
        <span>{subtotalLabel}</span>
        <span className="tabular text-lg">{subtotal}</span>
      </p>
    </section>
  );
}

function YesNo({
  label,
  question,
  value,
  onChange,
}: {
  label: string;
  question: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={`${label}: ${question}`}
        className={cn(
          'flex size-11 items-center justify-center rounded-control border transition-colors duration-150 ease-calm',
          value ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface',
        )}
        onClick={() => {
          onChange(!value);
        }}
      >
        {value && <Check className="size-5 stroke-[1.5]" />}
      </button>
    </div>
  );
}

function ExtraRowInput({
  row,
  value,
  onChange,
}: {
  row: ExtraRow;
  value: number | boolean | undefined;
  onChange: (value: number | boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1" data-testid={`row-${row.id}`}>
      {row.input === 'yesno' ? (
        <YesNo label={row.label} question={row.counts} value={value === true} onChange={onChange} />
      ) : (
        <Counter
          label={row.label}
          value={typeof value === 'number' ? value : 0}
          onChange={onChange}
        />
      )}
      <p className="text-sm text-muted">
        {row.hint}. {row.input === 'count' ? `Enter: ${row.counts.toLowerCase()}.` : null}
      </p>
    </div>
  );
}

function Players({
  players,
  onChange,
}: {
  players: string[];
  onChange: (players: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {players.map((name, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            aria-label={`Player ${i + 1}`}
            className="h-11 min-w-0 flex-1 rounded-control border border-line bg-surface px-3"
            value={name}
            maxLength={40}
            placeholder={`Player ${i + 1}`}
            onChange={(event) => {
              onChange(players.map((p, j) => (j === i ? event.target.value : p)));
            }}
          />
          <Button
            variant="quiet"
            size="icon"
            aria-label={`Remove Player ${i + 1}`}
            onClick={() => {
              onChange(players.filter((_, j) => j !== i));
            }}
          >
            <X />
          </Button>
        </div>
      ))}
      {players.length < MAX_PLAYERS && (
        <Button
          variant="quiet"
          className="self-start"
          onClick={() => {
            onChange([...players, '']);
          }}
        >
          <Plus />
          Add Player
        </Button>
      )}
    </div>
  );
}

/** The paper scoresheet: base fields, then only the rows the campaign has unlocked. */
export function Scoresheet({
  campaign,
  sheet,
  onChange,
  footer,
}: {
  campaign: DorfromantikCampaign;
  sheet: DorfromantikState;
  onChange: (sheet: DorfromantikState) => void;
  footer: React.ReactNode;
}) {
  const rows = visibleRows(campaign);
  const locked = lockedRowCount(campaign);
  const parts = subtotals(sheet);
  const date = new Date().toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const setExtra = (row: ExtraRow, value: number | boolean) => {
    onChange({ ...sheet, extras: { ...sheet.extras, [row.id]: value } });
  };

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-3 border-b border-line px-4 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl">Game {sheet.gameNumber}</h2>
          <p className="text-muted">{date}</p>
        </div>
        <Players
          players={sheet.players ?? []}
          onChange={(players) => {
            const { players: _old, ...rest } = sheet;
            onChange(players.length > 0 ? { ...rest, players } : rest);
          }}
        />
      </section>

      <Section
        title="Completed Tasks"
        hint="Add up the task markers you completed, per type."
        subtotal={parts.tasks}
        subtotalLabel="Tasks"
      >
        {TASK_ROWS.map(({ key, label }) => (
          <Counter
            key={key}
            label={label}
            value={sheet.tasks[key]}
            onChange={(value) => {
              onChange({ ...sheet, tasks: { ...sheet.tasks, [key]: value } });
            }}
          />
        ))}
      </Section>

      <Section
        title="Flags and Longest"
        hint="Flags: tiles in closed territories with a flag of that color. Longest: tiles in the longest unbroken track and stream."
        subtotal={parts.flagsLongest}
        subtotalLabel="Flags and Longest"
      >
        {FLAG_ROWS.map(({ key, label }) => (
          <Counter
            key={key}
            label={label}
            value={sheet.flags[key]}
            onChange={(value) => {
              onChange({ ...sheet, flags: { ...sheet.flags, [key]: value } });
            }}
          />
        ))}
        {LONGEST_ROWS.map(({ key, label }) => (
          <Counter
            key={key}
            label={label}
            value={sheet.longest[key]}
            onChange={(value) => {
              onChange({ ...sheet, longest: { ...sheet.longest, [key]: value } });
            }}
          />
        ))}
      </Section>

      <Section
        title="Unlocked Components"
        subtotal={parts.unlocked}
        subtotalLabel="Unlocked Components"
      >
        {rows.map((row) => (
          <ExtraRowInput
            key={row.id}
            row={row}
            value={sheet.extras[row.id]}
            onChange={(value) => {
              setExtra(row, value);
            }}
          />
        ))}
        {locked > 0 && (
          <p className="text-muted" data-testid="locked-count">
            {locked === 1 ? '1 row still locked.' : `${locked} rows still locked.`}
          </p>
        )}
      </Section>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-bg px-4 py-4">
        <p className="flex items-baseline justify-between">
          <span className="text-lg font-semibold">Total</span>
          <span className="font-display text-3xl tabular" data-testid="sheet-total">
            {parts.total}
          </span>
        </p>
        {footer}
      </div>
    </div>
  );
}
