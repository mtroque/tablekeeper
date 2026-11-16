# W3: Repo checks

**Status:** ✅ · **Depends on:** W1

**Goal:** One `pnpm check:repo` command, run in CI and partly in a pre-commit hook, for rules that aren't about code syntax: rule ids have tests, migrations stay immutable, forbidden files stay out, and a branch only edits what its spec owns. The ownership check is what makes parallel agent PRs safe to merge without reading every diff.

## Owns
- `scripts/check-repo.ts`, `scripts/lib/check-repo/` (`index.ts`, `rule-ids.ts`, `migrations.ts`, `forbidden-files.ts`, `ownership.ts`, `check-repo.test.ts`), `package.json` (`check:repo` script, `pre-commit` hook in `simple-git-hooks`)
- `.github/workflows/ci.yml` (`Repo checks` step), `README.md` → Commands, `docs/AUTOMATION.md` → Enforcement map (W3 rows), `docs/slices/_TEMPLATE.md` (`## Owns` format)
- `packages/core/src/games/dorfromantik/index.test.ts`, `packages/core/src/games/dorfromantik/campaign.test.ts`, `apps/api/src/routes/dorfromantik.test.ts` (explicitly name `DOR-G` and each `DOR-E-*` / `DOR-U-*` id in test titles so every defined rule id in `docs/games/dorfromantik.md` is cited in a test name)

## Scope
- **Rule ids** (`scripts/lib/check-repo/rule-ids.ts`): parses markdown tables in `docs/games/*.md` whose first header cell is `ID` (expanding range shorthand like `DOR-B1..B5` and comma lists like `DOR-D1, D2` or `DOR-U-BOX1, BOX2`, and skipping rows marked `⚠️` or `VERIFY` until verified). Scans all test files (`**/*.test.{ts,tsx,js}`, `tests/e2e/**/*.spec.ts`) for `it(...)`, `test(...)`, and `describe(...)` titles (including `.each` and range shorthand). Fails if any defined rule id appears in no test title, or if any rule-id token (`(?:AZU|DOR|HAR|PAT)-[A-Z0-9-]+`) in a test title is not defined in `docs/games/*.md`.
- **Migrations** (`scripts/lib/check-repo/migrations.ts`): exports `MIGRATIONS_DIR = 'supabase/migrations'` (one constant to update in X3). Compares against the base ref (`COMMITLINT_FROM` or `origin/main` or `main`): any file under `MIGRATIONS_DIR` that existed on the base ref must be identical (`M`, `D`, `R` are forbidden; only `A` is allowed).
- **Forbidden files** (`scripts/lib/check-repo/forbidden-files.ts`): checks all tracked files (or staged files when `--staged` is passed from the `pre-commit` hook):
  - No `.env` or `.env.*` anywhere except `.env.example`.
  - No `*.pdf` anywhere.
  - No files under `data/rulebooks/` (except `.gitkeep`).
  - No image (`*.jpg`, `*.jpeg`, `*.png`, `*.webp`, `*.gif`, `*.avif`) over 2MB (2,097,152 bytes).
- **Ownership** (`scripts/lib/check-repo/ownership.ts`):
  - Format in `docs/slices/_TEMPLATE.md`: `## Owns` lists backticked repo-relative paths, folder prefixes ending in `/`, or globs (`*`, `**`, `{a,b}`). Mentioning "the `<gameId>` game folders" expands to `{packages/core,packages/cv,apps/web}/src/games/<gameId>/`, `docs/games/<gameId>.md`, `data/fixtures/<gameId>/`, and `apps/web/public/samples/<gameId>/`.
  - On a branch (`HEAD` not on `main`) that modifies one or more `docs/slices/<id>-*.md` files: every changed file since the base ref must match the union of those specs' `## Owns` patterns (plus the spec files themselves), or be an additive-wiring hub file (`packages/core/src/index.ts`, `packages/cv/src/index.ts`, `apps/api/src/app.ts`, `packages/core/src/games/registry.ts`, `apps/web/src/games/registry.ts`, `apps/web/src/games/detectors.ts`, `vitest.config.ts`, `playwright.config.ts`) with **only added lines** (zero removed lines in `git diff -U0`). `packages/core/src/kit/types.ts` is never allowed as additive wiring.
  - On `main`, or for W slices (`docs/slices/W<n>-*.md`) that own shared files, it reports any unowned files as notes without failing.
- **Output:** one line per failure with `<file>: <what is wrong and what to do>`.

## UI states
None.

## Acceptance criteria
- [x] Each check has unit tests with a passing and a failing fixture: `scripts/lib/check-repo/check-repo.test.ts` (10 tests covering `checkRuleIds`, `checkMigrations`, `checkForbiddenFiles`, `parseSpecOwns`, and `checkOwnership`).
- [x] `pnpm check:repo` passes on `main` (or lists real problems found, fixed or reported): found that `DOR-G`, `DOR-E-*` (14 rows tested in a `for` loop without `it.each` titles), and `DOR-U-*` (28 unlockables tested generically as `DOR-U:`) were not named in individual test titles; added `it.each` tests in `packages/core/src/games/dorfromantik/index.test.ts` and `campaign.test.ts` and named `DOR-G` in `apps/api/src/routes/dorfromantik.test.ts`. `pnpm check:repo` now passes cleanly on `main` locally and in CI ([run 43834423679](https://github.com/mtroque/tablekeeper/actions/runs/43834423679)).
- [x] A branch that edits a file outside its spec's Owns fails, and one that only adds a registry line passes: verified on a temporary branch `test/w3-ownership` editing `docs/slices/S6-typed-counters.md` (`pnpm check:repo` passed when adding a line to `packages/core/src/index.ts`, and failed with `apps/api/src/server.ts: not listed in ## Owns of docs/slices/S6-typed-counters.md...` when editing `apps/api/src/server.ts`).
- [x] Committing a 3MB image is refused by the hook: verified by staging a 3.00MB file at `data/fixtures/patchwork/test-3mb.jpg` and running `git commit`, which failed in the `pre-commit` hook (`pnpm check:repo --staged`) with `data/fixtures/patchwork/test-3mb.jpg: image is 3.00MB, over the 2.00MB limit. Downscale or compress the photo before committing (AGENTS.md → Hard rules).`

## Tests
Unit tests in `scripts/lib/check-repo/check-repo.test.ts` covering passing and failing fixtures for rule ids, immutable migrations, forbidden files (including >2MB images), and spec ownership (including additive wiring vs removed lines, and game-folder shorthand).

## Out of scope
None.

## Open questions
Resolved:
- Rows in `docs/games/*.md` containing `⚠️` or `VERIFY` are exempt from requiring a test until verified (matching `AGENTS.md` → Workflow: "Stop and ask ... when a rule the slice needs is marked ⚠️ or VERIFY").

## Decisions
- **D-081** `pnpm check:repo` (`scripts/check-repo.ts`, `scripts/lib/check-repo/`) checks rule IDs (`docs/games/*.md` vs test titles, exempting `⚠️`/`VERIFY` rows), immutable migrations (`MIGRATIONS_DIR = 'supabase/migrations'`), forbidden files (`.env*` except `.env.example`, PDFs, `data/rulebooks/*`, images >2MB; also run on staged files in the `pre-commit` hook), and branch ownership against changed specs' `## Owns` globs plus additive-only edits to shared wiring hub files (reporting without failing on `main` and for W slices).

## Corrections
None.

## Shared change requests
None.
