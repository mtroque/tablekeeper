import { notFound } from 'next/navigation';

import { isExampleGameEnabled } from '@/lib/env';

import { CvHarness } from './cv-harness';

export const metadata = { title: 'Board Reader Check' };

/** Development harness for the CV worker; not part of the product. */
export default function CvHarnessPage() {
  if (!isExampleGameEnabled()) notFound();
  return <CvHarness />;
}
