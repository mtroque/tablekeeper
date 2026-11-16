import { describe, expect, it } from 'vitest';

import { loadConfig } from './config';

const base = {
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/tablekeeper',
  NEON_AUTH_BASE_URL: 'http://127.0.0.1:9/auth',
};

describe('loadConfig', () => {
  it('applies the .env.example defaults', () => {
    const config = loadConfig(base);
    expect(config.port).toBe(4000);
    expect(config.databaseUrl).toBe(base.DATABASE_URL);
    expect(config.auth).toEqual({ baseUrl: base.NEON_AUTH_BASE_URL, testSecret: undefined });
    expect(config.webOrigins).toEqual(['http://localhost:3000']);
    expect(config.quotas.guestDailyRequests).toBe(5);
    expect(config.llm).toMatchObject({
      enabled: true,
      provider: 'anthropic',
      anthropicApiKey: undefined,
    });
    expect(config.rateLimit).toEqual({ windowMs: 60_000, max: 60, store: 'memory' });
  });

  it('treats empty values as unset and splits origins', () => {
    const config = loadConfig({
      ...base,
      ANTHROPIC_API_KEY: '',
      LLM_ENABLED: 'false',
      WEB_ORIGINS: 'http://localhost:3001, https://tablekeeper.example',
      API_PORT: '4002',
    });
    expect(config.llm.anthropicApiKey).toBeUndefined();
    expect(config.llm.enabled).toBe(false);
    expect(config.webOrigins).toEqual(['http://localhost:3001', 'https://tablekeeper.example']);
    expect(config.port).toBe(4002);
  });

  it('counts the burst limit in the database in production unless told otherwise', () => {
    const prod = { ...base, NODE_ENV: 'production', IP_HASH_SALT: 'real-salt' };
    expect(loadConfig(prod).rateLimit.store).toBe('database');
    expect(loadConfig({ ...prod, RATE_LIMIT_STORE: 'memory' }).rateLimit.store).toBe('memory');
    expect(loadConfig({ ...base, RATE_LIMIT_STORE: 'database' }).rateLimit.store).toBe('database');
  });

  it("prefers the host's PORT", () => {
    expect(loadConfig({ ...base, PORT: '10000', API_PORT: '4002' }).port).toBe(10000);
  });

  it('names every invalid variable', () => {
    expect(() => loadConfig({ NEON_AUTH_BASE_URL: 'nope', RATE_LIMIT_MAX: '-1' })).toThrow(
      /DATABASE_URL[\s\S]*NEON_AUTH_BASE_URL[\s\S]*RATE_LIMIT_MAX/,
    );
  });

  it('refuses the placeholder IP salt or test auth secret in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/IP_HASH_SALT/);
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: 'production',
        IP_HASH_SALT: 'real-salt',
        AUTH_TEST_SECRET: 'secret',
      }),
    ).toThrow(/AUTH_TEST_SECRET/);
  });
});
