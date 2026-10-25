import { createHash } from 'node:crypto';

import type { Quota } from '@tablekeeper/core';
import type { Request } from 'express';

import type { Config } from '../config';
import type { Subject } from '../db/quota';
import { subjectLimit } from '../llm/gateway';
import type { QuotaStore } from '../llm/quota-store';

/** A signed-in user by id; a guest by a salted hash of the IP (never stored in the clear). */
export function subjectFor(req: Request, config: Config): Subject {
  if (req.auth) return { type: 'user', key: req.auth.userId };
  return guestSubject(config, req.ip ?? req.socket.remoteAddress ?? 'unknown');
}

export function guestSubject(config: Config, ip: string): Subject {
  const key = createHash('sha256').update(`${config.quotas.ipHashSalt}:${ip}`).digest('hex');
  return { type: 'ip', key };
}

/** The next UTC midnight, when daily quotas reset. */
export function nextUtcMidnight(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}

export async function getQuota(
  config: Config,
  quotas: QuotaStore,
  subject: Subject,
): Promise<Quota> {
  const limit = subjectLimit(config, subject);
  const used = await quotas.used(subject);
  return {
    enabled: config.llm.enabled,
    subject: subject.type === 'user' ? 'user' : 'guest',
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetsAt: nextUtcMidnight(),
  };
}
