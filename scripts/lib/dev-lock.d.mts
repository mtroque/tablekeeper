export const WEB_DIR: string;
export type DevServer = { pid: number; appUrl: string | undefined };
export function isAlive(pid: number): boolean;
export function runningDevServer(
  webDir?: string,
  alive?: (pid: number) => boolean,
): DevServer | undefined;
export function describeRunning(server: DevServer, opts?: { reuseHint?: string }): string;
export function portFree(port: number, host?: string): Promise<boolean>;
export function waitUntilStopped(
  ports: number[],
  opts?: { timeoutMs?: number; webDir?: string },
): Promise<boolean>;
