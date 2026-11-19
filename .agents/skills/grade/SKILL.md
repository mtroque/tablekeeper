---
name: grade
description: Grade agent session transcripts for silent failures and propose trace rows for docs/CORRECTIONS.md
argument-hint: [--since YYYY-MM-DD] [--until YYYY-MM-DD]
disable-model-invocation: true
---
Grade this repo's agent sessions for the dates given with this command (default: the last 7 days), as described in `docs/AUTOMATION.md` → Grading.

1. **Run** `pnpm grade` with the dates given (`--since`, `--until`). Add `--no-judge` to skip the model and keep it to the deterministic classifier. It reads local Claude Code and Antigravity transcripts for this repo and its worktrees, writes condensed traces to `.scratch/grade/`, and prints the report.
2. **Show the report** to the user: the failures by class, the proposed `trace` rows, and the judged sample. Point out tags marked (new) and the sessions the judge failed.
3. **Don't act on it.** Never edit `docs/CORRECTIONS.md`, skills, rules or docs from a grading run, and never commit anything under `.scratch/grade/`. The user decides which rows to log (append them on a branch, or open an issue with them for the factory) and `/harden` promotes repeated patterns.
4. **Privacy:** the repo is public. When quoting the report anywhere, keep to counts, tags, session ids and the report's paraphrases; never paste trace or transcript text.
