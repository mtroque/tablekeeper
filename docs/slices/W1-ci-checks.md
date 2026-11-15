# W1: CI checks

**Status:** ⬜ · **Depends on:** none

**Goal:** Every push and PR runs the checks that need no database on GitHub Actions, so "done" no longer depends on an agent remembering to run them. Free for this public repo. See `docs/AUTOMATION.md`.

## Owns
- `.github/workflows/ci.yml`
- `package.json` (a `test:unit` script), `vitest.config.ts` (only if the split needs it), `README.md` → Commands
- `docs/AUTOMATION.md` → Enforcement map (W1 row)

## Scope (must cover)
- One workflow on `push` to `main` and on `pull_request`: pnpm install with cache (version from `packageManager`, Node from `.nvmrc`), then `pnpm typecheck`, `pnpm lint`, `pnpm lint:commits`, `pnpm test:unit`, `pnpm build`.
- `pnpm test:unit` runs the vitest projects that need no database (`core`, `cv`, `tooling`, `web`); `pnpm test` keeps running everything. `loadLocalEnv()` in `vitest.config.ts` must not fail without `.env.local`.
- `lint:commits` checks the PR's commits against its base, or the pushed range on `main`.
- Job names are stable, since W4 makes them required checks.
- Under 10 minutes on a cold cache; record the time.

## Acceptance criteria
- [ ] A PR with a type error, a lint error and a bad commit message fails the matching steps (show the run)
- [ ] A clean push to `main` passes, with its duration recorded here
- [ ] `pnpm test:unit` passes locally with Supabase stopped

## Out of scope
- Database-backed tests and e2e (W7). Branch protection (W4).

## Open questions

## Decisions

## Shared change requests
