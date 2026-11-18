import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../apps/api/src/app';
import { offlineConfig } from '../apps/api/src/test/helpers';
// The API's `req.auth` typing, which the root tsconfig doesn't otherwise see.
import type {} from '../apps/api/src/types/express';

import { formatResults, parseSmokeArgs, runSmoke, SMOKE_CHECKS } from './smoke';

const servers: Server[] = [];

async function serve(handler: RequestListener): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const page: RequestListener = (_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<html></html>');
};
const broken: RequestListener = (_req, res) => {
  res.writeHead(500, { 'content-type': 'application/json' }).end('{"error":"boom"}');
};

let apiUrl = '';
let webUrl = '';
let otherWebUrl = '';
let brokenUrl = '';

beforeAll(async () => {
  webUrl = await serve(page);
  otherWebUrl = await serve(page);
  brokenUrl = await serve(broken);
  // The real API with no database: every smoke check is read-only and never reaches it.
  apiUrl = await serve(createApp(offlineConfig({ WEB_ORIGINS: webUrl })));
});

afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((done) => s.close(done))));
});

const names = SMOKE_CHECKS.map((c) => c.name);

describe('runSmoke', () => {
  it('passes every check against the local API and a web page', async () => {
    const results = await runSmoke({ apiUrl, webUrl });
    expect(results.map((r) => r.name)).toEqual(names);
    expect(results.filter((r) => !r.ok)).toEqual([]);
  });

  it('fails every check by name against a stub returning 500', async () => {
    const results = await runSmoke({ apiUrl: brokenUrl, webUrl: brokenUrl });
    expect(results.map((r) => [r.name, r.ok])).toEqual(names.map((n) => [n, false]));
    expect(results.find((r) => r.name === 'me-unauthenticated')?.detail).toBe(
      'expected 401, got 500',
    );
    const output = formatResults({ apiUrl: brokenUrl, webUrl: brokenUrl }, results);
    for (const name of names) expect(output).toMatch(new RegExp(`^FAIL  ${name}\\b`, 'm'));
    expect(output).toContain('smoke: 0 of 5 checks passed');
  });

  it('fails cors when the API does not allow the web origin', async () => {
    const results = await runSmoke({ apiUrl, webUrl: otherWebUrl });
    const cors = results.find((r) => r.name === 'cors');
    expect(cors).toEqual({
      name: 'cors',
      ok: false,
      detail: `allow-origin is missing, expected ${otherWebUrl}`,
    });
  });

  it('reports an unreachable host instead of throwing', async () => {
    const results = await runSmoke(
      { apiUrl: 'http://127.0.0.1:9', webUrl: 'http://127.0.0.1:9' },
      { timeoutMs: 2_000 },
    );
    expect(results.every((r) => !r.ok && r.detail.startsWith('request failed'))).toBe(true);
  });
});

describe('parseSmokeArgs', () => {
  it('reads both URLs and drops trailing slashes', () => {
    expect(parseSmokeArgs(['--api', 'https://api.example/', '--web=https://web.example'])).toEqual({
      ok: true,
      value: { apiUrl: 'https://api.example', webUrl: 'https://web.example' },
    });
  });

  it('rejects a missing or non-http URL and unknown flags', () => {
    expect(parseSmokeArgs(['--api', 'https://api.example'])).toMatchObject({ ok: false });
    expect(parseSmokeArgs(['--api', 'ftp://x', '--web', 'https://w'])).toMatchObject({ ok: false });
    expect(parseSmokeArgs(['--prod'])).toMatchObject({ ok: false });
  });
});
