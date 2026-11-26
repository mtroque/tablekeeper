import type { Metadata } from 'next';

import { FirstPlayerScreen } from '@/tools/first-player/first-player-screen';

export const metadata: Metadata = { title: 'Who Goes First' };

/** Who goes first (U1): a table tool for any game; works on the device, nothing is saved. */
export default function FirstPlayerPage() {
  return <FirstPlayerScreen />;
}
