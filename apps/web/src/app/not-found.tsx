import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <section className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <h1 className="text-2xl">Page Not Found</h1>
      <p className="text-muted">There&apos;s nothing at this address.</p>
      <Button asChild variant="secondary">
        <Link href="/">See Your Games</Link>
      </Button>
    </section>
  );
}
