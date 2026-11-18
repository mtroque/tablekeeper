import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { exampleStateArbitrary } from '../games/_example/arbitrary';
import { exampleGame } from '../games/_example/index';
import { azulStateArbitrary } from '../games/azul/arbitrary';
import { azul } from '../games/azul/index';
import { dorfromantikStateArbitrary } from '../games/dorfromantik/arbitrary';
import { dorfromantik } from '../games/dorfromantik/index';
import { harmoniesStateArbitrary } from '../games/harmonies/arbitrary';
import { harmonies } from '../games/harmonies/index';
import { patchworkStateArbitrary } from '../games/patchwork/arbitrary';
import { patchwork } from '../games/patchwork/index';
import { fcParams } from '../kit/properties';
import type { GameDefinition } from '../kit/types';

import {
  KnownGameIdSchema,
  PatchSessionRequestSchema,
  SaveSessionRequestSchema,
  SessionStatusSchema,
} from './sessions';

const GAME_ENTRIES: ReadonlyArray<{ game: GameDefinition; arb: fc.Arbitrary<unknown> }> = [
  { game: patchwork, arb: patchworkStateArbitrary },
  { game: azul, arb: azulStateArbitrary },
  { game: harmonies, arb: harmoniesStateArbitrary },
  { game: dorfromantik, arb: dorfromantikStateArbitrary },
  { game: exampleGame, arb: exampleStateArbitrary },
];

const statusArb = fc.constantFrom(...SessionStatusSchema.options);

describe('session contracts property tests', () => {
  for (const { game, arb } of GAME_ENTRIES) {
    it(`accepts valid save and patch session requests for ${game.id}`, () => {
      fc.assert(
        fc.property(arb, statusArb, (state, status) => {
          const saveResult = SaveSessionRequestSchema.safeParse({
            gameId: game.id,
            status,
            state,
            stateVersion: game.stateVersion,
          });
          expect(saveResult.success).toBe(true);
          expect(game.stateSchema.safeParse(state).success).toBe(true);

          const patchResult = PatchSessionRequestSchema.safeParse({
            status,
            state,
            stateVersion: game.stateVersion,
          });
          expect(patchResult.success).toBe(true);
        }),
        fcParams(),
      );
    });

    it(`rejects states from other games for ${game.id}`, () => {
      const others = GAME_ENTRIES.filter((entry) => entry.game.id !== game.id);
      for (const other of others) {
        fc.assert(
          fc.property(other.arb, (otherState) => {
            expect(game.stateSchema.safeParse(otherState).success).toBe(false);
          }),
          fcParams({ numRuns: 20 }),
        );
      }
    });
  }

  it('rejects unknown game ids and malformed request payloads', () => {
    const badGameIdArb = fc
      .string({ minLength: 0, maxLength: 20 })
      .filter((s) => !GAME_ENTRIES.some((e) => e.game.id === s));

    fc.assert(
      fc.property(badGameIdArb, (badId) => {
        expect(KnownGameIdSchema.safeParse(badId).success).toBe(false);
      }),
      fcParams(),
    );

    fc.assert(
      fc.property(fc.anything(), (wrongState) => {
        expect(PatchSessionRequestSchema.safeParse({ state: wrongState }).success).toBe(false);
      }),
      fcParams(),
    );
  });
});
