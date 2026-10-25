import { GAMES, toGameSummary, type GamesResponse } from '@tablekeeper/core';
import { Router } from 'express';

export function gamesRouter(): Router {
  const router = Router();
  router.get('/games', (_req, res) => {
    const body: GamesResponse = { games: GAMES.map(toGameSummary) };
    res.json(body);
  });
  return router;
}
