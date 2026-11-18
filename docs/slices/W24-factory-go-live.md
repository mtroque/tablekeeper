# W24: Factory go-live

**Status:** 🟨 (live since 2026-11-18: dry runs, two builds (PR #24 W26, PR #28 W10) and two review loops ran; the first-run fixes below are open) · **Depends on:** none

**Goal:** The factory, review loop and metrics actually run on GitHub, and every live acceptance criterion W11, W12 and W14 left unchecked is verified. Those slices were finished with unit tests only (PR #13), so as of 2026-11-18 no factory, review or metrics workflow has ever run for real.

## Owns
- `.github/workflows/factory.yml`, `.github/workflows/review.yml`, `.github/workflows/metrics.yml`, `.github/factory/config.json`
- `scripts/factory/` (Project access, dry run), `scripts/review/`, `scripts/metrics.ts` with tests
- `docs/AUTOMATION.md` (Accounts and setup; the factory's first-run record), `README.md` (Factory section)
- First-run fixes: `.claude/skills/build/SKILL.md`, `.agents/skills/build/SKILL.md` (`Closes`/`Refs`, filing outside findings), `scripts/preflight.mjs` (CI), `scripts/lib/verify/` and the `Checks` job in `.github/workflows/ci.yml` (actionlint only)

## Scope
- **Project access:** `scripts/factory/project.ts` reads the "Factory" Project through the GitHub App installation token. GitHub Apps generally can't read Projects owned by a personal account, so the first run will likely fail to read the queue.
  - Verify with a dry run first.
  - If it fails, read the Project with a separate classic token that has only `read:project` (secret `FACTORY_PROJECT_TOKEN`). Keep the App token for everything else.
  - Record the result either way.
- **Dry run:** a `workflow_dispatch` input `dry_run` that picks the next issue and prints why each earlier one was skipped, without building, labeling or opening anything. It's the first thing to run, and the safe way to check the queue later.
- **Models:** the config names `claude-sonnet-4-6` for builder and reviewer, which is out of date. Set current models (builder `claude-opus-5-5`, reviewer `claude-sonnet-5-5`, as a starting point the owner can change) and record the choice.
- **Live verification of the carried-over criteria:**
  - **W14:** with two `agent-ready` issues in the Project, a manual run builds the top one and opens a PR with `Closes #n` and its session id, and that PR triggers `review.yml`. Dragging the second issue above the first changes the next pick. `FACTORY_ENABLED=false` makes the next run exit before picking. A session artifact can't be read without the key and is restored by `session.ts` in another job, where `claude --resume` continues it. A slice that stops on ⏸ leaves its issue labeled `needs-human` with the reason.
  - **W11:** a factory PR with a planted bug gets a blocking finding, the resumed builder session (same id) fixes it, and the next review is clean. A PR still blocked after `maxRounds` gets `needs-human`. Rerunning on the same head commit posts no second review. An owner PR labeled `review` gets findings and no fix round.
  - **W12:** a manual `metrics.yml` run updates the pinned "Factory metrics" issue.
- **Fixes from the first live runs** (transcript and run-log audit, 2026-11-18; rows in `## Corrections`):
  - **Builder output never buffered:** `scripts/factory/run.ts` streams `claude -p --output-format stream-json` to a file instead of `spawnSync` buffering it (crashed twice: `stdout` undefined in run 44275657268, `ENOBUFS` in run 44328772893; PR #26's 64MB limit only moves the cliff). The session artifact uploads with `if: always()`, found from the stream file or the newest `.jsonl`, so a crash still leaves a transcript, and the crash path comments on the issue with the run link.
  - **Fix rounds keep their sessions:** `review.yml` uploads the resumed session after each fix round (`session-<id>-r<round>`), and restore takes the latest round, so round 2 resumes round 1's work, not the original build.
  - **A fix round doesn't cancel itself:** the round's own push starts a new `Review` run, which cancelled the running one (runs 44325881925 and 44326540795, no logs, no session). Use `cancel-in-progress: false` (runs queue; the same-head-commit guard already stops duplicate reviews).
  - **The first review waits for the session:** `review.yml` starts when the PR opens, but `factory.yml` uploads the session only when the build ends, so the first review on PR #24 failed to download it. Wait (bounded) for the factory run on that branch to finish, or skip the fix round with a clear log line and let the next push retry.
  - **Reviewer transcripts kept:** the reviewer runs with `--output-format stream-json` into a file, encrypted and uploaded like the builder's (`review-<pr>-r<round>`). Today its output is discarded, so its reasoning can't be graded (W16).
  - **Verdict follows the gate:** when a finding is at or above `blockingSeverity`, the posted verdict is `fix`, whatever the model said (PR #24's last review said `merge` at 0.70 with a should-fix, then got `needs-human` from `maxRounds`). The `needs-human` label comes with a comment saying why.
  - **Reviewer sees earlier rounds:** the prompt includes prior findings and their `fixed in`/`disputed:` replies, so it doesn't re-raise them (the deploy-wait race came up in 3 rounds), and lists what `pnpm check:repo` already enforces (it asked twice whether W26's criteria were moved).
  - **Paused slices don't close their issue:** the build skill writes `Closes #n` only when the spec is folded; a ⏸ slice writes `Refs #n`. `run.ts` checks after the build: if the slice's spec still exists on the branch, it rewrites `Closes` to `Refs` and labels the issue `needs-human` with the ⏸ reason. Merging PR #24 closed #19 as completed with four criteria open; PR #28 (W10) has the same body.
  - **Findings outside the slice get filed:** the build skill opens an issue (labeled `bug`, not `agent-ready`) for each problem found outside the slice, and links it in the PR. W10 found that saving offline never shows "You're offline.", and it is only in W10's spec.
  - **Workflow files:** see Open questions.
  - **Project read:** `project.ts` tries `FACTORY_PROJECT_TOKEN` first when it is set; every run now starts with the App token's "Could not resolve to a ProjectV2" error, which looks like a real failure.
  - **Preflight on runners:** `pnpm preflight` reports a missing `.env.local` as `info` (not a failure) when `CI` is set; all three factory transcripts open with a failed preflight the agent has to dismiss.
  - **actionlint in `pnpm verify` and CI:** the W26 builder downloaded actionlint mid-run, and review still found three `smoke.yml` bugs over three rounds.
  - **PR body records the models:** the runner appends builder and reviewer model and effort to the PR's `## Session` (acceptance criterion 3); the agent can't see them.
  - **Turn budget:** `maxTurns` 80 made the W10 builder write "Turn budget is limited, so I'm moving fast" and batch edits into long shell chains after spending about 35 turns reading. Raise the builder to 150 and record the turns used per run in the metrics report.
  - **Actions on Node 24:** every run warns that `checkout`, `setup-node`, `upload-artifact`, `create-github-app-token` and `pnpm/action-setup` run on deprecated Node 20; move to their Node 24 majors.
- **First real task:** a small, low-risk issue (for example a docs fix or one W22 item) as the first `agent-ready` issue, so a failure costs little.

## Acceptance criteria
- [x] A dry run lists the queue in Project order with skip reasons: run 44274745199 (5 issues, #16 picked) and run 44275212233 (6 issues, #19 picked after reordering), both through the `FACTORY_PROJECT_TOKEN` fallback
- [ ] Every carried-over W14, W11 and W12 criterion above is verified, each with a run or PR link
- [ ] The config names current models, and the first real factory PR records them in its body
- [ ] A builder crash (simulated: kill `claude` mid-run) still uploads a decryptable transcript and comments on the issue
- [ ] A two-round review keeps both fix-round sessions and both reviewer transcripts as artifacts, and no `Review` run is cancelled by a fix round's push
- [ ] A factory PR for a slice that ends ⏸ says `Refs #n`, and its issue is labeled `needs-human` with the reason
- [ ] A review with a blocking finding posts verdict `fix`, and a `needs-human` label from `maxRounds` comes with a comment

## Tests
- Stream capture: output over 64MB is written to the file and parsed for the session id; a killed child still yields the id.
- Session restore picks the latest `-r<round>` artifact.
- Verdict gate: a `merge` verdict with a should-fix finding is posted as `fix`.
- `Closes` rewrite: a body with `Closes #n` and the spec still on the branch becomes `Refs #n`; a folded spec keeps `Closes`.
- Dry run: picks without side effects (no label, branch or PR calls), prints skip reasons.
- Project access: falls back to the read-only token when the App token is refused, with a clear error when neither works.

## Out of scope
- Merge authority (W19). Raising `tasksPerRun`.

## Open questions
- **Workflow files (owner):** the factory App has no `workflows` permission, so both W26 and W10 had to stage workflows in `.github/workflow-drafts/` and ask the owner to move them (and W26's round-2 fix came as a patch to apply by hand). Options: grant `workflows` to the App, with W19 never auto-merging a PR that touches `.github/workflows/` and review always marking it high risk; or keep drafts and add a `check:repo` rule that a draft can't be merged unmoved. Recommended: grant it, with the W19 rule, since every factory slice in the W series touches CI.
- **Reruns (owner):** the App can't rerun a failed job (`Resource not accessible by integration`); W26's E2E failed once on a Postgres container start. Grant `actions: write`, or leave reruns to the owner.

## Decisions
- Done early on the W20 branch: `.github/factory/config.json` names `claude-opus-5-5` (builder) and `claude-sonnet-5-5` (reviewer) instead of `claude-sonnet-4-6`. The models criterion stays open until the first real factory PR records them.

## Corrections
| Date | Pattern | Where | What was wrong | Correction | Source | Status |
|---|---|---|---|---|---|---|
| 2026-11-18 | `closes-paused-slice` | PR #24 (W26), PR #28 (W10) | A ⏸ slice's PR said `Closes #n`, as the build skill requires; merging #24 closed #19 as completed with four criteria open | `Refs #n` for ⏸ slices, checked by `run.ts` (W24); #19 reopened with `needs-human` | trace | open: second occurrence, check in W24 |
| 2026-11-18 | `factory-cannot-push-workflows` | PR #24 (W26), PR #28 (W10) | Push refused without the `workflows` permission; workflows staged as drafts, and a review fix posted as a patch for the owner | Owner decision (W24 Open questions) | trace | open: second occurrence |
| 2026-11-18 | `output-buffer-crash` | factory runs 44275657268, 44328772893 | `spawnSync` buffered the agent's stream: `stdout` undefined, then `ENOBUFS`; no transcript, no output in the log | 64MB buffer (PR #26); stream to a file (W24) | trace | open: second occurrence, fix in W24 |
| 2026-11-18 | `self-cancelled-fix-round` | PR #24, review runs 44325881925, 44326540795 | The fix round's push started a new review that cancelled the running one; the resumed session was never uploaded | `cancel-in-progress: false`, upload per round (W24) | trace | open |
| 2026-11-18 | `verdict-contradicts-gate` | PR #24 | Verdict `merge` with a should-fix finding; the gate labeled `needs-human` with no explanation | Verdict follows the gate (W24) | trace | open |
| 2026-11-18 | `review-repeats-finding` | PR #24 | The deploy-wait race raised in three rounds; twice asked about criteria `check:repo` enforces | Prior rounds and enforced checks in the review prompt (W24) | trace | open |
| 2026-11-18 | `preflight-fails-in-ci` | factory sessions `f7723ab4`, `c738266c`, `f3ed8221` | `pnpm preflight` exits 1 on the runner for a missing `.env.local`; every build starts with a failure to dismiss | `info` when `CI` is set (W24) | trace | open |
| 2026-11-18 | `out-of-slice-finding-unfiled` | PR #28 (W10) | Offline save never shows "You're offline."; recorded only in W10's spec Decisions | Build skill files an issue (W24) | trace | open |
| 2026-11-18 | `secret-without-local-copy` | owner setup | `FACTORY_SESSION_KEY` set from `$(openssl rand ...)` with no copy kept; recovering it needed a one-off workflow (PR #27) | Keep a local copy; rotation steps in `docs/AUTOMATION.md` → Accounts and setup (PR #29) | trace | promoted: `docs/AUTOMATION.md` row (prose: where an owner keeps a secret can't be checked) |
| 2026-11-18 | `stale-observation-reported` | trace audit of the factory | Reported issue #16 as stuck in `in-progress` from a snapshot taken while a factory run had just picked it | Check whether a run is in progress before calling state stuck; corrected in the report | self | open |

## Shared change requests
