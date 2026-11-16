# W14: Factory runner

**Status:** ⬜ · **Depends on:** W4, W7

**Goal:** Work moves without anyone at the keyboard and without the owner's machine. Every 5 hours a GitHub Actions workflow takes the top `agent-ready` issue, builds it with Claude Code headless on its own branch, and opens a PR whose session can be resumed later (W11). Merging stays manual until W19.

## Owns
- `.github/workflows/factory.yml`, `.github/factory/config.json` (all but W11's `review` block)
- `scripts/factory/` (config schema, queue picker, Project reader, session store, trust setup) with tests
- `.agents/skills/issue/SKILL.md` (issue-to-PR for tasks that aren't slices), `.agents/skills/build/SKILL.md` (the `claude-actions` runner and how it finds its session id), `.github/pull_request_template.md` (the runner list)
- `package.json` (`queue:sync` script), `README.md` (Factory section), `docs/AUTOMATION.md` (Agents and budget → schedule and caps; Accounts and setup → the factory token, Project and secrets)

## Scope
- **Schedule:** `cron: '0 */5 * * *'` (UTC) plus `workflow_dispatch` (with an optional issue number to build that one). A `concurrency` group so only one factory run is active, never cancelling one in progress. It doesn't line up with usage-limit resets, and doesn't need to.
- **Config** (`.github/factory/config.json`, Zod-validated in `scripts/factory/config.ts`):
  - `enabled`, `tasksPerRun` (1)
  - `builder` and `reviewer`, each with `agent` (only `claude` implemented; the schema leaves room for `codex` and `agy`), `model`, `effort`, `maxTurns`, `timeoutMinutes`
  - Kill switch: the repo variable `FACTORY_ENABLED`, checked before anything else, so it can be turned off without a commit.
- **Queue:**
  - Issues labeled `agent-ready`. Only collaborators can add labels on this public repo, so issue text reaches an agent only after the owner labels it (W12's groomer issues are the one machine-labeled source).
  - Ordered by position in the "Factory" GitHub Project: the manual drag order, read through the GraphQL API ordered by `POSITION`. If that doesn't reflect the drag order, fall back to a number field `Rank` and record why.
  - Take the first issue that isn't labeled `needs-human` or `in-progress`, has no open PR, and isn't blocked: a linked spec's `Depends on` not ✅ in `docs/ROADMAP.md`, or an open "blocked by" issue. Label it `in-progress`.
  - A slice issue links its spec (`docs/slices/<id>-*.md`), which stays the source of truth. Any other issue carries its own acceptance list and is built with `/issue`.
  - `pnpm queue:sync` opens an issue for each ⬜ ROADMAP slice that doesn't have one, unlabeled and added to the Project, so the owner orders it and adds `agent-ready`.
  - The picker is a pure function of issues, Project order and roadmap, with unit tests; the workflow only fetches and acts.
- **Build:**
  1. Check out `main` and create `factory/<issue>-<slug>` before starting, so `/build` keeps that branch.
  2. Environment as in W7's `E2E` job: pnpm install, a Postgres service, Playwright browsers, `LLM_PROVIDER=fake`, no production secrets.
  3. Mark the checkout trusted in `~/.claude.json` so `.claude/settings.json` allow rules apply (the W18 test showed they're ignored otherwise). Anything not allowed is denied. Never `--dangerously-skip-permissions`.
  4. Run `claude -p '/build <id>'` or `'/issue <n>'` with the builder's model, effort and max turns, `--output-format stream-json` saved to a file. The session id comes from the stream's first message.
  5. `/build` pushes and opens the PR with `GH_TOKEN` set to the factory token (a GitHub App installation token), not `GITHUB_TOKEN`, so W11's `pull_request` workflow fires. The PR body says `Closes #<n>`, runner `claude-actions`, the session id, and the Actions run link.
- **Session store:** after every run, `tar` the session folder (`~/.claude/projects/-home-runner-work-tablekeeper-tablekeeper/`), encrypt it with `openssl enc -aes-256-cbc -pbkdf2` and the `FACTORY_SESSION_KEY` secret, and upload it as artifact `session-<id>` (retention 30 days, enough for W11's rounds and W16's grading). Artifacts on a public repo are downloadable by signed-in users, so nothing goes up unencrypted. `scripts/factory/session.ts restore <id>` downloads, decrypts and puts it back at the same path.
- **Outcomes:**
  - PR opened: remove `in-progress`; the issue stays open until the PR merges.
  - ⏸ or a failed run: comment on the issue with the reason and the run link, label `needs-human`, remove `in-progress`.
  - A usage-limit error: put the issue back (remove `in-progress`), and say so in the job summary; the next run tries again.
- **Setup recorded in `docs/AUTOMATION.md` → Accounts and setup:** a GitHub App "tablekeeper-factory" (contents, pull requests and issues write; Projects read) installed on this repo only, its id and key as secrets, `FACTORY_SESSION_KEY`, the "Factory" Project, and the `FACTORY_ENABLED` variable.

## Acceptance criteria
- [ ] With two `agent-ready` issues in the Project, a manual run builds the top one and opens a PR with `Closes #n` and its session id, and the PR triggers a `pull_request` workflow
- [ ] Dragging the second issue above the first changes which one the next run takes
- [ ] `FACTORY_ENABLED=false` makes the next run exit before picking anything
- [ ] A session artifact can't be read without the key, and `session.ts restore` brings it back so `claude --resume` continues it in another job
- [ ] A slice that stops on ⏸ leaves its issue labeled `needs-human` with the reason

## Tests
- Picker: order, every skip rule, blocked by spec dependency and by issue link, nothing eligible.
- Config: valid, unknown agent rejected, defaults.
- Session store: encrypt, restore, wrong key fails clearly.

## Out of scope
- Reviews and fix rounds (W11). Merging (W19). Grading runs (W16). Codex and Antigravity runners.

## Open questions
- How does a factory run share the Claude Pro limit with interactive use? Record a week of usage before raising `tasksPerRun`.

## Decisions
- Claude Code first, on GitHub Actions: no dependence on the owner's machine, and everything is versioned in the repo. Antigravity waits because its scheduled automations run locally and no CI sign-in is documented (W18).
- A GitHub App, not a personal token: its own identity on PRs, no expiry to rotate, and scoped to this repo.

## Corrections

## Shared change requests
