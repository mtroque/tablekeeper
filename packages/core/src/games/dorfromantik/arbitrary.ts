import * as fc from 'fast-check';

import type { DorfromantikState } from './schema';

const countArb = fc.integer({ min: 0, max: 999 });

const extrasArb: fc.Arbitrary<DorfromantikState['extras']> = fc.record(
  {
    'DOR-E-GOLDHEART': countArb,
    'DOR-E-BALLOON': countArb,
    'DOR-E-CONSTRUCTION': countArb,
    'DOR-E-HILL': countArb,
    'DOR-E-SHEPHERDESS': countArb,
    'DOR-E-SIGNALMAN': countArb,
    'DOR-E-CIRCUS': fc.boolean(),
    'DOR-E-REDHEARTS': countArb,
    'DOR-E-HARBOR': countArb,
    'DOR-E-TRAINSTATION': countArb,
    'DOR-E-SHIP': countArb,
    'DOR-E-LOCOMOTIVE': countArb,
    'DOR-E-WATCHTOWER': countArb,
    'DOR-E-HARVEST': countArb,
    'DOR-E-CABIN': countArb,
  },
  { requiredKeys: [] },
);

const playerNameArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => s.trim())
  .filter((s) => s.length >= 1);

export const dorfromantikStateArbitrary: fc.Arbitrary<DorfromantikState> = fc
  .record({
    gameNumber: fc.integer({ min: 1, max: 200 }),
    tasks: fc.record({
      forest: countArb,
      grain: countArb,
      village: countArb,
      track: countArb,
      stream: countArb,
    }),
    flags: fc.record({
      green: countArb,
      yellow: countArb,
      red: countArb,
    }),
    longest: fc.record({
      track: countArb,
      stream: countArb,
    }),
    extras: extrasArb,
    players: fc.option(fc.array(playerNameArb, { minLength: 0, maxLength: 6 }), {
      nil: undefined,
    }),
  })
  .map(({ players, ...rest }) => (players !== undefined ? { ...rest, players } : rest));
