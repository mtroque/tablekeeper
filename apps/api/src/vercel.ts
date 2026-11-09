import { createApp } from './app';
import { loadConfig } from './config';

/**
 * Vercel entry: the app as a `(req, res)` handler, without `listen`. Built into a Build Output
 * API function by `pnpm build:vercel` (docs/DEPLOYMENT.md); `server.ts` is for everything else.
 */
export default createApp(loadConfig());
