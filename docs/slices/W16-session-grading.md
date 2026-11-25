# W16: Session grading

**Status:** ⏸ (built and tested; waiting on the owner: (1) move `.github/workflow-drafts/grade.yml` to `.github/workflows/grade.yml` and delete its two-line header (the factory's App token can't push workflows), then run it once from the Actions tab and check the issue; (2) on the machine with the old transcripts, run `pnpm grade --since 2026-10-23 --until 2026-11-16 --no-judge` and paste the summary; then tick the criteria and fold the spec) · **Depends on:** W12, W14

**Goal:** Find what goes wrong in agent sessions even when nobody corrects it: failed and refused tool calls, workarounds for stale docs or environment gaps, wasted reruns. Findings become `trace` rows in `docs/CORRECTIONS.md`, so they reach `/harden` like any other correction, and their counts join W12's metrics so a fix shows up as a number moving.

## Owns
- `scripts/grade.ts`, `scripts/lib/traces/` (parsers, classifier, report) with tests
- `.agents/skills/grade/` (`SKILL.md` and `rubrics/*.md`), `.github/workflows/grade.yml` (staged as `.github/workflow-drafts/grade.yml` until the owner moves it: the factory's App token can't push workflows)
- `.github/factory/config.json` (a `grader` block), `scripts/lib/metrics/` and `scripts/metrics.ts` (the trace columns), `package.json` (`grade` script), `README.md`, `docs/AUTOMATION.md` (a Grading section)
- `docs/slices/W16-session-grading.md`

## Scope
- **Collect:** session transcripts for this repo from every runner. Link each session to its PR through the session id in the PR body.
  - Claude Code local: `~/.claude/projects/<repo path>*/*.jsonl` (main checkout and worktrees).
  - Antigravity CLI: `~/.gemini/antigravity-cli/brain/<conversation-id>/.system_generated/logs/transcript_full.jsonl` (`transcript.jsonl` beside it is truncated; the IDE app uses `~/.gemini/antigravity/brain/`). One JSON line per step with `step_index`, `created_at`, `status` (`DONE`, `ERROR`, `INVALID`), `source`, `type` (`USER_INPUT`, `PLANNER_RESPONSE`, `GENERIC`, `SYSTEM_MESSAGE`) and `content`; `PLANNER_RESPONSE` steps add `tool_calls`, `model` and token counts. A failed command shows `Command exited with code N` in `content`. Per-step model and tokens give cost per slice and show mid-session model switches.
  - Factory runs: W14's encrypted `session-<id>` artifacts, restored with its helper.
- **Condense, then classify without a model** (`scripts/lib/traces/`):
  - Each session becomes user turns, tool calls (name plus a short argument), tool errors and final messages. A transcript of tens of MB becomes a few KB.
  - Failures are classified by pattern: worktree-guard refusals, permission and classifier denials, commit-hook rejections, missing files, repeated identical commands, e2e reruns, scratch files written outside `.scratch/`. Each class has a fixed `trace` tag (reusing the 2026-11-16 tags where they fit).
  - Metrics per session: tool calls, failures by class, user turns, interruptions.
  - This step found nearly everything in the 2026-11-16 pass on its own.
- **Judge a sample:** only sessions the classifier flags (most failures, or failures it can't classify), plus a random 10%, go to a model, as condensed traces, never raw JSONL. Two short rubrics to start, each with a criterion, labels and a pass line:
  - **Efficiency:** did the agent reach the result without spinning?
  - **Unlogged corrections:** did the user correct the agent, and is that in the log?

  Add rubrics only when a finding needs one.
- **Report:** proposed `trace` rows (pattern tag, where, what was wrong, likely fix: environment, docs, skill or check), reusing existing tags. `pnpm grade` prints it locally. `grade.yml` (weekly, Tuesday, and on demand) grades the factory's sessions and opens one issue "Grading report <week>" with the rows and counts. The owner adds `agent-ready` to have the factory log them, or closes it. The grader never edits skills, rules or the log itself.
- **Metrics:** failed tool calls per session and failures by class, per week, as W12 columns.
- **Privacy:** the repo is public. Never commit transcript text; reports and issues hold counts, tags and short paraphrases only. Raw and condensed traces stay in the run's own `.scratch/<session>/` or in W14's encrypted artifacts, never in plain artifacts (anyone signed in can download those on a public repo).

## Acceptance criteria
- [ ] `pnpm grade --since 2026-10-23 --until 2026-11-16` over local transcripts finds the patterns logged as `trace` on 2026-11-16 (paste the summary). Not verifiable on the factory runner, which holds only its own session: each 2026-11-16 pattern (`worktree-command-refused`, `preflight-reads-denied-file`, `scratch-files-in-repo`, `scratch-dir-deleted`, `commit-msg-recovery`) has a classifier test on hand-written transcripts, and `pnpm grade --since 2026-11-19 --no-judge` over this build's own session printed 1 session, 53 calls, 2 failures (`missing-file` 2)
- [ ] A manual `grade.yml` run grades the week's factory sessions within its token cap and opens the report issue (needs the owner to move the draft; the judge path is covered by `parseJudgeOutput` tests and skipped cleanly when `claude -p` isn't signed in, as in this runner's shell)
- [ ] `git grep` finds no transcript text in the repo after a run, and the report issue holds only counts, tags and paraphrases (local part checked: after the run above, `git status --ignored` shows only `.scratch/`, `git grep 05e672d7` finds nothing, and the report holds no command or output from the session; the issue part needs the `grade.yml` run)

## Tests
- Parsers on small fixture transcripts (Claude and Antigravity formats, written by hand, no real session text).
- Classifier: one case per failure class, an unknown error left unclassified.

## Out of scope
- Acting on findings automatically (the owner decides; `/harden` promotes). Grading other repos.

## Open questions
None left. Resolved from the docs and the code:
- **Grader config:** `.github/factory/config.json` gets a `grader` block parsed by its own schema in `scripts/lib/traces/config.ts`; `scripts/factory/config.ts` (W14, not owned) strips unknown keys, so the factory and review loops are unaffected.
- **Which failures are normal work:** a failing test, typecheck, lint or verify run, or a search that matched nothing, is how building works; they count as `check-failed` (shown in metrics, never proposed as a row). Only the fixed classes become rows; any other failed call is `unclassified` and flags its session for the judge.
- **Privacy in the report:** rows use the class's fixed paraphrase, session ids, branches and PR numbers, never a command or output from the transcript. Judge notes are capped and stripped of quotes and code.
- **Metrics source:** `grade.yml` runs on Actions, so `pnpm metrics` reads the counts back from the "Grading report <week>" issues (a hidden `grade-metrics` JSON comment) and adds two columns.
- **Judge cost:** `claude -p` with no tools, no session persistence, `--effort low`, JSON output; the run stops judging once reported tokens reach `grader.tokenCap`.

## Decisions
- The judge is Claude at the lowest effort with the model in the `grader` block. Factory sessions are graded on Actions, where `agy` can't sign in yet (W18). Local runs can point the block at another model.
- Depends on W14 for factory session artifacts; W4 is done.
- **Judge settings:** `grader.model` is `claude-haiku-5-5` at `low` effort; `claude -p` runs with `--tools ""`, `--no-session-persistence`, `--json-schema` and `cwd` in the OS temp dir, so it loads no project instructions, saves no session to be graded later, and answers in a checked shape. A first call that returns no answer and no tokens (signed out, CLI error) stops judging instead of failing every pick.
- **Normal failures are not rows:** failing checks (`pnpm verify`, tests, typecheck, lint, Playwright) and searches with no match are `check-failed`; they count in the report and metrics but never become rows. Failed calls nothing matches are `unclassified` and flag the session for the judge.
- **Report privacy by construction:** rows use each class's fixed paraphrase and likely fix (`CLASSES` in `scripts/lib/traces/classify.ts`), plus counts, session ids, branches and PR numbers. Judge notes have code spans and quotes replaced and are capped at 160 characters.
- **Metrics:** `pnpm metrics` reads each week's counts from the hidden `grade-metrics` block of the "Grading report <week>" issue, since grading runs on Actions and the factory's transcripts never reach the metrics job. Columns: failed calls per session and the top 3 classes other than `check-failed`.
- **Config:** the `grader` block is parsed by `scripts/lib/traces/config.ts`; `scripts/factory/config.ts` strips unknown keys, so no shared change was needed.
- **Workflow as a draft:** `grade.yml` was staged in `.github/workflow-drafts/` without trying the push, since W10 and W26 showed the App token can't push workflows. It uses `github.token` (`actions: read` for the artifacts, `issues: write`), uploads nothing, and deletes `.scratch/grade` at the end.
- **Candidate check (not added, `forbidden-files.ts` not owned):** `check:repo` could reject `*.jsonl` outside `scripts/lib/traces/fixtures/`, so a transcript can never be committed by mistake.

## Corrections
| Date | Pattern | Where | What was wrong | Correction | Source | Status |
|---|---|---|---|---|---|---|
| 2026-11-19 | `classifier-false-positive` | W16, `scripts/lib/traces/classify.ts` | The scratch-file detector matched paths inside a heredoc body, flagging a fixture write as `scratch-files-in-repo`; found by grading this build's own session | Shell writes are matched only before `<<` and only as a redirect, `tee`, `touch`, `cp` or `mv` target; test added | self | open |
| 2026-11-19 | `report-key-collision` | W16, PR #33, `scripts/grade.ts` | The report issue was keyed by the ISO week of `--until`, so a manual run over a custom range overwrote that week's report and the metrics block `pnpm metrics` reads | Custom ranges get their own dated title; `pnpm metrics` reads only weekly titles | review | open |
| 2026-11-19 | `unsanitized-model-output` | W16, PR #33, `scripts/lib/traces/judge.ts` | Judge notes for a public issue were only stripped of quotes and code, so a path or secret-like string could pass | Paths, file names and long token-like runs are replaced too; test added | review | open |
| 2026-11-19 | `spec-owns-stale-path` | W16, PR #33 | `## Owns` named `scripts/grade-sessions.ts`, but the entry point was built as `scripts/grade.ts`, so ownership didn't match the code | Owns updated to `scripts/grade.ts` | review | open |
| 2026-11-25 | `report-key-collision` | W16, PR #33, `scripts/grade.ts` | The default window was the 7 days ending on the run day, so the Tuesday run graded mostly the previous week but titled the issue with the current ISO week, shifting `pnpm metrics` rows by a week | The default window is the last full ISO week (`lastFullWeek`); test added | review | open |

## Shared change requests
