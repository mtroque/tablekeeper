# W1: CI checks

**Status:** ✅ · **Depends on:** none

**Goal:** Every push and PR runs the checks that need no database on GitHub Actions, so "done" no longer depends on an agent remembering to run them. Free for this public repo. See `docs/AUTOMATION.md`.

## Owns
- `.github/workflows/ci.yml`, `scripts/lint-commits.mjs`
- `package.json` (a `test:unit` script), `vitest.config.ts`, `README.md` → Commands
- `docs/AUTOMATION.md` → Enforcement map (W1 row)

## Scope
- **Workflow** (`.github/workflows/ci.yml`): runs on `push` to `main` and on `pull_request` with one job `checks` (`name: Checks`). Checks out with `fetch-depth: 0` so commit history is present, installs pnpm from `packageManager` (`pnpm/action-setup@v4`) and Node from `.nvmrc` (`actions/setup-node@v4`, `cache: pnpm`), runs `pnpm install --frozen-lockfile`, then runs `pnpm typecheck`, `pnpm lint`, `pnpm lint:commits`, `pnpm test:unit`, and `pnpm build` (with placeholder `NEXT_PUBLIC_*` env vars so Next.js static prerendering needs no `.env.local`).
- **Unit test split:** `pnpm test:unit` runs `vitest run --project core --project cv --project tooling --project web`; `pnpm test` keeps running everything (including `api`). In `vitest.config.ts`, `loadLocalEnv({ exitOnError: false })` ignores `LocalEnvError` so running unit tests without `.env.local` or a running local Supabase succeeds cleanly, while `api` tests still get local env filled when Supabase is running.
- **Commit lint range** (`scripts/lint-commits.mjs`): accepts `COMMITLINT_FROM` and `COMMITLINT_TO` env vars (set in CI from `github.event.pull_request.base.sha` / `github.event.pull_request.head.sha` on `pull_request`, or `github.event.before` / `github.sha` on `push`, falling back when `before` is the zero SHA or missing), and keeps its local branch / `origin/main` behavior when unset.
- **Job name:** `Checks` is stable so W4 can require it on `main`.
- **Duration:** under 10 minutes on a cold cache; record the time here.

## UI states
None.

## Acceptance criteria
- [x] A PR with a type error, a lint error and a bad commit message fails the matching steps (show the run). Verified on temporary PR `#1` (`test/w1-failures`, closed and branch deleted after verification):
  - Type error (`Type 'string' is not assignable to type 'number'`): failed the `Typecheck` step in 37s ([run 43826834019](https://github.com/mtroque/tablekeeper/actions/runs/43826834019)).
  - Lint error (`No em or en dashes in user-facing text`): passed `Typecheck`, failed the `Lint` step in 57s ([run 43827088129](https://github.com/mtroque/tablekeeper/actions/runs/43827088129)).
  - Bad commit message (`bad commit message`): passed `Typecheck` and `Lint`, failed the `Commits` step in 1m11s ([run 43827379847](https://github.com/mtroque/tablekeeper/actions/runs/43827379847)).
- [x] A clean push to `main` passes, with its duration recorded here: [run 43826191442](https://github.com/mtroque/tablekeeper/actions/runs/43826191442) on `main` (commit `ebea5fa`) passed all steps (`Typecheck`, `Lint`, `Commits`, `Unit tests`, `Build`) in **2m12s** on a cold cache.
- [x] `pnpm test:unit` passes locally with Supabase stopped: 45 test files (363 tests across `core`, `cv`, `tooling`, `web`) passed in 10.44s without Supabase running or accessible.

## Tests
`pnpm test:unit` locally with Supabase stopped and without `.env.local` values in the environment; CI verification on a test PR and on `main`.

## Out of scope
- Database-backed tests and e2e (W7). Branch protection (W4).

## Open questions
None.

## Decisions
- **D-079** The CI workflow (`.github/workflows/ci.yml`) runs one `Checks` job on every push to `main` and pull request: `pnpm typecheck`, `pnpm lint`, `pnpm lint:commits` (using `COMMITLINT_FROM` / `COMMITLINT_TO` from the event payload), `pnpm test:unit` (`core`, `cv`, `tooling`, `web` Vitest projects), and `pnpm build` (with placeholder `NEXT_PUBLIC_*` URLs so Next.js static prerendering needs no `.env.local`). `vitest.config.ts` ignores `LocalEnvError` from `loadLocalEnv({ exitOnError: false })` so unit tests run without `.env.local` or local Supabase.

## Corrections
None.

## Shared change requests
None.
