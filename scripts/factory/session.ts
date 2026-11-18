import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const RUNNER_CHECKOUT_PATH = '/home/runner/work/tablekeeper/tablekeeper';

export function claudeProjectDir(checkoutPath = RUNNER_CHECKOUT_PATH, home = homedir()): string {
  const slug = checkoutPath.replaceAll('/', '-');
  return join(home, '.claude', 'projects', slug);
}

/**
 * Packs `sourceDir` into a tar.gz and encrypts it with AES-256-CBC + PBKDF2.
 */
export function encryptSessionDir(sourceDir: string, outFile: string, key: string): void {
  if (!key) throw new Error('Session encryption key is empty.');
  if (!existsSync(sourceDir)) throw new Error(`Session directory not found: ${sourceDir}`);
  mkdirSync(dirname(outFile), { recursive: true });
  const tempDir = mkdtempSync(join(tmpdir(), 'tk-session-'));
  const tarPath = join(tempDir, 'session.tar.gz');
  try {
    execFileSync('tar', ['-czf', tarPath, '-C', sourceDir, '.']);
    execFileSync(
      'openssl',
      [
        'enc',
        '-aes-256-cbc',
        '-pbkdf2',
        '-salt',
        '-in',
        tarPath,
        '-out',
        outFile,
        '-pass',
        'env:FACTORY_SESSION_KEY',
      ],
      {
        env: { ...process.env, FACTORY_SESSION_KEY: key },
      },
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Decrypts `encFile` with AES-256-CBC + PBKDF2 and extracts it into `targetDir`.
 */
export function decryptSessionDir(encFile: string, targetDir: string, key: string): void {
  if (!key) throw new Error('Session decryption key is empty.');
  if (!existsSync(encFile)) throw new Error(`Encrypted session not found: ${encFile}`);
  mkdirSync(targetDir, { recursive: true });
  const tempDir = mkdtempSync(join(tmpdir(), 'tk-session-'));
  const tarPath = join(tempDir, 'session.tar.gz');
  try {
    try {
      execFileSync(
        'openssl',
        [
          'enc',
          '-d',
          '-aes-256-cbc',
          '-pbkdf2',
          '-in',
          encFile,
          '-out',
          tarPath,
          '-pass',
          'env:FACTORY_SESSION_KEY',
        ],
        {
          env: { ...process.env, FACTORY_SESSION_KEY: key },
          stdio: 'pipe',
        },
      );
    } catch {
      throw new Error(`Failed to decrypt ${encFile}: wrong key or corrupted archive.`);
    }
    execFileSync('tar', ['-xzf', tarPath, '-C', targetDir]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runCli(): void {
  const [command, sessionId, ...rest] = process.argv.slice(2);
  const key = process.env.FACTORY_SESSION_KEY ?? '';
  const dirFlagIdx = rest.indexOf('--dir');
  const targetDir =
    dirFlagIdx !== -1 && rest[dirFlagIdx + 1]
      ? resolve(rest[dirFlagIdx + 1] ?? '')
      : claudeProjectDir();
  const fileFlagIdx = rest.indexOf('--file');
  const file =
    fileFlagIdx !== -1 && rest[fileFlagIdx + 1]
      ? resolve(rest[fileFlagIdx + 1] ?? '')
      : resolve(`.scratch/session-${sessionId ?? 'unknown'}.tar.gz.enc`);

  if (command === 'save' && sessionId) {
    encryptSessionDir(targetDir, file, key);
    console.log(`Saved encrypted session to ${file}`);
    return;
  }

  if (command === 'restore' && sessionId) {
    if (!existsSync(file)) {
      const artifactDir = dirname(file);
      mkdirSync(artifactDir, { recursive: true });
      execFileSync('gh', ['run', 'download', '-n', `session-${sessionId}`, '-D', artifactDir]);
    }
    decryptSessionDir(file, targetDir, key);
    console.log(`Restored session ${sessionId} to ${targetDir}`);
    return;
  }

  console.error(
    'Usage: tsx scripts/factory/session.ts <save|restore> <sessionId> [--file <path>] [--dir <path>]',
  );
  process.exit(2);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runCli();
}
