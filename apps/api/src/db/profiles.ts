import { requireUserId, type Db } from './client';
import type { ProfilesRow } from './types';

export type ProfileRow = { id: string; displayName: string };

type DbRow = Pick<ProfilesRow, 'id' | 'display_name'>;

/** Creates the signed-in user's profile row on their first authenticated request. */
export async function ensureProfile(db: Db, userId: string, displayName: string): Promise<void> {
  await db`
    insert into public.profiles (id, display_name)
    values (${userId}, ${displayName})
    on conflict (id) do nothing
  `;
}

export async function findProfile(db: Db, userId = requireUserId(db)): Promise<ProfileRow | null> {
  const [row] = await db<DbRow>`
    select id, display_name
    from public.profiles
    where id = ${userId}
  `;
  return row ? { id: row.id, displayName: row.display_name } : null;
}
