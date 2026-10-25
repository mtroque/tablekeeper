'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function SheetSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 py-5" aria-busy="true">
      <Skeleton className="h-7 w-32" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-5" role="alert">
      <p>Couldn&apos;t load your campaign. Try again.</p>
      <Button variant="secondary" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  );
}
