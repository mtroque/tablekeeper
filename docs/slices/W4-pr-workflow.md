# W4: PR workflow

**Status:** ⬜ · **Depends on:** W1, W3

**Goal:** All work reaches `main` through a pull request with green CI, instead of local fast-forward merges and direct pushes. Agents build on branches, open PRs that show how they verified their work, and `/merge` merges them one at a time. See `docs/AUTOMATION.md` → Target flow.

## Owns
- `AGENTS.md` (Workflow, Definition of done, Parallel sessions), `docs/CONVENTIONS.md` → Git, `docs/DECISIONS.md` (D-013 and a new entry)
- `.agents/skills/` (`build`, `merge`, `parallel`, `status`), `.claude/settings.json`, `scripts/worktrees.sh`
- `.github/pull_request_template.md`, GitHub settings for `main` (applied with `gh api`, recorded here)

## Scope (must cover)
- **Branch protection on `main`:** PR required, W1's and W3's jobs required, linear history, no force pushes. Admin bypass stays possible for emergencies, recorded as such.
- **`/build`** in the main checkout creates a branch (`slice/<id>`) instead of committing to `main`; in a worktree it keeps `worktree-<name>`. It ends by pushing and opening a PR (`gh pr create`) whose body links the spec and lists each acceptance criterion with how it was verified.
- **`/merge`** works on PRs: rebase on `main`, add the shared-doc commit (`docs/ROADMAP.md` status, `docs/DECISIONS.md` entries, spec cleanup) on the branch, `git push --force-with-lease`, wait for checks (`gh pr checks --watch`), then `gh pr merge --rebase`. One at a time; stops on the first failure.
- **`/status`** also shows open PRs and their check state.
- **Session link:** the PR body records the runner (Claude Code local or cloud, `agy`) and session id(s) that built it, so W16 can grade the transcript behind each merged PR.
- **Preflight:** `/build` starts with `pnpm preflight`, as `/parallel` already does.
- **Settings:** allow `git push`, `git push --force-with-lease`, `gh pr *`; keep `git push --force` denied.
- **Merge method:** rebase merge, so every Conventional Commit lands on `main` as written.
- The docs-only exception (if any) for the owner working on `main` is decided and written down.

## Acceptance criteria
- [ ] A direct push to `main` is rejected; a PR with failing checks can't be merged (show both)
- [ ] `/build` of a small slice ends with an open PR with the verification list filled in
- [ ] `/merge` merges two PRs in a row, each with its shared-doc commit, and `main` passes CI after each
- [ ] `AGENTS.md` and `docs/CONVENTIONS.md` → Git describe only the new flow

## Out of scope
- Bot reviews (W11). Auto-merge (W14).

## Open questions
- Keep `docs/ROADMAP.md` hand-edited at merge time, or generate its status column from specs so PRs never conflict on it? Evidence for generating: the 2026-11-16 transcript pass found one session misled by a ⏸ that was no longer true, and one that couldn't start D2 because D1 was ✅ only on an unmerged branch.

## Decisions

## Shared change requests
