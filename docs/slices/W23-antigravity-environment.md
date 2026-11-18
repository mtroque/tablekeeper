# W23: Antigravity environment

**Status:** ⬜ · **Depends on:** none

**Goal:** An Antigravity session finds the same tools and the same guardrails a Claude Code session does. Today it doesn't find `pnpm`, can't write `.git` or reach Docker without leaving its sandbox, and runs with an allow list built from one-off approvals and no deny rules.

## Owns
- `.agents/antigravity/settings.json` (a checked-in permission profile), `scripts/agy-settings.mjs` with a test
- `scripts/preflight.mjs` (new checks), `README.md` (Antigravity setup), `docs/AUTOMATION.md` (Accounts and setup; Agents and budget → a note on Antigravity guardrails)

## Scope
- **Why `pnpm` goes missing:** it's installed at `~/.local/bin/pnpm` (`~/.local/lib/node_modules/pnpm`). Antigravity's sandbox mounts its own read-only `~/.local`, which hides it. Two sessions spent about 10 calls working around this (unpacking pnpm from the npm cache into `/tmp`, then calling `./node_modules/.bin` directly).
  - Fix on the owner's machine: install pnpm where the sandbox can see it (Corepack with Node, or an npm global prefix outside `~/.local`), or add the path in Antigravity's sandbox settings if it has one.
  - Record the chosen fix here and in README → Antigravity setup.
- **`.git` and Docker in the sandbox:**
  - Antigravity grants the sandbox read-only `.git`, so commits, branches, fetches and worktree changes fail once and are retried outside it (3 sessions). `pnpm db:start` fails the same way on `/var/run/docker.sock`.
  - Find whether Antigravity can allow these for a trusted workspace. If it can, add that to the profile. If not, say in the profile's README note that git writes and `db:start` always ask, so the agent asks once instead of retrying.
- **Permission profile** (`.agents/antigravity/settings.json`), mirroring `.claude/settings.json`:
  - **Allow:** the repo's `pnpm` scripts, read-only git, `git add`/`commit`/`switch`/`rebase`/`push` (not force), `gh pr`/`gh run`/`gh issue` reads and `gh pr create`.
  - **Deny:** `git push --force`, `git reset --hard`, `rm -rf`, `--no-verify`, `SKIP_SIMPLE_GIT_HOOKS`, `gh api -X DELETE`, `gh pr merge --admin`, and reading `.env*`.
  - If Antigravity reads project-level settings, it's picked up directly. Otherwise `node scripts/agy-settings.mjs` shows a diff against `~/.gemini/antigravity-cli/settings.json` and writes the merge only with `--write`. It removes the one-off approvals there today (a blanket `command(gh)`, and commands with `--no-verify` from W1's verification) and keeps unrelated keys.
- **`gh`:** upgrade from 2.65.0 (2025-01), where `gh pr edit` fails on the Projects (classic) deprecation; remove the stale `roque-mt` account; add the `project` scope (`gh auth refresh -s project`) so `pnpm queue:sync` can read the Project. Owner steps, recorded in Accounts and setup.
- **Preflight:** `pnpm preflight` also reports:
  - whether `pnpm` resolves on `PATH` (and where), Docker reachable, and the `gh` version with whether it has the `project` scope;
  - each problem as `MISS` with its fix, without failing on the optional ones.

## Acceptance criteria
- [ ] A fresh Antigravity session runs `pnpm preflight` and `pnpm verify` without a PATH workaround (quote the session's first commands)
- [ ] In Antigravity, `git push --force` and reading `.env.local` are denied by the profile (show the denial)
- [ ] `gh pr edit` works, `gh auth status` shows one account with the `project` scope
- [ ] `pnpm preflight` reports the new checks; `scripts/agy-settings.mjs` without `--write` changes nothing

## Tests
- `agy-settings`: merge keeps unrelated keys, removes listed one-off entries, is idempotent.

## Out of scope
- Codex setup.

## Open questions
- Does Antigravity read project-level settings, and can a trusted workspace get writable `.git` and the Docker socket? Check `agy` docs and the built-in `antigravity_guide` skill; decide the profile's delivery from the answer.

## Decisions

## Corrections

## Shared change requests
