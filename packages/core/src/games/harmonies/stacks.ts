import { z } from 'zod';

/** Token codes (docs/games/harmonies.md → Pieces). */
export const HarmoniesPieceSchema = z.enum(['W', 'F', 'M', 'T', 'L', 'R']);
export type HarmoniesPiece = z.infer<typeof HarmoniesPieceSchema>;

/** A stack listed bottom to top, e.g. `TTL`. */
export type HarmoniesStackCode = string;

/** Every stack the rules allow (`HAR-STACK-1` to `HAR-STACK-4`), in the order the editor offers them. */
export const HARMONIES_STACKS: readonly HarmoniesStackCode[] = [
  'W',
  'F',
  'M',
  'MM',
  'MMM',
  'L',
  'TL',
  'TTL',
  'T',
  'TT',
  'R',
  'MR',
  'TR',
  'RR',
];

const VALID = new Set(HARMONIES_STACKS);

export function stackCode(stack: readonly HarmoniesPiece[]): HarmoniesStackCode {
  return stack.join('');
}

export function stackPieces(code: HarmoniesStackCode): HarmoniesPiece[] {
  return Array.from({ length: code.length }, (_, i) => HarmoniesPieceSchema.parse(code.charAt(i)));
}

/** Any stack not listed is invalid (`HAR-STACK-5`). */
export function isValidStack(stack: readonly HarmoniesPiece[]): boolean {
  return VALID.has(stackCode(stack));
}

const NAMES: Record<HarmoniesStackCode, string> = {
  W: 'Water',
  F: 'Field',
  M: 'Mountain, Height 1',
  MM: 'Mountain, Height 2',
  MMM: 'Mountain, Height 3',
  L: 'Tree, Leaves Only',
  TL: 'Tree on 1 Trunk',
  TTL: 'Tree on 2 Trunks',
  T: 'Trunk',
  TT: '2 Trunks',
  R: 'Roof Alone',
  MR: 'Building on Mountain',
  TR: 'Building on Trunk',
  RR: 'Building on Roof',
};

/** How a stack is named in labels and the stack sheet. */
export function stackName(stack: readonly HarmoniesPiece[]): string {
  return stack.length === 0 ? 'Empty' : (NAMES[stackCode(stack)] ?? stackCode(stack));
}

export const isHarmoniesMountain = (stack: readonly HarmoniesPiece[]) =>
  stack.length > 0 && stack.every((piece) => piece === 'M');

export const isHarmoniesBuilding = (stack: readonly HarmoniesPiece[]) =>
  stack.length === 2 && stack[1] === 'R';
