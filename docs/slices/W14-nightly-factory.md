# W14: Factory runner

**Status:** ⬜ · **Depends on:** W4, W7

**Goal:** Work moves without anyone at the keyboard and without the owner's machine: every 5 hours a GitHub Actions workflow takes the top `agent-ready` issue, builds it with Claude Code headless on its own branch, and opens a PR whose session can be resumed later (W11). Merging stays manual until W19.

## Owns
- `.github/workflows/factory.yml`, `.github/factory/config.json`, `scripts/factory/` (config schema, queue picker, session store) with tests, `.agents/skills/issue/SKILL.md` (issue-to-PR for tasks that aren't slices), `README.md` (Commands), `docs/AUTOMATION.md` (Agents and budget → schedule and caps)

## Scope (must cover)
- **Schedule:** `cron: '0 */5 * * *'` (UTC) plus `workflow_dispatch`; a `concurrency` group so only one factory run is active, never cancelling one in progress. It won't line up with usage-limit resets, and doesn't need to.
- **Config** (`.github/factory/config.json`, Zod-validated in `scripts/factory/config.ts`): `enabled`, `tasksPerRun` (1), `builder` and `reviewer` each with `agent` (only `claude` implemented; the schema leaves room for `codex` and `agy`), `model`, `effort`, a run timeout and max turns. Kill switch: the repo variable `FACTORY_ENABLED` (off without a commit), checked first.
- **Queue:**
  - Issues labeled `agent-ready`; only collaborators can add labels on this public repo, so issue text reaches an agent only after the owner labels it.
  - Ordered by their position in the "Factory" GitHub Project (manual drag order, read through the GraphQL API ordered by `POSITION`; if that doesn't reflect the drag order, fall back to a number field `Rank` and record why).
  - Take the first issue that isn't labeled `needs-human` or `in-progress`, has no open PR, and isn't blocked (a linked spec's `Depends on` not ✅ in `docs/ROADMAP.md`, or an open "blocked by" issue). Label it `in-progress`.
  - A slice issue links its spec, which stays the source of truth; any other issue carries its own acceptance list and is built with `/issue`. `pnpm queue:sync` opens issues for ROADMAP slices that don't have one yet (unlabeled, so the owner decides).
  - The picker is a pure function with unit tests; the workflow only fetches and acts.
- **Build:**
  - Branch `factory/<issue>-<slug>` from `main`. Environment as in W7: pnpm install, a Postgres service, `LLM_PROVIDER=fake`, no production secrets.
  - Mark the checkout trusted in `~/.claude.json` so `.claude/settings.json` allow rules apply (the W18 test showed they're ignored otherwise); anything not allowed is denied. Never `--dangerously-skip-permissions`.
  - Run `claude -p` with `/build <id>` or `/issue <n>`, the configured model and effort, `--output-format stream-json` saved to a file.
  - Push and open the PR with a GitHub App or fine-grained token, not `GITHUB_TOKEN`, so W11's `pull_request` workflow fires. The PR body follows the template: `Closes #<n>`, runner `claude-actions`, session id, Actions run link.
- **Session store:** after every run, encrypt the session folder (`~/.claude/projects/-home-runner-work-tablekeeper-tablekeeper/`) with a key from a repo secret and upload it as an artifact named after the session id; a restore helper downloads, decrypts and puts it back at the same path. Artifacts on a public repo are downloadable by signed-in users, so nothing is uploaded unencrypted. Retention is long enough for W11's fix rounds and W16's grading.
- **Outcomes:** ⏸ or a failed run comments on the issue with the reason, labels it `needs-human` and removes `in-progress`; a usage-limit error leaves the issue queued for the next run and says so in the job summary.

## Acceptance criteria
- [ ] With two `agent-ready` issues in the Project, a manual run builds the top one and opens a PR with `Closes #n` and its session id, and the PR triggers a `pull_request` workflow
- [ ] Dragging the second issue above the first changes which one the next run takes
- [ ] Setting `FACTORY_ENABLED=false` makes the next run exit before picking anything
- [ ] A session artifact can't be read without the key, and the restore helper brings it back so `claude --resume` continues it in another job

## Out of scope
- Reviews and fix rounds (W11). Merging (W19). Grading runs (W16). Codex and Antigravity runners.

## Open questions
- GitHub App or fine-grained token for pushing and opening PRs? The App is cleaner (its own identity, no expiry to rotate); decide and record.
- How does a factory run share the Claude Pro limit with interactive use? Record a week of usage before raising `tasksPerRun`.

## Decisions

## Corrections

## Shared change requests
