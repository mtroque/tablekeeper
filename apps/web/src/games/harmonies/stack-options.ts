import {
  HARMONIES_STACKS,
  sameScoreStacks,
  stackCode,
  stackName,
  stackPieces,
  type HarmoniesPiece,
  type HarmoniesStackCode,
} from '@tablekeeper/core';

/** One choice in the stack sheet: a stack, or a group of stacks that always score the same. */
export type StackOption = {
  /** The stored stack's code (`empty` for an empty space); also the button's `data-stack`. */
  id: string;
  label: string;
  /** What picking it stores, unless the space already holds one of `codes`. */
  stack: readonly HarmoniesPiece[];
  /** Every stack this option stands for. */
  codes: readonly HarmoniesStackCode[];
};

/** Group names, where `stackName` would name only the stored member. */
const LABELS: Partial<Record<HarmoniesStackCode, string>> = {
  T: 'Trunks',
  R: 'Lone Roof',
  MR: 'Building',
};

const option = (code: HarmoniesStackCode): StackOption => {
  const stack = stackPieces(code);
  return { id: code, label: LABELS[code] ?? stackName(stack), stack, codes: sameScoreStacks(code) };
};

/**
 * Empty first, then one option per valid stack (`HAR-STACK-5`), with `T`/`TT` as "Trunks" and
 * `MR`/`TR`/`RR` as "Building" (`HARMONIES_SAME_SCORE`).
 */
export const STACK_OPTIONS: readonly StackOption[] = [
  { id: 'empty', label: 'Empty Space', stack: [], codes: [''] },
  ...HARMONIES_STACKS.filter((code) => sameScoreStacks(code)[0] === code).map(option),
];

/** Whether the space's stack is one this option stands for. */
export function isPicked(choice: StackOption, current: readonly HarmoniesPiece[]): boolean {
  return choice.codes.includes(stackCode(current));
}

/** The stack to store: the space's own when it's already one of the option's, else the option's. */
export function pickedStack(
  choice: StackOption,
  current: readonly HarmoniesPiece[],
): HarmoniesPiece[] {
  return [...(isPicked(choice, current) ? current : choice.stack)];
}

/**
 * The choices a photo-read top leaves open, since height can't be seen from above
 * (docs/games/harmonies.md → Valid stacks), with their short labels. Water and fields have none.
 */
const CHOICES: Partial<
  Record<HarmoniesPiece, { color: string; options: Array<[HarmoniesStackCode, string?]> }>
> = {
  M: {
    color: 'gray',
    options: [
      ['M', '1'],
      ['MM', '2'],
      ['MMM', '3'],
    ],
  },
  L: {
    color: 'green',
    options: [
      ['L', 'Leaves Only'],
      ['TL', '1 Trunk'],
      ['TTL', '2 Trunks'],
    ],
  },
  T: { color: 'brown', options: [['T']] },
  R: { color: 'red', options: [['R'], ['MR']] },
};

export type TopChoices = {
  /** The top token's color, e.g. "gray". */
  color: string;
  options: Array<StackOption & { short: string }>;
};

/** The sheet's first view for a space whose top came from a photo, or null for the full list. */
export function topChoices(top: HarmoniesPiece | undefined): TopChoices | null {
  const choices = top ? CHOICES[top] : undefined;
  if (!choices) return null;
  return {
    color: choices.color,
    options: choices.options.map(([code, short]) => {
      const full = option(code);
      return { ...full, short: short ?? full.label };
    }),
  };
}
