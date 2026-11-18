# Tablekeeper: Automation

How agent work is checked, reviewed and run: the enforcement map, CI, the PR flow, review policy, agent loops, token budget, and the accounts behind them. The slices that build it are the W rows in `docs/ROADMAP.md`; this doc holds the direction they share.

## Principles

1. **Checks over prose.** A rule an agent must remember is a rule that will drift. Prefer, in order: remove the problem by design (types, APIs, folder boundaries), then a lint rule or repo check with an error message that names the fix, then a test, and only then a line in a doc.
2. **Repeated corrections become checks.** Every correction is logged by pattern in `docs/CORRECTIONS.md`. When a pattern shows up a second time (or once, if it's high-stakes), turn it into one of the above and clean up existing occurrences. One-offs stay in the log, so the codebase doesn't fill with rules written after a single incident. `/harden` (`.agents/skills/harden/SKILL.md`) does the promotion.
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
| Conventional Commits | commit-msg hook, `pnpm lint:commits` (`commitlint.config.js`: `scope-enum`, `require-scope-except-merge`, `header-max-length`) | ✅ |
| CV worker never reaches UI code | `cv-worker-imports.test.ts` (D-060) | ✅ |
| Every check runs before anything reaches `main` | `.github/workflows/ci.yml` (`Checks` job), branch protection on `main` (`enforce_admins: true`, linear history, rebase-only merge) | ✅ |
| Only config reads `process.env` | `eslint-rules/rules.js` (`rules/no-env-outside-config`) | ✅ |
| Every LLM call goes through the gateway | `eslint.config.js` (`@typescript-eslint/no-restricted-imports` for `@anthropic-ai/sdk` outside `apps/api/src/llm/`) | ✅ |
| Scorers are pure | `eslint.config.js` (`no-restricted-globals` and `no-restricted-properties` in `packages/core/src/games/`) | ✅ |
| No `fetch` in components | `eslint.config.js` (`no-restricted-globals` and `no-restricted-properties` in `apps/web/src/{components,app,games}/`) | ✅ |
| No hex colors outside the token file and game modules | `eslint-rules/rules.js` (`rules/no-raw-colors`) | ✅ |
| Shared code never branches on game id | `eslint-rules/rules.js` (`rules/no-game-id-branching`) | ✅ |
| No disabled rule without a reason | `eslint-rules/rules.js` (`rules/require-disable-reason`) and `reportUnusedDisableDirectives` | ✅ |
| `useEffect` only through named hooks | `eslint.config.js` (`@typescript-eslint/no-restricted-imports` and `no-restricted-properties` outside `apps/web/src/lib/hooks/`) | ✅ |
| Every game rule id has a test, and every cited id exists | `pnpm check:repo` (`scripts/lib/check-repo/rule-ids.ts`) | ✅ |
| Applied migrations are never edited | `pnpm check:repo` (`scripts/lib/check-repo/migrations.ts`) | ✅ |
| Shared docs: a slice edits only its roadmap row and appends to decisions and corrections; decision ids unique and increasing | `pnpm check:repo` (`scripts/lib/check-repo/ownership.ts`, `decisions.ts`) | ✅ |
| No secrets, `.env*`, PDFs, rulebook text or photos over 2MB | pre-commit hook (`pnpm check:repo --staged`) and `pnpm check:repo` (`scripts/lib/check-repo/forbidden-files.ts`) | ✅ |
| Agent scratch files stay in `.scratch/<session or slice>/` | `.gitignore`, and `pnpm check:repo` rejects `zz-*` e2e specs and `scripts/_*`, `scripts/.*` (`scripts/lib/check-repo/forbidden-files.ts`) | ✅ |
| A slice edits only what its spec owns | `pnpm check:repo` against the spec's `## Owns` (`scripts/lib/check-repo/ownership.ts`) | ✅ |
| API integration and e2e tests pass | CI database jobs (`.github/workflows/ci.yml`: `API`, `E2E`) | ✅ |
| Score invariants (breakdown sums to total, schema round trip, API agrees with UI) | fast-check property tests (`packages/core/src/kit/properties.ts`, per-game `*.property.test.ts`, `contracts.property.test.ts`) | ✅ |
| CV accuracy never drops below the recorded numbers | `pnpm eval:cv:check` and `CV` job in `.github/workflows/ci.yml` (`data/fixtures/*/baseline.json`) | ✅ |
| Every screen state renders | screen map and screenshot job | W10 |
| Validate external input with Zod | review (no general check yet) | |
| Every detected value is an overridable draft with confidence | types (`Draft<T>`) and review | |

## Target flow

1. **Queue.** Work is a slice spec (product or W). For the factory (W14), it's a GitHub issue labeled `agent-ready` that links a spec or carries its own acceptance list, taken in the order of the "Factory" Project.
2. **Build.** An agent builds it on its own branch: a local worktree (`/parallel`), or the factory's headless Claude Code run on GitHub Actions every 5 hours (W14). Never on `main`.
3. **PR.** The agent pushes and opens a PR whose body links the spec and lists how each acceptance criterion was verified (W4).
4. **Checks.** CI runs every deterministic check; `main` requires `Checks`, `API` and `E2E` (plus PR required, linear history, rebase-only merge, `enforce_admins: true` so local sessions sharing the owner's GitHub credentials cannot push to `main` or merge a failing PR; emergency owner bypass is `gh api -X DELETE repos/mtroque/tablekeeper/branches/main/protection/enforce_admins` and `-X POST` to restore). Required checks are set with `gh api --method PATCH repos/mtroque/tablekeeper/branches/main/protection/required_status_checks -F strict=true -f 'contexts[]=Checks' -f 'contexts[]=API' -f 'contexts[]=E2E'`.
5. **Review.** By policy below (W11). Findings on a factory PR go back to the session that built it (`claude --resume`), which fixes them with its full context. Accepted review findings are logged in `docs/CORRECTIONS.md`; patterns that recur become checks (principle 2).
6. **Merge.** The PR already carries its shared-doc updates (its finish commit sets the roadmap row, appends decisions and corrections, and removes the spec), so merging is a rebase merge in GitHub by the owner. A PR behind `main` rebases first; `pnpm check:repo` catches clashing decision ids. For factory PRs, the merge-authority policy decides merge or escalate (W19).
7. **Watch.** Revert rate and CI health are tracked (W12); auto-merge widens or narrows with them. Session transcripts are graded for silent failures (W16), and findings become `trace` rows in `docs/CORRECTIONS.md`.

## Review policy

- **Always:** CI. It is free and catches most problems.
- **Every factory PR:** a separate reviewer session (agent, model and effort in `.github/factory/config.json`) posts findings as a PR review; findings above the threshold are resumed into the builder's session for up to two fix rounds, then `needs-human` (W11). Other PRs get a review only with the `review` label. Every run costs Pro usage.
- **Antigravity and Codex:** later, through the same config, once their CLIs can sign in on a runner.
- **What reviewers check:** only what no check covers. The review prompt lists the unchecked rows of the enforcement map plus spec fit and user-facing notes (`README.md` notes stay concise, self-contained, and free of contradictions or overstated claims); it does not restate lint.

## Auto-merge policy (target)

Set per area in `.github/factory/merge-policy.json` (W19): each path group (docs, game folders, shared code, scorers, LLM gateway, migrations, auth, workflow) is `shadow`, `auto` or `escalate`, with thresholds for size, reviewer confidence and risk, and W12's revert rate under 2%. Everything starts in `shadow`: the decision is recorded and the owner merges. An area moves to `auto` by changing its value once the shadow record agrees with the owner's own calls. A PR that changes the policy, the review prompt, workflows, settings or `scripts/factory/` always escalates.

## Agents and budget

| Pool | Tools | Use for |
|---|---|---|
| Claude Pro | Claude Code (local and cloud), Claude GitHub app via `CLAUDE_CODE_OAUTH_TOKEN` | Specs, building slices, factory builds and reviews (W14, W11) |
| Google AI Pro | Antigravity, `agy` CLI (Gemini 4 models, and Claude Opus 5.5 as of 2026-11-15) | Second-opinion review, exploratory QA, groomer cleanups, session grading (W16, to be measured) |

- Deterministic first: anything a script can answer never goes to a model.
- Pick the cheapest model and effort that fits: mechanical cleanups at low effort, specs and reviews higher.
- The factory runs on GitHub Actions on a fixed 5-hour schedule, one task per run to start (W14); other scheduled loops keep a cap per run set in their slice.
- `agy -p` costs about 10k input tokens per call before any work; batch PRs into one call where possible.
- The Anthropic API key in production pays for the app's rules assistant only; workflow automation never uses it.

**Commands** (`/build`, `/harden`, `/parallel`, `/plan`, `/status` and any new ones) are Agent Skills with one copy each, at `.agents/skills/<name>/SKILL.md`. Antigravity reads that folder directly; `.claude/skills` is a symlink to it, so Claude Code reads the same files. To add one, create the folder there, never under `.claude/`. Keep them tool-neutral: frontmatter `name` and `description` (plus Claude's optional `argument-hint` and `disable-model-invocation: true`, which Antigravity ignores), and refer to "the ids given with this command" rather than `$ARGUMENTS`, which only Claude Code substitutes. `/parallel` and `scripts/worktrees.sh launch` still start Claude Code sessions.

## Metrics

`pnpm metrics [--weeks 4]` (`scripts/metrics.ts`, `scripts/lib/metrics/`) prints a weekly ISO-week table of merged PRs (total and `factory/*`), revert rate, CI first-pass rate, factory runs/finished/`needs-human` rate/review rounds, remaining `eslint-rules/baseline.json` entries, and `docs/CORRECTIONS.md` patterns (flagging open patterns at `>= 2` for `/harden`).

`pnpm groom` (`scripts/groom.ts`) opens up to 3 `groomer` + `agent-ready` issues per week for any remaining lint baseline entries that don't already have an open issue. `.github/workflows/metrics.yml` runs both every Monday and updates the pinned "Factory metrics" issue.

## Accounts and setup

State as of 2026-11-17. No secret values here; only names.

| Item | State |
|---|---|
| GitHub CLI | Signed in as the repo owner with `repo` and `workflow` scope |
| `CLAUDE_CODE_OAUTH_TOKEN` | Repo secret, from `claude setup-token` |
| Claude GitHub app | Installed on this repo only |
| Claude cloud agents | GitHub connected at claude.ai/code |
| Antigravity and `agy` | Installed and signed in with Google AI Pro; headless `agy -p --output-format json` works, and `agy --conversation <id> -p='...'` resumes a conversation headless (attach the prompt to `-p`) |
| Vercel CLI | Signed in |
| Neon | Database `tablekeeper-db` and Neon Auth, through the Vercel Marketplace (X3, X4); setup in `docs/DEPLOYMENT.md` |
| Factory (W14) | `.github/workflows/factory.yml`, `.github/factory/config.json`, `scripts/factory/`; owner setup: GitHub App `tablekeeper-factory` (`FACTORY_APP_ID`, `FACTORY_APP_PRIVATE_KEY`), `FACTORY_SESSION_KEY`, "Factory" Project, `FACTORY_ENABLED` variable |
| Gemini CLI and Gemini Code Assist on GitHub | Retired for consumer accounts in 2026; don't use |
