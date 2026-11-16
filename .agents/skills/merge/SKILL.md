---
name: merge
description: Rebase ready PRs onto main, add shared-doc commits, wait for CI, and rebase-merge
argument-hint: [PR number, branch, or worktree name]; empty = every ready open PR
disable-model-invocation: true
---
Merge the PR, branch, or worktree given with this command (or, if none, every ready open PR, oldest first, stopping at the first failure). Run from the main checkout, clean, on `main`.

1. **Ready:** list open PRs (`gh pr list --state open --json number,headRefName,title,isDraft,statusCheckRollup,createdAt`). A PR is ready when it is not a draft, its `Checks` run passed, any local worktree for its branch is clean, and every slice spec it changed is ✅ or still ⬜ (none 🟨 or ⏸).
2. **Rebase on `main`:** `git fetch origin main` and `git pull --ff-only origin main` on `main`. Check out the PR's branch (in its worktree from `git worktree list` if one exists, otherwise `git switch <branch>` in the main checkout) and run `git rebase main`. Resolve trivial conflicts (such as additive wiring lines per `AGENTS.md` → Parallel sessions); if a conflict is in code the branch doesn't own, `git rebase --abort` and report.
3. **Verify:** `pnpm install`, then the full check from `AGENTS.md` → Definition of done step 1. Stop on failure.
4. **Shared docs (on the PR branch):** set each merged slice's status in `docs/ROADMAP.md` from its spec, and append its `## Decisions` to `docs/DECISIONS.md` once (next D-number) and its `## Corrections` rows to `docs/CORRECTIONS.md` → Log. If a moved row's pattern now appears twice and isn't promoted, list it in the report as a `/harden` candidate. For each ✅ spec, move anything else worth keeping (how a detector works, screen states, contracts, CI/eval numbers) to its home doc per `AGENTS.md`, point every reference to the spec at that home, and delete the spec. Commit `docs: merge <branch>` on the branch.
5. **Push, wait for CI, and merge:** `git push --force-with-lease origin <branch>`, run `gh pr checks <number> --watch` (stop on failure), then `gh pr merge <number> --rebase`. Return the main checkout to `main`, `git pull --ff-only origin main`, and `pnpm clean`.
6. **Sync and clean worktrees:** run `scripts/worktrees.sh sync`, then `scripts/worktrees.sh clean`, and report the merged PRs, any `/harden` candidates, and both script outputs.
