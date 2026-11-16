---
name: status
description: What every worktree and open PR is doing and what needs me (read-only)
disable-model-invocation: true
---
From the main checkout, without changing files:

1. Run `scripts/worktrees.sh status`, and `tmux list-windows -t <session it names>` if tmux is installed.
2. For each worktree and open PR, read the slice specs it changed (`docs/slices/<id>-*.md`): status, unchecked criteria, shared change requests, open questions.
3. Report, shortest first: **Needs me now** (⏸ slices, failing PR checks, questions, shared change requests, exited sessions with unfinished work) · **Ready to merge** (open PRs with green checks and ✅ specs, per /merge's rule) · **In progress** (one line each: worktrees and open PRs with pending checks) · **Suggested next command**.
