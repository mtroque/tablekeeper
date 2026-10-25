import { cn } from '@/lib/utils';

/** Below this, a detected value is outlined and counted in the review banner. */
export const LOW_CONFIDENCE = 0.75;

export function isLowConfidence(confidence: number | undefined): boolean {
  return confidence !== undefined && confidence < LOW_CONFIDENCE;
}

/** Class names for a low-confidence value: a dashed warning outline, so color isn't the only signal. */
export function confidenceOutlineClass(confidence: number | undefined): string {
  return isLowConfidence(confidence)
    ? 'outline-2 outline-dashed outline-warn outline-offset-1'
    : '';
}

/** Wraps any value (a counter, a field) in the low-confidence outline when it needs checking. */
export function ConfidenceOutline({
  confidence,
  className,
  children,
}: {
  confidence: number | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn('rounded-control', confidenceOutlineClass(confidence), className)}
      data-low-confidence={isLowConfidence(confidence) || undefined}
    >
      {children}
    </div>
  );
}

/** Banner counting the values to check; renders nothing when there are none. */
export function ConfidenceBanner({ count, noun }: { count: number; noun: [string, string] }) {
  if (count === 0) return null;
  return (
    <p className="rounded-card bg-warn-soft px-3 py-2 text-[15px]" role="status">
      {count} {count === 1 ? noun[0] : noun[1]} to check.
    </p>
  );
}
