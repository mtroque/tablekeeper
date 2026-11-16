# W18: Factory plan

**Status:** 🟨 · **Depends on:** none

**Goal:** Replan the factory slices around what the owner wants and what a test showed works: a Claude Code runner on GitHub Actions every 5 hours, a queue of GitHub issues ordered in a Project, a review on every factory PR whose findings go back to the session that built it, and merge authority that starts in shadow mode and widens by config.

## Owns
- `docs/slices/W14-nightly-factory.md` (rewritten as the factory runner)
- `docs/slices/W11-review-bots.md` (rewritten as the review loop)
- `docs/slices/W19-merge-authority.md` (new)
- `docs/slices/W16-session-grading.md` (Privacy line)
- `docs/AUTOMATION.md` (Target flow, Review policy, Auto-merge policy, Agents and budget)

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
- [ ] W14, W11 and W19 specs describe the runner, the review loop and merge authority as above, with dependencies that form no cycle
- [ ] `docs/AUTOMATION.md` matches them, and W16 stores traces only encrypted
- [ ] The roadmap changes `/merge` must make are listed under Decisions

## Out of scope
- Building any of it. Codex and Antigravity runners (later, behind the same config).

## Open questions

## Decisions
- **Roadmap changes for `/merge`** (`docs/ROADMAP.md` is a shared doc):
  - W11 row: `Review loop: every factory PR reviewed, findings resumed into the builder's session` · depends on `W14`.
  - W14 row: `Factory runner: Claude Code on Actions every 5 hours, Project-ordered issue queue` · depends on `W4, W7`.
  - New W19 row: `Merge authority: reviewer verdict plus fixed rules, shadow mode first, per-area policy file` · depends on `W7, W11, W12`.
  - Next, step 6: `W7, then W14, then W11; W12, then W13, W16 and W19.` (replacing steps 5 and 6 as they stand; W10 stays after W7).
- **Decision entry for `/merge`:** the factory runs Claude Code headless on GitHub Actions on a fixed 5-hour schedule, takes `agent-ready` issues in Project order, resumes the builder's session to apply review findings, and merges only within a policy file that starts in shadow mode. Why: no dependence on the owner's machine, everything versioned in the repo, resume verified across runners, and authority widened only with evidence.

## Corrections

## Shared change requests
