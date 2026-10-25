import type { Quota } from '@tablekeeper/core';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** "4 left today"; a skeleton while loading; nothing when the quota is unknown or switched off. */
export function QuotaPill({ quota, loading }: { quota: Quota | undefined; loading: boolean }) {
  if (loading) return <Skeleton className="h-7 w-24 rounded-full" />;
  if (!quota?.enabled) return null;
  return (
    <span
      data-testid="quota-pill"
      className={cn(
        'tabular inline-flex h-7 items-center rounded-full border px-3 text-sm',
        quota.remaining === 0
          ? 'border-warn/50 bg-warn-soft text-ink'
          : 'border-line bg-surface text-muted',
      )}
    >
      {quota.remaining} left today
    </span>
  );
}
