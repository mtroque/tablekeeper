import { describe, expect, it } from 'vitest';

import { loadConfig } from './config';

const base = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

describe('loadConfig', () => {
  it('applies the .env.example defaults', () => {
    const config = loadConfig(base);
    expect(config.port).toBe(4000);
    expect(config.webOrigins).toEqual(['http://localhost:3000']);
    expect(config.quotas.guestDailyRequests).toBe(5);
    expect(config.llm).toMatchObject({
      enabled: true,
      provider: 'anthropic',
      anthropicApiKey: undefined,
    });
    expect(config.rateLimit).toEqual({ windowMs: 60_000, max: 60 });
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

  it("prefers Render's PORT", () => {
    expect(loadConfig({ ...base, PORT: '10000', API_PORT: '4002' }).port).toBe(10000);
  });

  it('names every invalid variable', () => {
    expect(() => loadConfig({ SUPABASE_URL: 'nope', RATE_LIMIT_MAX: '-1' })).toThrow(
      /SUPABASE_URL[\s\S]*SUPABASE_ANON_KEY[\s\S]*RATE_LIMIT_MAX/,
    );
  });

  it('refuses the placeholder IP salt in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/IP_HASH_SALT/);
  });
});
