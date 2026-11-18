import { z } from 'zod';

import type { BaselineEntry } from './types';

export const LintBaselineSchema = z.record(z.string(), z.record(z.string(), z.int().min(0)));

export function parseBaselineEntries(rawJson: string): BaselineEntry[] {
  const parsed = LintBaselineSchema.parse(JSON.parse(rawJson));
  const entries: BaselineEntry[] = [];
  for (const [ruleId, files] of Object.entries(parsed)) {
    for (const [file, count] of Object.entries(files)) {
      if (count > 0) entries.push({ ruleId, file, count });
    }
  }
  return entries.sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.file.localeCompare(b.file));
}
