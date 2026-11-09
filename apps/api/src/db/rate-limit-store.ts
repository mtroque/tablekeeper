import { createHash } from 'node:crypto';

import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { z } from 'zod';

import type { Db } from './client';

const HitSchema = z.array(z.object({ hits: z.number().int(), reset_at: z.string() })).length(1);

/**
 * express-rate-limit store kept in Postgres (`rate_limit_hits`), so every API instance counts
 * against one window per client. Keys are salted hashes; the raw IP is never stored.
 */
export class SupabaseRateLimitStore implements Store {
  /** Counts are shared across instances. */
  localKeys = false;
  prefix: string;
  private windowMs = 60_000;

  constructor(
    private readonly db: Db,
    private readonly salt: string,
    prefix = 'burst',
  ) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private hashed(key: string): string {
    const hash = createHash('sha256').update(`${this.salt}:${key}`).digest('hex');
    return `${this.prefix}:${hash}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const { data, error } = await this.db.rpc('rate_limit_hit', {
      p_key: this.hashed(key),
      p_window_ms: this.windowMs,
    });
    if (error) throw error;
    const [row] = HitSchema.parse(data);
    // `length(1)` guarantees a row; this keeps the type checker honest without `!`.
    if (!row) throw new Error('rate_limit_hit returned no row');
    return { totalHits: row.hits, resetTime: new Date(row.reset_at) };
  }

  async decrement(key: string): Promise<void> {
    const { error } = await this.db.rpc('rate_limit_undo', { p_key: this.hashed(key) });
    if (error) throw error;
  }

  async resetKey(key: string): Promise<void> {
    const { error } = await this.db.from('rate_limit_hits').delete().eq('key', this.hashed(key));
    if (error) throw error;
  }
}
