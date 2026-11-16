# Tablekeeper: Automation

How agent work is checked, reviewed and run: the enforcement map, CI, the PR flow, review policy, agent loops, token budget, and the accounts behind them. The slices that build it are the W rows in `docs/ROADMAP.md`; this doc holds the direction they share.

## Principles

1. **Checks over prose.** A rule an agent must remember is a rule that will drift. Prefer, in order: remove the problem by design (types, APIs, folder boundaries), then a lint rule or repo check with an error message that names the fix, then a test, and only then a line in a doc.
2. **Repeated corrections become checks.** Every correction is logged by pattern in `docs/CORRECTIONS.md`. When a pattern shows up a second time (or once, if it's high-stakes), turn it into one of the above and clean up existing occurrences. One-offs stay in the log, so the codebase doesn't fill with rules written after a single incident. `/harden` (W5) does the promotion.
3. **Lint new, then clean old.** A new rule starts as an error for new code, with existing occurrences in a baseline file that may only shrink (W2). Cleanups drain the baseline.
4. **Review artifacts, not diffs.** CI results, screenshots of every screen state, CV accuracy numbers and property-test results are what a human looks at. A diff gets deep human review only when it touches shared code or a product decision.
5. **Spend tokens last.** Deterministic checks are free per run (GitHub Actions is free for this public repo); tokens go to building and to judgment no check can make. A sloppy loop automated is just more slop at a higher bill.

## Enforcement map

Every rule from `AGENTS.md` → Hard rules and `docs/CONVENTIONS.md`, and what enforces it. A rule with no check is a candidate for one. When a check lands, update its row here in the same slice.

| Rule | Enforced by | Status |
|---|---|---|
| TypeScript strict, no `any`, no non-null `!` outside tests | `tsconfig.base.json`, typescript-eslint `strictTypeChecked` | ✅ |
| Package boundaries | `eslint.config.js` (`boundary()`, `import-x/no-restricted-paths`) | ✅ |
| UI copy: no dashes, emoji, banned phrases | `eslint-rules/ui-copy.js` | ✅ |
| Conventional Commits | commit-msg hook, `pnpm lint:commits` | ✅ |
| CV worker never reaches UI code | `cv-worker-imports.test.ts` (D-060) | ✅ |
| Every check runs before anything reaches `main` | `.github/workflows/ci.yml` (`Checks` job), branch protection on `main` (`enforce_admins: true`, linear history, rebase-only merge) | ✅ |
| Only config reads `process.env` | `eslint-rules/rules.js` (`rules/no-env-outside-config`) | ✅ |
| Every LLM call goes through the gateway | `eslint.config.js` (`@typescript-eslint/no-restricted-imports` for `@anthropic-ai/sdk` outside `apps/api/src/llm/`) | ✅ |
| Scorers are pure | `eslint.config.js` (`no-restricted-globals` and `no-restricted-properties` in `packages/core/src/games/`) | ✅ |
| No `fetch` in components | `eslint.config.js` (`no-restricted-globals` and `no-restricted-properties` in `apps/web/src/{components,app,games}/`) | ✅ |
| No hex colors outside the token file and game modules | `eslint-rules/rules.js` (`rules/no-raw-colors`) | ✅ |
| Shared code never branches on game id | `eslint-rules/rules.js` (`rules/no-game-id-branching`) | ✅ |
| No disabled rule without a reason | `eslint-rules/rules.js` (`rules/require-disable-reason`) and `reportUnusedDisableDirectives` | ✅ |
| `useEffect` only through named hooks | named hooks in `apps/web/src/lib/hooks/`, then a ban elsewhere | W6 |
| Every game rule id has a test, and every cited id exists | `pnpm check:repo` (`scripts/lib/check-repo/rule-ids.ts`) | ✅ |
| Applied migrations are never edited | `pnpm check:repo` (`scripts/lib/check-repo/migrations.ts`) | ✅ |
| No secrets, `.env*`, PDFs, rulebook text or photos over 2MB | pre-commit hook (`pnpm check:repo --staged`) and `pnpm check:repo` (`scripts/lib/check-repo/forbidden-files.ts`) | ✅ |
| Agent scratch files stay in `.scratch/` | `.gitignore`, and `pnpm check:repo` rejects `zz-*` e2e specs and `scripts/_*`, `scripts/.*` (`scripts/lib/check-repo/forbidden-files.ts`) | ✅ |
| A slice edits only what its spec owns | `pnpm check:repo` against the spec's `## Owns` (`scripts/lib/check-repo/ownership.ts`) | ✅ |
| API integration and e2e tests pass | CI database jobs | W7 |
| Score invariants (breakdown sums to total, schema round trip, API agrees with UI) | fast-check property tests | W8 |
| CV accuracy never drops below the recorded numbers | `pnpm eval:cv` gate in CI | W9 |
| Every screen state renders | screen map and screenshot job | W10 |
| Validate external input with Zod | review (no general check yet) | |
| Every detected value is an overridable draft with confidence | types (`Draft<T>`) and review | |

## Target flow

1. **Queue.** Work is a slice spec (product or W) or, later, a GitHub issue labeled `agent-ready` that links one (W14).
2. **Build.** An agent builds it on its own branch: a local worktree (`/parallel`), or a cloud agent. Never on `main`.
3. **PR.** The agent pushes and opens a PR whose body links the spec and lists how each acceptance criterion was verified (W4).
4. **Checks.** CI runs every deterministic check; `main` requires them (`Checks` status check, PR required, linear history, rebase-only merge, `enforce_admins: true` so local sessions sharing the owner's GitHub credentials cannot push to `main` or merge a failing PR; emergency owner bypass is `gh api -X DELETE repos/mtroque/tablekeeper/branches/main/protection/enforce_admins` and `-X POST` to restore).
5. **Review.** By policy below (W11). Accepted review findings are logged in `docs/CORRECTIONS.md`; patterns that recur become checks (principle 2).
6. **Merge.** `/merge` rebases, adds the shared-doc commit (`docs/ROADMAP.md` status, `docs/DECISIONS.md`), waits for CI and rebase-merges, one PR at a time (W4).
7. **Watch.** Revert rate and CI health are tracked (W12); auto-merge widens or narrows with them. Session transcripts are graded for silent failures (W16), and findings become `trace` rows in `docs/CORRECTIONS.md`.

## Review policy

- **Always:** CI. It is free and catches most problems.
- **Claude, on request:** the Claude GitHub app via `claude-code-action`, running on the subscription token, triggered by the `review:claude` label or by changes to shared code (anything a game slice doesn't own). Every run costs Pro usage.
- **Antigravity, locally:** a script runs `agy -p` over open PRs and posts the findings as a comment, on the Google quota (W11).
- **What reviewers check:** only what no check covers. The review prompt lists the unchecked rows of the enforcement map plus spec fit; it does not restate lint.

## Auto-merge policy (target)

Allowed once CI is green and W12's revert rate stays under 2%: baseline cleanups, dependency patch bumps, docs-only changes, and fixes for bugs found by the QA loop that come with a test that failed before the fix. Product slices and anything touching shared code wait for a human look at the PR's artifacts.

## Agents and budget

| Pool | Tools | Use for |
|---|---|---|
| Claude Pro | Claude Code (local and cloud), Claude GitHub app via `CLAUDE_CODE_OAUTH_TOKEN` | Specs, building slices, review on request |
| Google AI Pro | Antigravity, `agy` CLI (Gemini 4 models, and Claude Opus 5.5 as of 2026-11-15) | Second-opinion review, exploratory QA, groomer cleanups, session grading (W16, to be measured) |

- Deterministic first: anything a script can answer never goes to a model.
- Pick the cheapest model and effort that fits: mechanical cleanups at low effort, specs and reviews higher.
- Scheduled loops run overnight so they don't compete with interactive use, with a daily cap per loop (set in W14).
- `agy -p` costs about 10k input tokens per call before any work; batch PRs into one call where possible.
- The Anthropic API key in production pays for the app's rules assistant only; workflow automation never uses it.

**Commands** (`/build`, `/merge`, `/parallel`, `/plan`, `/status` and any new ones) are Agent Skills with one copy each, at `.agents/skills/<name>/SKILL.md`. Antigravity reads that folder directly; `.claude/skills` is a symlink to it, so Claude Code reads the same files. To add one, create the folder there, never under `.claude/`. Keep them tool-neutral: frontmatter `name` and `description` (plus Claude's optional `argument-hint` and `disable-model-invocation: true`, which Antigravity ignores), and refer to "the ids given with this command" rather than `$ARGUMENTS`, which only Claude Code substitutes. `/parallel` and `scripts/worktrees.sh launch` still start Claude Code sessions.

## Accounts and setup

State as of 2026-11-15. No secret values here; only names.

| Item | State |
|---|---|
| GitHub CLI | Signed in as the repo owner with `repo` and `workflow` scope |
| `CLAUDE_CODE_OAUTH_TOKEN` | Repo secret, from `claude setup-token` |
| Claude GitHub app | Installed on this repo only |
| Claude cloud agents | GitHub connected at claude.ai/code |
| Antigravity and `agy` | Installed and signed in with Google AI Pro; headless `agy -p --output-format json` works |
| Vercel CLI | Signed in |
| Neon | Not yet; X3 creates it through the Vercel Marketplace |
| Gemini CLI and Gemini Code Assist on GitHub | Retired for consumer accounts in 2026; don't use |
