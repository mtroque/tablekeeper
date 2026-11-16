import type { Db } from '../db/client';

export type AuthContext = {
  userId: string;
  email: string | null;
  /** Scoped to the signed-in user (`app_user` role and `app.user_id` set per transaction). */
  db: Db;
};

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: AuthContext;
    }
  }
}
