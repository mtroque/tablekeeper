// pnpm verify [--full] [--keep-going]
// Runs the checks from AGENTS.md → Definition of done, item 1 (`--full`; without it, the fast
// subset with unit tests only), one line per step. A failed step prints the lines that matter;
// every step's full output is in .scratch/<branch>/verify/<step>.log.
import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './lib/local-env.mjs';
import { sanitizeBranchName } from './lib/shot-args';
import {
  failureTail,
  formatDuration,
  parseVerifyArgs,
  verifySteps,
  type VerifyStep,
} from './lib/verify';

function currentBranch(): string {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'local';
  }
}

function run(step: VerifyStep, logFile: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const log = createWriteStream(logFile);
    let output = '';
    const [command = 'pnpm', ...args] = step.command;
    const child = spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const collect = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      log.write(text);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('close', (code) => {
      log.end();
      resolve({ code: code ?? 1, output });
    });
  });
}

let options;
try {
  options = parseVerifyArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const logDir = join(ROOT, '.scratch', sanitizeBranchName(currentBranch()), 'verify');
mkdirSync(logDir, { recursive: true });

const failed: string[] = [];
for (const step of verifySteps(options)) {
  const logFile = join(logDir, `${step.name.replace(/[^a-z0-9-]+/gi, '-')}.log`);
  const started = Date.now();
  const { code, output } = await run(step, logFile);
  const took = formatDuration(Date.now() - started);
  if (code === 0) {
    console.log(`ok    ${step.name.padEnd(12)} ${took}`);
    continue;
  }
  failed.push(step.name);
  console.log(`FAIL  ${step.name.padEnd(12)} ${took}`);
  for (const line of failureTail(output)) console.log(`      ${line}`);
  console.log(`      full log: ${logFile}`);
  if (!options.keepGoing) break;
}

if (failed.length > 0) {
  console.log(`\n${failed.length} failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\nAll passed. Logs: ${logDir}`);
