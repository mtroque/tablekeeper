import type { Db } from './client';

export type ProfileRow = { id: string; displayName: string };

export async function findProfile(db: Db, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await db
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, displayName: data.display_name } : null;
}
