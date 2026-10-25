import { z } from 'zod';

const emptyAsUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalString = z.preprocess(emptyAsUndefined, z.string().optional());
const int = (fallback: number) =>
  z.preprocess(emptyAsUndefined, z.coerce.number().int().positive().default(fallback));
const bool = (fallback: boolean) =>
  z
    .preprocess(emptyAsUndefined, z.enum(['true', 'false']).default(fallback ? 'true' : 'false'))
    .transform((v) => v === 'true');

const EnvSchema = z.object({
  NODE_ENV: z.preprocess(
    emptyAsUndefined,
    z.enum(['development', 'test', 'production']).default('development'),
  ),
  PORT: z.preprocess(emptyAsUndefined, z.coerce.number().int().positive().optional()),
  API_PORT: z.preprocess(emptyAsUndefined, z.coerce.number().int().positive().optional()),
  LOG_LEVEL: z.preprocess(
    emptyAsUndefined,
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ),
  WEB_ORIGINS: z.preprocess(emptyAsUndefined, z.string().default('http://localhost:3000')),

  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  LLM_ENABLED: bool(true),
  LLM_PROVIDER: z.preprocess(emptyAsUndefined, z.enum(['anthropic', 'fake']).default('anthropic')),
  ANTHROPIC_API_KEY: optionalString,
  LLM_MODEL_RULES: optionalString,
  RULES_MAX_TOOL_CALLS: int(6),
  RULES_MAX_OUTPUT_TOKENS: int(800),

  LLM_GUEST_DAILY_REQUESTS: int(5),
  LLM_USER_DAILY_REQUESTS: int(30),
  LLM_GLOBAL_DAILY_REQUESTS: int(500),
  LLM_GLOBAL_DAILY_TOKENS: int(2_000_000),
  IP_HASH_SALT: z.preprocess(emptyAsUndefined, z.string().default('change-me')),

  RATE_LIMIT_WINDOW_MS: int(60_000),
  RATE_LIMIT_MAX: int(60),
});

export type Config = {
  env: 'development' | 'test' | 'production';
  port: number;
  logLevel: z.infer<typeof EnvSchema>['LOG_LEVEL'];
  webOrigins: string[];
  supabase: { url: string; anonKey: string; serviceRoleKey: string };
  llm: {
    enabled: boolean;
    provider: 'anthropic' | 'fake';
    anthropicApiKey: string | undefined;
    rulesModel: string | undefined;
    rulesMaxToolCalls: number;
    rulesMaxOutputTokens: number;
  };
  quotas: {
    guestDailyRequests: number;
    userDailyRequests: number;
    globalDailyRequests: number;
    globalDailyTokens: number;
    ipHashSalt: string;
  };
  rateLimit: { windowMs: number; max: number };
};

/** The only place that reads `process.env`. Throws with every invalid variable named. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid API environment:\n  ${problems.join('\n  ')}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === 'production' && e.IP_HASH_SALT === 'change-me') {
    throw new Error('Invalid API environment:\n  IP_HASH_SALT: set a real salt in production');
  }
  return {
    env: e.NODE_ENV,
    port: e.PORT ?? e.API_PORT ?? 4000,
    logLevel: e.LOG_LEVEL,
    webOrigins: e.WEB_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    supabase: {
      url: e.SUPABASE_URL,
      anonKey: e.SUPABASE_ANON_KEY,
      serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
    },
    llm: {
      enabled: e.LLM_ENABLED,
      provider: e.LLM_PROVIDER,
      anthropicApiKey: e.ANTHROPIC_API_KEY,
      rulesModel: e.LLM_MODEL_RULES,
      rulesMaxToolCalls: e.RULES_MAX_TOOL_CALLS,
      rulesMaxOutputTokens: e.RULES_MAX_OUTPUT_TOKENS,
    },
    quotas: {
      guestDailyRequests: e.LLM_GUEST_DAILY_REQUESTS,
      userDailyRequests: e.LLM_USER_DAILY_REQUESTS,
      globalDailyRequests: e.LLM_GLOBAL_DAILY_REQUESTS,
      globalDailyTokens: e.LLM_GLOBAL_DAILY_TOKENS,
      ipHashSalt: e.IP_HASH_SALT,
    },
    rateLimit: { windowMs: e.RATE_LIMIT_WINDOW_MS, max: e.RATE_LIMIT_MAX },
  };
}
