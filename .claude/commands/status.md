---
description: What every worktree is doing and what needs me (read-only)
---
From the main checkout, without changing files:

1. Run `scripts/worktrees.sh status`, and `tmux list-windows -t <session it names>` if tmux is installed.
2. For each worktree, read the slice specs `status` lists for it (the ones it changed): status, unchecked criteria, shared change requests, open questions.
3. Report, shortest first: **Needs me now** (⏸ slices, questions, shared change requests, exited sessions with unfinished work) · **Ready to merge** (per /merge's rule) · **In progress** (one line each) · **Suggested next command**.
