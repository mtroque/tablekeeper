import postgres, { type Sql } from 'postgres';

import type { Config } from '../config';

type JsonValue = Parameters<Sql['json']>[0];
type JsonParam = ReturnType<Sql['json']>;

/**
 * Typed SQL tagged-template client (`await db<Row>\`select ...\``).
 * For the service client `userId` is null; for a user client (`createUserDb`) every query runs
 * in a transaction with `role = app_user` and `app.user_id = userId`, so row level security
 * backs up the API's explicit `user_id` filters.
 */
export interface Db {
  <Row extends Record<string, unknown> = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Row[]>;
  readonly userId: string | null;
  /** Wraps a JSON value so booleans, numbers, arrays and objects serialize as `jsonb`. */
  json(value: unknown): JsonParam;
  /** Closes the underlying pool when finished (for scripts). */
  close(): Promise<void>;
}

export type Clients = {
  supabase: Config['supabase'];
  service: Db;
};

export type SupabaseClients = Clients;

type TaggedRunner = <Row extends Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Row[]>;

const pools = new Map<string, Sql>();

function getPool(databaseUrl: string): Sql {
  const existing = pools.get(databaseUrl);
  if (existing) return existing;
  const sql = postgres(databaseUrl, {
    max: 5,
    idle_timeout: 5,
    connect_timeout: 15,
    fetch_types: false,
    onnotice: () => {},
    types: {
      // Keep date and timestamp values as exact strings (microsecond precision for session cursors).
      date: {
        to: 1184,
        from: [1082, 1114, 1184],
        serialize: (value: string | Date) => (value instanceof Date ? value.toISOString() : value),
        parse: (value: string) => value,
      },
      // Parse int8 (e.g. llm_usage token counts) as number.
      bigint: {
        to: 20,
        from: [20],
        serialize: (value: number) => String(value),
        parse: (value: string) => Number(value),
      },
    },
  });
  pools.set(databaseUrl, sql);
  return sql;
}

const SQL_SYMBOL = Symbol('sql');

type InternalDb = Db & { [SQL_SYMBOL]: Sql };

/** Creates a service-level database client over `databaseUrl`. */
export function createDb(databaseUrl: string): Db {
  const sql = getPool(databaseUrl);
  const run = sql as unknown as TaggedRunner;
  const query = async <Row extends Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Row[]> => {
    const rows = await run<Row>(strings, ...values);
    return [...rows];
  };
  const db = Object.assign(query, {
    userId: null,
    json: (value: unknown) => sql.json(value as JsonValue),
    close: async () => {
      pools.delete(databaseUrl);
      await sql.end();
    },
    [SQL_SYMBOL]: sql,
  });
  return db;
}

/**
 * Creates a client scoped to `userId` (or `null` for an unauthenticated/guest context):
 * every query runs inside a transaction with `role = app_user` and `app.user_id` set,
 * so Postgres row level security applies.
 */
export function createUserDb(service: Db, userId: string | null): Db {
  const sql = (service as InternalDb)[SQL_SYMBOL];
  const query = async <Row extends Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Row[]> =>
    sql.begin(async (tx) => {
      const run = tx as unknown as TaggedRunner;
      await run`
        select
          set_config('role', 'app_user', true),
          set_config('app.user_id', ${userId ?? ''}, true)
      `;
      const rows = await run<Row>(strings, ...values);
      return [...rows];
    });
  return Object.assign(query, {
    userId,
    json: (value: unknown) => sql.json(value as JsonValue),
    close: () => Promise.resolve(),
    [SQL_SYMBOL]: sql,
  });
}

export function createClients(config: Pick<Config, 'databaseUrl' | 'supabase'>): Clients {
  return {
    supabase: config.supabase,
    service: createDb(config.databaseUrl),
  };
}

/** Requires `db.userId` to be set on a user-scoped client. */
export function requireUserId(db: Db): string {
  if (!db.userId) throw new Error('Expected a user-scoped database client.');
  return db.userId;
}
