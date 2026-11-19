# W16: Session grading

**Status:** 🟨 · **Depends on:** W12, W14

**Goal:** Find what goes wrong in agent sessions even when nobody corrects it: failed and refused tool calls, workarounds for stale docs or environment gaps, wasted reruns. Findings become `trace` rows in `docs/CORRECTIONS.md`, so they reach `/harden` like any other correction, and their counts join W12's metrics so a fix shows up as a number moving.

## Owns
- `scripts/grade-sessions.ts`, `scripts/lib/traces/` (parsers, classifier, report) with tests
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
- [ ] `pnpm grade --since 2026-10-23 --until 2026-11-16` over local transcripts finds the patterns logged as `trace` on 2026-11-16 (paste the summary)
- [ ] A manual `grade.yml` run grades the week's factory sessions within its token cap and opens the report issue
- [ ] `git grep` finds no transcript text in the repo after a run, and the report issue holds only counts, tags and paraphrases

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

## Corrections

## Shared change requests
