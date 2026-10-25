import type { MeResponse } from '@tablekeeper/core';

import { findProfile } from '../db/profiles';
import { notFound } from '../errors';
import type { AuthContext } from '../types/express';

export async function getMe(auth: AuthContext): Promise<MeResponse> {
  const profile = await findProfile(auth.db, auth.userId);
  if (!profile) throw notFound('Your profile');
  return { id: profile.id, displayName: profile.displayName, email: auth.email };
}
