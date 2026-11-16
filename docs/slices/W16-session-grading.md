# W16: Session grading

**Status:** ⬜ · **Depends on:** W4, W12

**Goal:** Find what goes wrong in agent sessions even when nobody corrects it: failed and refused tool calls, workarounds for stale docs or environment gaps, wasted reruns. Findings become `trace` rows in `docs/CORRECTIONS.md`, so they reach `/harden` like any other correction, and their counts join W12's metrics so a fix shows up as a number moving.

## Owns
- `scripts/grade-sessions.ts`, `scripts/lib/traces/`, `.agents/skills/grade/` (`SKILL.md` and `rubrics/*.md`), `scripts/metrics.ts` (trace rows only), `docs/AUTOMATION.md` (a Grading section)

## Scope (must cover)
- **Collect:** read session transcripts for this repo from every runner: Claude Code local (`~/.claude/projects/<repo path>*/*.jsonl`, main checkout and worktrees), Claude cloud runs and `agy` runs (wherever W14 saves them). Link each session to its PR through the session id W4 puts in the PR body.
- **Deterministic first:** a script condenses each session (user turns, tool calls, tool errors, final messages) and classifies failures without a model: worktree-guard refusals, permission denials, commit-hook rejections, repeated commands, e2e reruns, scratch files written into the repo. Most of the 2026-11-16 pass came from this step alone.
- **Judge a sample:** only flagged or sampled sessions go to a model, batched (see `docs/AUTOMATION.md` → Agents and budget), as condensed traces, never raw JSONL. Start with two short rubrics, each with a criterion, labels and a pass line: efficiency (reaching the result without spinning) and unlogged corrections (did the user correct the agent, and is it in the log?). Add rubrics only when a finding needs one.
- **Report:** proposed `trace` rows (pattern tag, where, what was wrong, likely fix: environment, docs, skill or check), reusing existing tags. A human or `/harden` decides what gets promoted; the grader never edits skills or rules itself.
- **Metrics:** per week, failed tool calls per session and refusals by cause, added to W12's table.
- **Privacy:** the repo is public. Never commit transcript text; reports hold counts, tags and short paraphrases only. Raw and condensed traces stay in `.scratch/` or CI artifacts.

## Acceptance criteria
- [ ] Run over the 2026-10-23 to 2026-11-16 sessions, it finds the patterns logged as `trace` on 2026-11-16 (show the output)
- [ ] One week of new sessions graded within the run's token cap, with proposed rows and the metrics rows printed
- [ ] `git grep` finds no transcript text in the repo after a run

## Out of scope
- Acting on the findings automatically (W14 schedules the run; `/harden` promotes).

## Open questions
- Which pool judges: `agy -p` batches on the Google quota, or Claude at low effort? Try both on the same 20 sessions and record.

## Decisions

## Corrections

## Shared change requests
