import { stackPieces } from '@tablekeeper/core';
import { describe, expect, it } from 'vitest';

import { isPicked, pickedStack, STACK_OPTIONS, topChoices } from './stack-options';

const byId = (id: string) => {
  const found = STACK_OPTIONS.find((choice) => choice.id === id);
  if (!found) throw new Error(`no option ${id}`);
  return found;
};

describe('harmonies stack options', () => {
  it('HAR-STACK-5: empty plus one option per score-equivalent stack, no TT, TR or RR', () => {
    expect(STACK_OPTIONS.map((choice) => choice.id)).toEqual([
      'empty',
      'W',
      'F',
      'M',
      'MM',
      'MMM',
      'L',
      'TL',
      'TTL',
      'T',
      'R',
      'MR',
    ]);
    expect(byId('T')).toMatchObject({ label: 'Trunks', codes: ['T', 'TT'] });
    expect(byId('MR')).toMatchObject({ label: 'Building', codes: ['MR', 'TR', 'RR'] });
    expect(byId('R')).toMatchObject({ label: 'Lone Roof', codes: ['R'] });
    expect(byId('TTL').label).toBe('Tree on 2 Trunks');
  });

  it('a pick stores the option, or keeps a stack the option already stands for', () => {
    expect(pickedStack(byId('T'), stackPieces('TT'))).toEqual(stackPieces('TT'));
    expect(pickedStack(byId('T'), stackPieces('L'))).toEqual(stackPieces('T'));
    expect(pickedStack(byId('MR'), stackPieces('RR'))).toEqual(stackPieces('RR'));
    expect(pickedStack(byId('MR'), stackPieces('R'))).toEqual(stackPieces('MR'));
    expect(pickedStack(byId('empty'), stackPieces('W'))).toEqual([]);
    expect(isPicked(byId('MR'), stackPieces('TR'))).toBe(true);
    expect(isPicked(byId('R'), stackPieces('TR'))).toBe(false);
    expect(isPicked(byId('empty'), [])).toBe(true);
  });

  it('a photo-read top offers only the choices that change the score', () => {
    const short = (top: Parameters<typeof topChoices>[0]) =>
      topChoices(top)?.options.map((choice) => choice.short);
    expect(short('M')).toEqual(['1', '2', '3']);
    expect(short('L')).toEqual(['Leaves Only', '1 Trunk', '2 Trunks']);
    expect(short('T')).toEqual(['Trunks']);
    expect(short('R')).toEqual(['Lone Roof', 'Building']);
    expect(topChoices('W')).toBeNull();
    expect(topChoices('F')).toBeNull();
    expect(topChoices(undefined)).toBeNull();
    expect(topChoices('M')?.color).toBe('gray');
    expect(topChoices('R')?.options[1]?.codes).toEqual(['MR', 'TR', 'RR']);
  });
});
