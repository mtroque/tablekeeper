# W18: Factory plan

**Status:** ✅ · **Depends on:** none

**Goal:** Replan the factory slices around what the owner wants and what a test showed works: a Claude Code runner on GitHub Actions every 5 hours, a queue of GitHub issues ordered in a Project, a review on every factory PR whose findings go back to the session that built it, and merge authority that starts in shadow mode and widens by config.

## Owns
- `docs/slices/W14-nightly-factory.md` (rewritten as the factory runner)
- `docs/slices/W11-review-bots.md` (rewritten as the review loop)
- `docs/slices/W19-merge-authority.md` (new)
- `docs/slices/W16-session-grading.md` (Privacy line)
- `docs/AUTOMATION.md` (Target flow, Review policy, Auto-merge policy, Agents and budget, Accounts and setup)
- The other W stubs, expanded into full specs: `docs/slices/W6-effect-hooks.md`, `docs/slices/W7-ci-database.md`, `docs/slices/W8-property-tests.md`, `docs/slices/W9-cv-accuracy-gate.md`, `docs/slices/W10-screen-map.md`, `docs/slices/W12-groomer-metrics.md`, `docs/slices/W13-qa-explorer.md`, `docs/slices/W15-local-screenshots.md`
- Docs cleanup the owner asked for: `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CORRECTIONS.md`, and the finished specs folded and removed (`docs/slices/W1-ci-checks.md`, `docs/slices/W2-prose-to-lint.md`, `docs/slices/W3-repo-checks.md`, `docs/slices/W4-pr-workflow.md`, `docs/slices/W5-harden-command.md`, `docs/slices/W17-trace-followups.md`, `docs/slices/P3-patchwork-token-detection.md`, `docs/slices/X2-api-on-vercel.md`, `docs/slices/X3-neon-database.md`, `docs/slices/X4-neon-auth.md`)

## Scope
- **Runner:** Claude Code first, on GitHub Actions (not the owner's machine, not Antigravity yet). Fixed schedule every 5 hours. Agent, model, effort and on/off in one config file; one task per run to start.
- **Queue:** GitHub issues labeled `agent-ready`, ordered by position in a GitHub Project; slices are issues that link their spec, and any other task can be an issue too.
- **Review:** every factory PR gets a review; findings are posted on the PR and sent to the builder's own session (`claude --resume`), which fixes them with its full context.
- **Merge authority:** the reviewer's verdict plus fixed rules decide merge or escalate; per-area modes (`shadow`, `auto`, `escalate`) in a policy file, all `shadow` at first, widened later by editing one value.

### Evidence (2026-11-17)
- **Resume across runners works.** A test workflow ([run 43943592894](https://github.com/mtroque/tablekeeper/actions/runs/43943592894)) started `claude -p` with `CLAUDE_CODE_OAUTH_TOKEN` in one job, uploaded `~/.claude/projects/-home-runner-work-tablekeeper-tablekeeper/<session>.jsonl` as an artifact, restored it in a second job on a fresh runner, and `claude --resume <id> -p` continued the same session and recalled its earlier answer. Both calls together cost about $0.005 of usage.
- **Repo permissions are ignored in CI by default:** "Ignoring 38 permissions.allow entries from .claude/settings.json: this workspace has not been trusted." Workflows must mark the checkout trusted in `~/.claude.json` (or pass allowed tools explicitly).
- **Antigravity:** `agy --conversation <id> -p='...'` resumes a conversation headless locally, but its scheduled automations run on the local machine and no CI sign-in is documented, so it waits.
- Known GitHub behavior, not tested here: a PR opened with the workflow's `GITHUB_TOKEN` doesn't trigger other workflows, so the factory opens PRs with a GitHub App or fine-grained token. Artifacts on a public repo can be downloaded by signed-in users, so session files are encrypted before upload.

## Acceptance criteria
- [x] W14, W11 and W19 specs describe the runner, the review loop and merge authority as above, with dependencies that form no cycle
- [x] `docs/AUTOMATION.md` matches them, and W16 stores traces only encrypted
- [x] The roadmap changes `/merge` must make are listed under Decisions
- [x] Every remaining W stub (W6 to W16, W19) is a full spec from `docs/slices/_TEMPLATE.md`, with its open questions resolved or narrowed
- [x] Docs cleanup: `docs/ROADMAP.md` matches the specs, finished specs are folded into `docs/DECISIONS.md` and `docs/CORRECTIONS.md` and removed, and `docs/AUTOMATION.md` → Accounts and setup is current

## Out of scope
- Building any of it. Codex and Antigravity runners (later, behind the same config).

## Open questions

## Decisions
- **Shared docs updated on this branch**, because the owner asked for the docs cleanup here: `docs/ROADMAP.md` (W11, W13, W14, W16 rows and dependencies, new W17 to W19 rows, statuses, Next), the factory decision as D-087, and the folded specs' decisions (D-084 to D-086, D-088) and correction rows. `/merge` only needs to remove this spec.
- Dependency changes from expanding the stubs: W13 now depends on W7 and W10 (it runs in W7's environment, not on Vercel previews); W16 on W12 and W14 (factory session artifacts).
- X4 is done: the owner verified production Google sign-in on 2026-11-17, its last open criterion. Folded as D-088.

## Corrections

## Shared change requests
