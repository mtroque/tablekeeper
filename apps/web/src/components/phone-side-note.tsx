'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useSyncExternalStore } from 'react';
import { encode } from 'uqr';

/**
 * From 900px wide: "Made for Your Phone" beside the column, with a QR code that opens the
 * current URL on a phone (docs/UX.md → Desktop). Hidden on narrow screens.
 */
const noSubscription = () => () => undefined;

export function PhoneSideNote() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const origin = useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => null,
  );

  const url = origin ? `${origin}${pathname}${search ? `?${search}` : ''}` : null;
  const qr = useMemo(() => (url ? encode(url, { ecc: 'M', border: 0 }) : null), [url]);

  return (
    <aside
      data-testid="phone-side-note"
      className="fixed top-24 left-[calc(50%+215px+48px)] hidden w-44 flex-col gap-3 min-[900px]:flex"
    >
      <h2 className="text-lg">Made for Your Phone</h2>
      <p className="text-sm text-muted">Scan to open this page on your phone, at the table.</p>
      {/* Dark on white in both themes: some phone scanners miss inverted codes. */}
      <div className="w-36 rounded-card border border-line bg-white p-3 text-black">
        {qr ? (
          <svg
            viewBox={`0 0 ${qr.size} ${qr.size}`}
            role="img"
            aria-label="QR code for this page"
            className="block w-full"
          >
            <path
              fill="currentColor"
              d={qr.data
                .flatMap((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : '')))
                .join('')}
            />
          </svg>
        ) : (
          <div className="aspect-square w-full" />
        )}
      </div>
    </aside>
  );
}
