import { GamesResponseSchema } from '@tablekeeper/core';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from './app';
import { createLogger } from './logger';
import { errorHandler } from './middleware/errors';
import { validate } from './middleware/validate';
import { errorBody, offlineConfig } from './test/helpers';

const app = createApp(offlineConfig({ WEB_ORIGINS: 'http://localhost:3000' }));

describe('GET /health', () => {
  it('answers ok with a request id', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['x-request-id']).toMatch(/^[\w-]+$/);
  });

  it('keeps a well-formed incoming request id', async () => {
    const res = await request(app).get('/health').set('x-request-id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });
});

describe('GET /v1/games', () => {
  it('returns the registry summary', async () => {
    const res = await request(app).get('/v1/games');
    expect(res.status).toBe(200);
    const body = GamesResponseSchema.parse(res.body);
    expect(body.games.map((game) => game.id)).toEqual([
      'patchwork',
      'azul',
      'harmonies',
      'dorfromantik',
    ]);
    expect(body.games.find((game) => game.id === 'dorfromantik')?.features.campaign).toBe(true);
  });
});

describe('error envelope', () => {
  it('answers unknown routes with NOT_FOUND', async () => {
    const res = await request(app).get('/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: "That route wasn't found." } });
  });

  it('answers bad JSON with VALIDATION', async () => {
    const res = await request(app)
      .post('/v1/games')
      .set('content-type', 'application/json')
      .send('{oops');
    expect(res.status).toBe(400);
    expect(errorBody(res).code).toBe('VALIDATION');
  });

  it('turns unknown errors into INTERNAL with the request id', async () => {
    const broken = express();
    broken.use((req, _res, next) => {
      req.id = 'req-1';
      next();
    });
    broken.get('/boom', () => {
      throw new Error('secret detail');
    });
    broken.use(errorHandler(createLogger({ logLevel: 'silent' })));
    const res = await request(broken).get('/boom');
    expect(res.status).toBe(500);
    expect(errorBody(res).code).toBe('INTERNAL');
    expect(errorBody(res).message).toContain('req-1');
    expect(errorBody(res).message).not.toContain('secret detail');
  });
});

describe('validate', () => {
  const echo = express();
  echo.use(express.json());
  echo.get(
    '/items/:id',
    validate({
      params: z.object({ id: z.uuid() }),
      query: z.object({ limit: z.coerce.number().int().max(50).default(10) }),
    }),
    (req, res) => {
      res.json({ id: req.params.id, limit: req.query.limit });
    },
  );
  echo.use(errorHandler(createLogger({ logLevel: 'silent' })));

  it('replaces params and query with the parsed values', async () => {
    const id = '6f1c7a8e-3c1e-4d4f-9b7a-2d1f0e9c8b7a';
    const res = await request(echo).get(`/items/${id}?limit=5`);
    expect(res.body).toEqual({ id, limit: 5 });
  });

  it('reports every invalid field', async () => {
    const res = await request(echo).get('/items/nope?limit=99');
    expect(res.status).toBe(400);
    expect(errorBody(res).code).toBe('VALIDATION');
    expect(
      (errorBody(res).details as { issues: Array<{ in: string }> }).issues.map((issue) => issue.in),
    ).toEqual(['params', 'query']);
  });
});

describe('CORS', () => {
  it('allows configured origins only', async () => {
    const allowed = await request(app).options('/v1/me').set('origin', 'http://localhost:3000');
    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(allowed.headers['access-control-allow-headers']).toContain('authorization');

    const other = await request(app).get('/health').set('origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limit', () => {
  it('answers RATE_LIMITED past the burst limit on /v1', async () => {
    const limited = createApp(offlineConfig({ RATE_LIMIT_MAX: '2' }));
    await request(limited).get('/v1/games');
    await request(limited).get('/v1/games');
    const res = await request(limited).get('/v1/games');
    expect(res.status).toBe(429);
    expect(errorBody(res).code).toBe('RATE_LIMITED');
    expect((await request(limited).get('/health')).status).toBe(200);
  });
});
