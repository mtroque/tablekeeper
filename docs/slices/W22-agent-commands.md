# W22: Agent commands

**Status:** 🟨 · **Depends on:** none

**Goal:** The commands agents run most give short, readable output and leave nothing running behind them. The 2026-11-18 pass found 69 steps in 6 of 9 sessions where truncated output hid the failing line, so the agent reran a whole chain to find it. It also found import-order lint failures right after formatting, and stray dev servers blocking the next run.

## Owns
- `scripts/verify.ts` and `scripts/lib/verify/` with tests
- `package.json` (`verify`, `fix`, `format` scripts), `scripts/dev.mjs`, `scripts/shot.ts`, `playwright.config.ts` (server reuse only)
- `AGENTS.md` (Definition of done, item 1), `.agents/skills/build/SKILL.md`, `.agents/skills/issue/SKILL.md`, `README.md` (Commands), `docs/CONVENTIONS.md` (a short "Commands for agents" note)

## Scope
- **`pnpm verify [--full]`** runs `typecheck`, `lint`, `lint:commits`, `check:repo` and `test:unit` (`--full` adds `test` and `test:e2e`), in that order:
  - It prints one line per step (`ok typecheck 4.1s` or `FAIL lint`), and for a failed step the last 40 lines that matter (error lines first).
  - Each step's full output goes to `.scratch/<branch>/verify/<step>.log`, and the path is printed.
  - It stops at the first failure unless `--keep-going`, and exits non-zero on failure.
  - Definition of done item 1 becomes `pnpm verify --full`, and the skills say to use it instead of chaining the scripts by hand.
- **`pnpm format`** stays `prettier --write .` but with `--log-level warn`, so it lists only problems, not every file.
- **`pnpm fix`** runs Prettier, then `eslint --fix` on changed files (vs `origin/main`, or staged files with `--staged`). That fixes import order, which formatting alone doesn't.
- **Dev servers:**
  - `pnpm shot` and `pnpm dev` stop the servers they started on exit, including on Ctrl-C and errors, and wait until the ports are free.
  - Before starting, they detect a `next dev` already running for this app (Next allows one per app directory) and say so with its PID, instead of failing inside Playwright's web server output.
  - `pnpm test:e2e` does the same through `playwright.config.ts`.
  - Chained calls (`pnpm shot a && pnpm shot b`) work.
- **CI waits:** the skills tell agents to use `gh pr checks <n> --watch --interval 30 > /dev/null; gh pr checks <n>` (or `gh run watch --exit-status`), so the spinner never fills the output.

## Acceptance criteria
- [ ] `pnpm verify` on a branch with one lint error prints one `FAIL lint` line with the error, and the full log path (paste it)
- [ ] `pnpm format` on a clean tree prints nothing; `pnpm fix` fixes a deliberately misordered import
- [ ] `pnpm shot /games/patchwork/score && pnpm shot /games/patchwork/rules --offline` both succeed, and no `next` process is left afterwards
- [ ] Killing `pnpm test:e2e` midway, then running it again, works, or prints the stale server's PID and how to stop it

## Tests
- `scripts/lib/verify/`: step ordering, `--full`, `--keep-going`, picking the failing tail (error lines first) from a sample log.

## Out of scope
- Changing what the checks check.

## Open questions

## Decisions

## Corrections

## Shared change requests
