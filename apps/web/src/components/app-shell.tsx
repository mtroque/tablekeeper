import Link from 'next/link';
import { Suspense } from 'react';

import { AccountMenu } from './account-menu';
import { PhoneSideNote } from './phone-side-note';
import { ServerStatus } from './server-status';

/** Header and the single phone column, centered on every screen size (docs/UX.md → Desktop). */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div
        data-testid="app-column"
        className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col border-x border-line bg-bg"
      >
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-line bg-bg px-4">
          <Link href="/" className="font-display text-xl font-semibold">
            Tablekeeper
          </Link>
          <AccountMenu />
        </header>
        <ServerStatus />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
      <Suspense>
        <PhoneSideNote />
      </Suspense>
    </>
  );
}
