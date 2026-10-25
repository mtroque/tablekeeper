import { notFound } from 'next/navigation';

import { CvHarness } from './cv-harness';

export const metadata = { title: 'Board Reader Check' };

/** Development harness for the CV worker; not part of the product. */
export default function CvHarnessPage() {
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_EXAMPLE_GAME === 'true';
  if (!enabled) notFound();
  return <CvHarness />;
}
