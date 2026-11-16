/** Migrations directory (single constant so X3's move needs one edit). */
export const MIGRATIONS_DIR = 'db/migrations';

export type MigrationDiffEntry = {
  /** Git diff status letter (`A`, `M`, `D`, `R`, `C`, etc.). */
  status: string;
  /** Repo-relative path. */
  path: string;
};

/**
 * Verifies that no migration existing on the base branch was modified, deleted, or renamed.
 * Only newly added (`A`) migration files are allowed.
 */
export function checkMigrations(
  entries: readonly MigrationDiffEntry[],
  migrationsDir = MIGRATIONS_DIR,
): string[] {
  const prefix = `${migrationsDir.replace(/\/$/, '')}/`;
  const failures: string[] = [];
  for (const { status, path } of entries) {
    if (!path.startsWith(prefix)) continue;
    const code = status[0];
    if (code !== 'A') {
      failures.push(
        `${path}: applied migration was ${code === 'D' ? 'deleted' : 'modified'} (${status}). Never edit an existing migration; create a new one under ${migrationsDir}/ (docs/CONVENTIONS.md → Database).`,
      );
    }
  }
  return failures.sort();
}
