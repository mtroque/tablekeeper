export const ROOT: string;
export const NOT_RUNNING: string;
export class LocalEnvError extends Error {}
type Env = Record<string, string | undefined>;
export function loadEnvFile(env?: Env, file?: string): void;
export function fillSupabase(
  env?: Env,
  readStatus?: () => Record<string, string> | undefined,
): void;
export function findFreePort(start: number, taken?: number[]): Promise<number>;
export function pickPorts(env?: Env): Promise<{ webPort: number; apiPort: number }>;
export function loadLocalEnv(opts: {
  ports: true;
  exitOnError?: boolean;
}): Promise<{ webPort: number; apiPort: number }>;
export function loadLocalEnv(opts?: { ports?: false; exitOnError?: boolean }): Promise<undefined>;
