---
description: Merge finished worktrees into main, update shared docs, sync and clean up
argument-hint: [worktree name or branch]; empty = every ready one
---
Merge $ARGUMENTS (or, if empty, every ready branch, oldest finished first, stopping at the first failure). Run from the main checkout, clean, on `main`.

1. **Ready** = commits ahead of main, clean worktree, and every slice spec it changed is ✅ or still ⬜ (none 🟨 or ⏸).
2. **Rebase** in its worktree (`git worktree list`): `git rebase main`. Resolve trivial conflicts; if one is in code the branch doesn't own, `git rebase --abort` and report.
3. **Verify** there: `pnpm install`, then the full check from AGENTS.md → Definition of done step 1. Stop on failure.
4. **Merge** in main: `git merge --ff-only <branch>` and rerun the full check. On failure, `git reset --keep ORIG_HEAD` and report.
5. **Shared docs:** set each merged slice's status in docs/ROADMAP.md from its spec, and append its `## Decisions` to docs/DECISIONS.md once (next D-number). Commit `docs: merge <branch>`.
6. Run `scripts/worktrees.sh sync`, then `scripts/worktrees.sh clean`, and report both outputs.
