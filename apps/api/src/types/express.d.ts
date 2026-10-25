import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../db/database.types';

export type AuthContext = {
  userId: string;
  email: string | null;
  /** Carries the user's token, so row level security applies. */
  db: SupabaseClient<Database>;
};

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthContext;
    }
  }
}
