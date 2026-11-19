import { readFileSync } from 'node:fs';

import { z } from 'zod';

/** The `grader` block of `.github/factory/config.json` (W16). */
export const GraderConfigSchema = z.object({
  agent: z.literal('claude'),
  model: z.string().min(1),
  effort: z.enum(['low', 'medium', 'high']).default('low'),
  /** Share of unflagged sessions judged at random. */
  sampleRate: z.number().min(0).max(1).default(0.1),
  /** The sessions with the most tagged findings are always judged. */
  flagTop: z.int().min(0).default(3),
  maxJudged: z.int().min(0).default(10),
  /** Judging stops once reported tokens reach this. */
  tokenCap: z.int().min(0).default(200_000),
  maxTraceChars: z.int().min(1000).default(12_000),
  timeoutMinutes: z.int().min(1).default(5),
});

export type GraderConfig = z.infer<typeof GraderConfigSchema>;

export function parseGraderConfig(rawJson: string): GraderConfig {
  return z.object({ grader: GraderConfigSchema }).parse(JSON.parse(rawJson)).grader;
}

export function loadGraderConfig(path: string): GraderConfig {
  return parseGraderConfig(readFileSync(path, 'utf8'));
}
