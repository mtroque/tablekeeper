import { basename, extname } from 'node:path';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

export type FileEntry = {
  path: string;
  sizeBytes: number;
};

/** Paths agents used for throwaway files before `.scratch/` existed: `zz-*` e2e specs, `scripts/_*`, `scripts/.*`. */
function isScratchPath(path: string): boolean {
  return (
    path.startsWith('.scratch/') || path.startsWith('tests/e2e/zz-') || /^scripts\/[_.]/.test(path)
  );
}

/**
 * Checks tracked or staged files against AGENTS.md → Hard rules:
 * - No `.env*` except `.env.example`
 * - No PDFs (`*.pdf`)
 * - No files under `data/rulebooks/`
 * - No image over 2MB
 * - No agent scratch files outside `.scratch/` (AGENTS.md → Parallel sessions)
 */
export function checkForbiddenFiles(files: readonly FileEntry[]): string[] {
  const failures: string[] = [];
  for (const { path, sizeBytes } of files) {
    const normalized = path.replaceAll('\\', '/');
    const name = basename(normalized);
    const ext = extname(normalized).toLowerCase();

    if ((name === '.env' || name.startsWith('.env.')) && name !== '.env.example') {
      failures.push(
        `${normalized}: environment file is forbidden in git. Keep secrets in .env.local (gitignored) and document keys in .env.example (AGENTS.md → Hard rules).`,
      );
      continue;
    }

    if (normalized.startsWith('data/rulebooks/') && name !== '.gitkeep') {
      failures.push(
        `${normalized}: files under data/rulebooks/ are forbidden in git. Keep rulebook PDFs and extracted sections local only (AGENTS.md → Hard rules).`,
      );
      continue;
    }

    if (isScratchPath(normalized)) {
      failures.push(
        `${normalized}: looks like an agent scratch file. Put throwaway scripts and screenshot specs in .scratch/ (gitignored) instead (AGENTS.md → Parallel sessions).`,
      );
      continue;
    }

    if (ext === '.pdf') {
      failures.push(
        `${normalized}: PDF files are forbidden in git. Link to the official publisher PDF instead (AGENTS.md → Hard rules).`,
      );
      continue;
    }

    if (IMAGE_EXTENSIONS.has(ext) && sizeBytes > MAX_IMAGE_BYTES) {
      const mb = (sizeBytes / (1024 * 1024)).toFixed(2);
      failures.push(
        `${normalized}: image is ${mb}MB, over the 2.00MB limit. Downscale or compress the photo before committing (AGENTS.md → Hard rules).`,
      );
    }
  }
  return failures.sort();
}
