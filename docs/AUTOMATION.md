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
| No high or critical advisory in production dependencies | `Audit` job in `.github/workflows/ci.yml` (`pnpm audit:prod`), required on `main` once the owner runs the step 4 command of Target flow (W26); moderate and low counts in the weekly metrics report | ✅ |
| Shared docs: a slice edits only its roadmap row and appends to decisions and corrections; decision ids unique and increasing | `pnpm check:repo` (`scripts/lib/check-repo/ownership.ts`, `decisions.ts`) | ✅ |
| A slice isn't folded or marked ✅ with unchecked acceptance criteria (moved ones name an existing follow-up spec) | `pnpm check:repo` (`scripts/lib/check-repo/finish-gate.ts`) | ✅ |
| No secrets, `.env*`, PDFs, rulebook text or photos over 2MB | pre-commit hook (`pnpm check:repo --staged`) and `pnpm check:repo` (`scripts/lib/check-repo/forbidden-files.ts`) | ✅ |
| Agent scratch files stay in `.scratch/<session or slice>/` | `.gitignore`, and `pnpm check:repo` rejects `zz-*` e2e specs and `scripts/_*`, `scripts/.*` (`scripts/lib/check-repo/forbidden-files.ts`) | ✅ |
| A slice edits only what its spec owns | `pnpm check:repo` against the spec's `## Owns` (`scripts/lib/check-repo/ownership.ts`) | ✅ |
| API integration and e2e tests pass | CI database jobs (`.github/workflows/ci.yml`: `API`, `E2E`) | ✅ |
| A deploy that breaks production is noticed without the owner trying the site | `.github/workflows/smoke.yml` (`pnpm smoke` after each production deploy, `needs-human` issue on failure; signed-out checks only, `docs/DEPLOYMENT.md` → Smoke test after each deploy) | ✅ |
| Production changes go through a reviewed workflow, not a local script | `.github/workflows/migrate.yml` in the `production` environment (owner approval); other production changes are owner commands (`AGENTS.md` → Hard rules) | ✅ |
| Score invariants (breakdown sums to total, schema round trip, API agrees with UI) | fast-check property tests (`packages/core/src/kit/properties.ts`, per-game `*.property.test.ts`, `contracts.property.test.ts`) | ✅ |
| CV accuracy never drops below the recorded numbers | `pnpm eval:cv:check` and `CV` job in `.github/workflows/ci.yml` (`data/fixtures/*/baseline.json`) | ✅ |
| Every screen state renders, and every route has a map entry | `pnpm check:repo` (`scripts/lib/check-repo/screens.ts` against `tests/e2e/screens.ts`) and `.github/workflows/screens.yml` (each entry must reach its state) | ✅ |
| Factory PRs merge only inside the policy, never when a required check is red or a finding is disputed | `scripts/factory/merge-policy.ts` (`decide()`, fixed rules in code) and `.github/workflows/merge.yml`; everything in `shadow` until the record supports `auto` (W29) | ✅ |
| Validate external input with Zod | review (no general check yet) | |
| Every detected value is an overridable draft with confidence | types (`Draft<T>`) and review | |

## Target flow

1. **Queue.** Work is a slice spec (product or W). For the factory (W14), it's a GitHub issue labeled `agent-ready` that links a spec or carries its own acceptance list, taken in the order of the "Factory" Project.
2. **Build.** An agent builds it on its own branch: a local worktree (`/parallel`), or the factory's headless Claude Code run on GitHub Actions every 5 hours (W14). Never on `main`.
3. **PR.** The agent pushes and opens a PR whose body links the spec and lists how each acceptance criterion was verified (W4).
4. **Checks.** CI runs every deterministic check; `main` requires `Checks`, `API` and `E2E`, plus `Audit` once the owner runs the command below (W26) (plus PR required, linear history, rebase-only merge, `enforce_admins: true` so local sessions sharing the owner's GitHub credentials cannot push to `main` or merge a failing PR; emergency owner bypass is `gh api -X DELETE repos/mtroque/tablekeeper/branches/main/protection/enforce_admins` and `-X POST` to restore). Required checks are set with `gh api --method PATCH repos/mtroque/tablekeeper/branches/main/protection/required_status_checks -F strict=true -f 'contexts[]=Checks' -f 'contexts[]=API' -f 'contexts[]=E2E' -f 'contexts[]=Audit'`, and shown with `gh api repos/mtroque/tablekeeper/branches/main/protection/required_status_checks --jq .contexts`. Only the owner's credentials can change protection; the factory's App token can't read it.
5. **Review.** By policy below (W11). Findings on a factory PR go back to the session that built it (`claude --resume`), which fixes them with its full context. Accepted review findings are logged in `docs/CORRECTIONS.md`; patterns that recur become checks (principle 2).
6. **Merge.** The PR already carries its shared-doc updates (its finish commit sets the roadmap row, appends decisions and corrections, and removes the spec), so merging is a rebase merge in GitHub by the owner. A PR behind `main` rebases first; `pnpm check:repo` catches clashing decision ids. For factory PRs, merge authority decides merge, wait or escalate (Auto-merge policy below); while its groups are in `shadow` it only records, and the owner merges.
7. **Watch.** Revert rate and CI health are tracked (W12); auto-merge widens or narrows with them. Session transcripts are graded for silent failures (W16, Grading below), and findings become `trace` rows in `docs/CORRECTIONS.md`.

## Review policy

- **Always:** CI. It is free and catches most problems.
- **Every factory PR:** a separate reviewer session (`.github/workflows/review.yml`, `scripts/review/`, `.agents/skills/review/SKILL.md`, config in `.github/factory/config.json`) posts inline findings and a verdict; findings at or above `blockingSeverity` (`should-fix`) are resumed into the builder's session for up to `maxRounds` (`2`) fix rounds, then labeled `needs-human`. Other PRs get a review (with no fix round) when labeled `review`. Every run costs Pro usage.
- **Antigravity and Codex:** later, through the same config, once their CLIs can sign in on a runner.
- **What reviewers check:** only what no check covers. The review prompt lists the unchecked rows of the enforcement map plus spec fit and user-facing notes (`README.md` notes stay concise, self-contained, and free of contradictions or overstated claims); it does not restate lint.

## Auto-merge policy

Factory PRs merge or escalate inside limits a script enforces (W19). Everything starts in `shadow`: the decision is recorded and the owner merges as usual. An area moves to `auto` by changing its value in a PR, once the shadow record agrees with the owner's own calls; that PR always escalates.

- **Policy** (`.github/factory/merge-policy.json`, Zod schema in `scripts/factory/merge-policy.ts`): path groups `docs` (not `docs/games/`), `game-rules`, `game-ui-cv`, `shared-code`, `api`, `llm-gateway`, `auth`, `migrations`, `tooling` (not `scripts/factory/`) and `dependencies`, each `shadow`, `auto` or `escalate`, with optional thresholds that override the global ones: `maxChangedLines` (lockfile and fixtures not counted), `minConfidence` and `maxRisk` from the reviewer's verdict; `null` means no limit. All `null` until the shadow record sets them (W29). `revertRateCeiling` (2%) applies to W12's revert rate over the last `revertWindow` (50) merged PRs.
- **Fixed rules** (in code, not the policy): required checks `Checks`, `API`, `E2E` and `CV` green; W11's review on the head commit, posted by the `tablekeeper-factory` bot, finished with no open blocking finding and no unresolved `disputed:` thread; GitHub returned every changed file, finding and thread (a list cut short escalates); the reviewer recommended `merge`; revert rate under the ceiling; a `factory/*` branch; no `needs-human` label. A PR touching `.github/factory/`, `.github/workflows/`, `.github/workflow-drafts/`, `.agents/skills/`, `.claude/settings.json`, `.claude/skills/`, `AGENTS.md` or `scripts/factory/` always escalates, as does a file in no group.
- **Decision** (`decide()`): `merge`, `wait` or `escalate` with every reason. Hard escalations (red required check, disputed or open finding, a list GitHub cut short, `needs-human`, not a factory branch) win; otherwise anything pending (checks, review) waits; then path, group, threshold and revert-rate escalations; otherwise merge. A PR whose groups are all `shadow` is recorded only; one that touches an `auto` group acts, and any `shadow` group it also touches escalates it; an `escalate` group, unlisted file or always-escalate path escalates in every mode.
- **Acting** (`scripts/factory/merge.ts`, `.github/workflows/merge.yml`, after `CI` or `Review` completes for a `factory/*` PR; it checks out `main`, so a PR can't change the policy that judges it): shadow updates one comment (`<!-- tablekeeper-merge-decision -->`) with the decision, reasons and a hidden history, and labels `shadow:merge` or `shadow:escalate`. Auto merges with `gh pr merge --rebase --match-head-commit`, first asking the builder's session to rebase (W11's resume path) when the PR is behind `main`. Escalate labels `needs-human` and mentions the owner. `wait` does nothing; the next completion runs it again.
- **Locally:** `pnpm merge:decide --pr <n>` prints the decision and planned actions without acting. On Actions, `workflow_dispatch` with a PR number does the same (`dry_run` on by default).
- **Agreement:** `pnpm metrics` compares each PR's first shadow decision with what happened (merged at that commit, changed, or closed): `merge` agrees with merged as is, `escalate` with changed or closed. Shown per week and per group.

## Agents and budget

| Pool | Tools | Use for |
|---|---|---|
| Claude Pro | Claude Code (local and cloud), Claude GitHub app via `CLAUDE_CODE_OAUTH_TOKEN` | Specs, building slices, factory builds and reviews (W14, W11), session grading judge (W16) |
| Google AI Pro | Antigravity, `agy` CLI (Gemini 4 models, and Claude Opus 5.5 as of 2026-11-15) | Second-opinion review, exploratory QA, groomer cleanups |

- Deterministic first: anything a script can answer never goes to a model.
- Pick the cheapest model and effort that fits: mechanical cleanups at low effort, specs and reviews higher.
- The factory runs on GitHub Actions on a fixed 5-hour schedule, one task per run to start (W14); other scheduled loops keep a cap per run set in their slice.
- `agy -p` costs about 10k input tokens per call before any work; batch PRs into one call where possible.
- The Anthropic API key in production pays for the app's rules assistant only; workflow automation never uses it.

**Commands** (`/build`, `/harden`, `/parallel`, `/plan`, `/status` and any new ones) are Agent Skills with one copy each, at `.agents/skills/<name>/SKILL.md`. Antigravity reads that folder directly; `.claude/skills` is a symlink to it, so Claude Code reads the same files. To add one, create the folder there, never under `.claude/`. Keep them tool-neutral: frontmatter `name` and `description` (plus Claude's optional `argument-hint` and `disable-model-invocation: true`, which Antigravity ignores), and refer to "the ids given with this command" rather than `$ARGUMENTS`, which only Claude Code substitutes. `/parallel` and `scripts/worktrees.sh launch` still start Claude Code sessions.

## Screens

The screen map, `tests/e2e/screens.ts`, lists every screen (`SCREEN_ROUTES`: the rows of `docs/UX.md` → Routes, the app shell and not-found, each with the `page.tsx` that renders it and a reason for each shared state it doesn't have) and every state as an entry `{ id, screen, route, state, reach, dark? }`. `reach` uses existing test tooling: a minted test JWT for a fresh `screens`-prefixed user (deleted after the shot), data through the API, `page.route` holding a call (loading) or failing it (error), `context.setOffline(true)`, and held JavaScript for the server render before hydration (header and callback loading).

- `pnpm shot <entry id>` reproduces one entry locally; `SCREENS=1 pnpm test:e2e screens` runs them all into `test-results/screens/<id>.png` (390x844, light unless the entry is `dark`). The normal e2e run skips them.
- `.github/workflows/screens.yml` runs on PRs touching `apps/web/`, `packages/core/src/games/` or the map, in the same environment as the `E2E` job. It pushes the PNGs to the orphan `screens` branch under `pr-<number>/<sha>/` (only the latest run is kept, with a README showing all of them), and updates one PR comment (`<!-- screens -->`, `scripts/screens-report.ts`) embedding the screens whose PNG differs from the `main/` set, which pushes to `main` refresh. Closing the PR removes its folder. An entry that fails to reach its state fails the job and is named in the comment.
- No visual diffs: fonts, photos and timing make them flaky, so a person or W13 judges the shots. Animations are disabled in the shots so unchanged screens hash the same.

## Metrics

`pnpm metrics [--weeks 4]` (`scripts/metrics.ts`, `scripts/lib/metrics/`) prints a weekly ISO-week table of merged PRs (total and `factory/*`), revert rate, CI first-pass rate, factory runs/finished/`needs-human` rate/review rounds, remaining `eslint-rules/baseline.json` entries, `docs/CORRECTIONS.md` patterns (flagging open patterns at `>= 2` for `/harden`), and failed tool calls per session with the top failure classes, read from the week's "Grading report" issue (Grading below).

It ends with W19's shadow agreement per week and per group (`scripts/lib/metrics/agreement.ts`, Auto-merge policy above).

`pnpm groom` (`scripts/groom.ts`) opens up to 3 `groomer` + `agent-ready` issues per week for any remaining lint baseline entries that don't already have an open issue. `.github/workflows/metrics.yml` runs both every Monday and updates the pinned "Factory metrics" issue.

## Grading

Session transcripts are graded for what goes wrong even when nobody corrects it (W16). `pnpm grade [--since <day>] [--until <day>] [--source local|factory] [--no-judge] [--issue]` (`scripts/grade.ts`, `scripts/lib/traces/`, `/grade` in `.agents/skills/grade/`) runs four steps:

1. **Collect.** Local: Claude Code sessions in `~/.claude/projects/<repo path>*/*.jsonl` (main checkout and worktrees) and Antigravity's `~/.gemini/antigravity-cli/brain/<id>/.system_generated/logs/transcript_full.jsonl` (and the IDE's `~/.gemini/antigravity/brain/`) that mention the repo path. Factory: the `session-<id>` artifacts created in the range, downloaded and decrypted with `FACTORY_SESSION_KEY`. Sessions are filtered by start day and linked to PRs through the `Session:` line of the PR body.
2. **Condense and classify, without a model.** Each session becomes user turns, tool calls (name and a short argument), errors and the final message, written to `.scratch/grade/<source>-<since>_<until>/traces/` (a few KB each, capped by `grader.maxTraceChars`). Each failed call gets one class; calls are also checked for behaviors. Classes with a tag become proposed rows:

   | Class | Tag | Matches |
   |---|---|---|
   | `worktree-guard` | `worktree-command-refused` | The harness refused a command outside the working directories, or any approval refusal in a worktree |
   | `env-file-denied` | `preflight-reads-denied-file` | A permission denial on a call naming `.env.local` |
   | `permission-denied` | `permission-denied` | Other permission or classifier denials |
   | `commit-msg-hook` | `commit-msg-recovery` | `git commit` rejected by commitlint |
   | `pre-commit-hook` | `pre-commit-rejected` | `git commit` rejected by `check:repo --staged` |
   | `missing-file` | `missing-file` | File does not exist, `ENOENT`, `No such file` (outside check commands) |
   | `repeated-command` | `repeated-command` | The same call twice in a row |
   | `e2e-rerun` | `e2e-rerun` | An e2e run after an earlier one failed |
   | `scratch-outside` | `scratch-files-in-repo` | A write to `tests/e2e/zz-*`, `scripts/_*` or `scripts/.*` |
   | `scratch-dir-deleted` | `scratch-dir-deleted` | `rm -r` of the whole `.scratch/` |
   | `user-rejected`, `check-failed`, `unclassified` | none | A rejected call; a failing check or empty search (normal work); anything else |

3. **Judge a sample.** Sessions with unclassified failures, rejections or interruptions, the `grader.flagTop` with the most tagged findings, and a seeded `grader.sampleRate` share of the rest (at most `grader.maxJudged`) go to `claude -p` with the `grader` model at `low` effort, no tools, no saved session, run outside the repo. The prompt is the rubrics in `.agents/skills/grade/rubrics/` (efficiency, unlogged corrections), the date, pattern and where of each logged correction, and the condensed trace, never raw JSONL. Judging stops at `grader.tokenCap` reported tokens.
4. **Report.** Failures by class, proposed rows in `docs/CORRECTIONS.md` → Log format (date, tag, sessions and PRs, the class's fixed paraphrase and likely fix, `trace`, `open`; tags not yet in the log marked new), per-session metrics, the judged sample, and a hidden `grade-metrics` block that `pnpm metrics` reads. It holds counts, tags, session ids and fixed paraphrases; judge notes are capped, and quotes, code, paths and secret-like strings are replaced.

`.github/workflows/grade.yml` (staged in `.github/workflow-drafts/` until the owner moves it) runs `pnpm grade --source factory --issue` every Tuesday over the last full ISO week (Monday to Sunday) and on demand (`since`, `until` inputs), creating or updating the issue "Grading report <ISO week>". A run with `since` or `until` set gets its own issue, "Grading report <since> to <until>", which `pnpm metrics` ignores, so it never overwrites the weekly numbers. The owner adds `agent-ready` to have the factory append the rows, or closes it. The grader never edits skills, rules or the log, and decrypted transcripts never leave the runner's `.scratch/` (no artifacts: anyone signed in can download those on a public repo).

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
| Factory (W14, W24) | `.github/workflows/factory.yml` (supports `dry_run`), `.github/factory/config.json`, `scripts/factory/`; owner setup: GitHub App `tablekeeper-factory` (`FACTORY_APP_ID`, `FACTORY_APP_PRIVATE_KEY`), `FACTORY_SESSION_KEY`, `FACTORY_PROJECT_TOKEN` (`read:project` fallback, required for personal-account Projects), "Factory" Project (#1), `FACTORY_ENABLED` variable |
| Merge authority (W19) | `.github/workflows/merge.yml` (staged in `.github/workflow-drafts/merge.yml` until the owner moves it), `.github/factory/merge-policy.json`, `scripts/factory/merge*.ts`; uses the factory App token, `CLAUDE_CODE_OAUTH_TOKEN` and `FACTORY_SESSION_KEY` (rebase only); creates the `shadow:merge` and `shadow:escalate` labels on first use |
| `FACTORY_SESSION_KEY` | Repo secret that encrypts session artifacts. Keep the owner's copy at `~/.config/tablekeeper/factory-session-key` (mode 600) and in a password manager, because GitHub never shows a secret again; to audit factory transcripts, decrypt with it (`scripts/factory/session.ts`). To rotate: `(umask 077 && openssl rand -base64 32 > ~/.config/tablekeeper/factory-session-key)`, then `gh secret set FACTORY_SESSION_KEY < ~/.config/tablekeeper/factory-session-key`; artifacts encrypted with the old key become unreadable |
| Gemini CLI and Gemini Code Assist on GitHub | Retired for consumer accounts in 2026; don't use |

### First-run record (W24, 2026-11-18)

- **Project access:** The `tablekeeper-factory` GitHub App token cannot resolve user-owned `ProjectV2` #1 (`mtroque`); `scripts/factory/project.ts` uses `FACTORY_PROJECT_TOKEN` as a read-only fallback (`PVT_kwHOCs72xs4BsI0O`).
- **Models:** `.github/factory/config.json` uses `claude-opus-5-5` (builder) and `claude-sonnet-5-5` (reviewer).
- **Verified live:** `dry_run` queue order (`44274745199`), Project drag-to-reorder (`44275212233`), `metrics.yml` (`44275219305`, issue #21), `FACTORY_ENABLED=false` kill switch (`44342148513`), live build + encrypted session restore + `claude --resume` fix loop + `maxRounds` `needs-human` (`44297797747` → PR #24 → `44326746493`), second live build (`44337220749` → PR #28), and owner PR `review` label + same-commit no-op rerun (`44342809794` on PR #31).
- **App permission note:** `tablekeeper-factory` lacks `workflows` write permission, so factory PRs that touch `.github/workflows/` stage drafts in `.github/workflow-drafts/` for the owner to move before merging.
