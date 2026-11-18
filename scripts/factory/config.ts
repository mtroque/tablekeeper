import { readFileSync } from 'node:fs';

import { z } from 'zod';

const AgentRunnerSchema = z.object({
  agent: z.literal('claude'),
  model: z.string().min(1),
  effort: z.enum(['low', 'medium', 'high']).default('medium'),
  maxTurns: z.int().min(1).default(50),
  timeoutMinutes: z.int().min(1).default(30),
});

export const ReviewPolicyConfigSchema = z.object({
  maxRounds: z.int().min(1).default(2),
  blockingSeverity: z.enum(['blocking', 'should-fix', 'nit']).default('should-fix'),
  labels: z
    .object({
      review: z.string().default('review'),
      needsHuman: z.string().default('needs-human'),
    })
    .default({ review: 'review', needsHuman: 'needs-human' }),
});

export const FactoryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  tasksPerRun: z.int().min(1).default(1),
  builder: AgentRunnerSchema,
  reviewer: AgentRunnerSchema,
  review: ReviewPolicyConfigSchema.optional(),
});

export type FactoryConfig = z.infer<typeof FactoryConfigSchema>;

export function parseFactoryConfig(rawJson: string): FactoryConfig {
  return FactoryConfigSchema.parse(JSON.parse(rawJson));
}

export function loadFactoryConfig(path: string): FactoryConfig {
  return parseFactoryConfig(readFileSync(path, 'utf8'));
}
