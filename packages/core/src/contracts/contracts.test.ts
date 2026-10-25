import { describe, expect, it } from 'vitest';

import { GAMES } from '../games/registry';

import { ERROR_STATUS, ErrorCodeSchema, ErrorEnvelopeSchema } from './errors';
import { GamesResponseSchema, toGameSummary } from './games';
import { HealthResponseSchema } from './health';
import { MeResponseSchema } from './me';

describe('contracts', () => {
  it('maps every error code to a status', () => {
    for (const code of ErrorCodeSchema.options) {
      expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
    }
    expect(ERROR_STATUS.UNAUTHENTICATED).toBe(401);
  });

  it('parses the error envelope and rejects unknown codes', () => {
    const envelope = { error: { code: 'NOT_FOUND', message: 'No such game.' } };
    expect(ErrorEnvelopeSchema.parse(envelope)).toEqual(envelope);
    expect(ErrorEnvelopeSchema.safeParse({ error: { code: 'TEAPOT', message: '' } }).success).toBe(
      false,
    );
  });

  it('summarizes every registered game into a valid games response', () => {
    const response = { games: GAMES.map(toGameSummary) };
    expect(GamesResponseSchema.parse(response).games).toHaveLength(4);
    expect(response.games[0]).toMatchObject({
      id: 'patchwork',
      rulebookUrl: GAMES[0]?.rulebook.publisherUrl,
    });
  });

  it('accepts health and me responses', () => {
    expect(HealthResponseSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(HealthResponseSchema.safeParse({ ok: false }).success).toBe(false);
    const me = { id: '6f1c7a8e-3c1e-4d4f-9b7a-2d1f0e9c8b7a', displayName: 'Sam', email: null };
    expect(MeResponseSchema.parse(me)).toEqual(me);
  });
});

describe('game ids', () => {
  it('match the registry', async () => {
    const { GameIdSchema } = await import('./games');
    expect(GameIdSchema.options).toEqual(GAMES.map((game) => game.id));
  });
});
