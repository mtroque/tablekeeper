# W4: PR workflow

**Status:** ✅ · **Depends on:** W1, W3

**Goal:** All work reaches `main` through a pull request with green CI, instead of local fast-forward merges and direct pushes. Agents build on branches, open PRs that show how they verified their work, and `/merge` merges them one at a time. See `docs/AUTOMATION.md` → Target flow.

## Owns
- `AGENTS.md` (Workflow, Definition of done, Parallel sessions), `docs/CONVENTIONS.md` → Git, `docs/DECISIONS.md` (D-013 and D-083), `docs/ROADMAP.md` (W4 status), `docs/AUTOMATION.md` → Enforcement map (W4 row)
- `.agents/skills/` (`.agents/skills/build/SKILL.md`, `.agents/skills/merge/SKILL.md`, `.agents/skills/parallel/SKILL.md`, `.agents/skills/status/SKILL.md`), `.claude/settings.json`, `scripts/worktrees.sh`
- `.github/pull_request_template.md`, GitHub settings for `main` (applied with `gh api`, recorded here)

## Scope
- **Repository merge settings** (`gh api -X PATCH repos/mtroque/tablekeeper`): rebase merge only (`allow_rebase_merge: true`, `allow_merge_commit: false`, `allow_squash_merge: false`) so every Conventional Commit lands on `main` as written, and `delete_branch_on_merge: true`.
- **Branch protection on `main`** (`gh api -X PUT repos/mtroque/tablekeeper/branches/main/protection`):
  - Require pull requests (`required_pull_request_reviews: { required_approving_review_count: 0 }`).
  - Require status checks (`required_status_checks: { strict: true, contexts: ["Checks"] }`), covering W1's and W3's steps in `.github/workflows/ci.yml`.
  - Require linear history (`required_linear_history: true`), forbid force pushes (`allow_force_pushes: false`) and deletions (`allow_deletions: false`).
  - `enforce_admins: true` so local sessions (which share the owner's GitHub credentials) cannot push directly to `main` or merge a PR with failing checks. Emergency admin bypass remains available to the owner via `gh api -X DELETE repos/mtroque/tablekeeper/branches/main/protection/enforce_admins` (and `-X POST` to restore).
  - **No docs-only exception on `main`:** all changes, including docs-only edits, go through a branch and PR.
- **PR template and session link** (`.github/pull_request_template.md`):
  - `## Slice` linking `docs/slices/<id>-<slug>.md`.
  - `## Verification` listing the check suite and each acceptance criterion from the spec with how it was verified.
  - `## Session` recording `Runner` (`claude-local`, `claude-cloud`, or `agy`) and `Session` (conversation/session UUID(s)) so W16 can link merged PRs to their transcripts.
- **`/build`** (`.agents/skills/build/SKILL.md`):
  - Starts with `pnpm preflight`.
  - In the main checkout, creates `slice/<id>` from `main` (`git switch -c slice/<id>`) instead of committing to `main`; in a worktree, keeps `worktree-<name>`.
  - Leaves `docs/ROADMAP.md`, `docs/DECISIONS.md` and `docs/CORRECTIONS.md` untouched on the branch.
  - Ends by pushing the branch (`git push -u origin HEAD`) and opening a PR (`gh pr create`) formatted per `.github/pull_request_template.md`.
- **`/merge`** (`.agents/skills/merge/SKILL.md`):
  - Works on open PRs (`gh pr list`), oldest ready first, one at a time, stopping on the first failure.
  - Checks out the PR branch, rebases on `main`, runs the full verification check, adds the shared-doc commit `docs: merge <branch>` on the branch (`docs/ROADMAP.md` status, `docs/DECISIONS.md` entries, `docs/CORRECTIONS.md` rows, and moving lasting facts to home docs + deleting finished `✅` specs), pushes with `git push --force-with-lease`, waits for CI (`gh pr checks --watch`), and merges with `gh pr merge --rebase`.
  - Runs `scripts/worktrees.sh sync` and `scripts/worktrees.sh clean`.
- **`/status` and `scripts/worktrees.sh`**:
  - `scripts/worktrees.sh status` also lists open PRs and their check state (`PASS`, `FAIL`, `PENDING`, `DRAFT`), and `scripts/worktrees.sh clean` detects branches merged via GitHub rebase-merge (`git cherry main <branch>`).
  - `.agents/skills/status/SKILL.md` reports open PRs and their check states alongside worktrees.
- **Settings** (`.claude/settings.json`): allow `git push`, `git push --force-with-lease`, `git switch`, `git fetch`, `git pull`, `gh pr *`, `pnpm check:repo`, `pnpm lint:commits`, and `scripts/worktrees.sh`; keep `git push --force` and `git push -f` denied.

## UI states
None.

## Acceptance criteria
- [x] A direct push to `main` is rejected; a PR with failing checks can't be merged (show both):
  - Direct push (`git push origin HEAD:refs/heads/main`): rejected with `remote: error: GH006: Protected branch update failed for refs/heads/main. - Changes must be made through a pull request. - Required status check "Checks" is expected. ! [remote rejected] HEAD -> main (protected branch hook declined)`.
  - Failing PR ([PR #3](https://github.com/mtroque/tablekeeper/pull/3), `test/w4-failing-pr`, failed `Commits` in [run 43868221953](https://github.com/mtroque/tablekeeper/actions/runs/43868221953)): `gh pr merge 3 --rebase` failed with `X Pull request mtroque/tablekeeper#3 is not mergeable: the base branch policy prohibits the merge`, and `gh pr merge 3 --rebase --admin` failed with `GraphQL: Required status check "Checks" is failing. (mergePullRequest)` (PR #3 closed and branch deleted).
- [x] `/build` of a small slice ends with an open PR with the verification list filled in: verified on [PR #4](https://github.com/mtroque/tablekeeper/pull/4) (`slice/W4`) and [PR #5](https://github.com/mtroque/tablekeeper/pull/5) (`slice/W4-finish`), both opened with `.github/pull_request_template.md` (`## Slice`, `## Verification` checklist, and `## Session` with `Runner: agy` and `Session: 34668bad-1d7e-4c5b-ac16-5945464b9bfd`).
- [x] `/merge` merges two PRs in a row, each with its shared-doc commit, and `main` passes CI after each: verified by merging [PR #4](https://github.com/mtroque/tablekeeper/pull/4) (`docs: merge slice/W4` updating `D-013` in `docs/DECISIONS.md`; `main` passed in [run 43869751331](https://github.com/mtroque/tablekeeper/actions/runs/43869751331)) and [PR #5](https://github.com/mtroque/tablekeeper/pull/5) (`docs: merge slice/W4-finish` updating `docs/ROADMAP.md` and `D-083` in `docs/DECISIONS.md`) sequentially with `git rebase main`, `git push --force-with-lease`, `gh pr checks --watch`, and `gh pr merge --rebase`.
- [x] `AGENTS.md` and `docs/CONVENTIONS.md` → Git describe only the new flow: updated `AGENTS.md` (Workflow, Definition of done, Parallel sessions) and `docs/CONVENTIONS.md` → Git so all work branches to `slice/<id>` or `worktree-<name>`, opens a PR, and merges through `/merge`.

## Tests
Live verification against GitHub branch protection and Actions: rejected direct push to `main`, rejected merge of a failing PR (#3), PR creation with verification list and session metadata (#4 and #5), and two sequential PR merges through `/merge` with green `Checks` on `main`.

## Out of scope
- Bot reviews (W11). Auto-merge (W14).

## Open questions
Resolved:
- **Keep `docs/ROADMAP.md` hand-edited in `/merge`'s shared-doc commit rather than generated from specs:** finished specs are deleted on merge (`AGENTS.md` → Docs), so `docs/ROADMAP.md` is the lasting record on `main`. Because `/build` never edits `docs/ROADMAP.md` on a branch and `/merge` adds `docs: merge <branch>` to one rebased PR at a time right before merging, open PRs never conflict on it. To prevent the two 2026-11-16 transcript-pass issues: `docs/ROADMAP.md` on `main` only ever holds `⬜` or `✅` (live `🟨`/`⏸` stay in `docs/slices/<id>-*.md`), and dependency checks read `docs/slices/<dep>-*.md` on the current branch before `docs/ROADMAP.md`.

## Decisions
- **D-013 (updated):** Single-slice work runs on `slice/<id>` and parallel work uses Claude Code's built-in worktrees (`worktree-<name>`), automatic ports and the shared Agent Skills commands; every slice opens a PR and `/merge` rebase-merges it.
- **D-083:** `main` is protected (PR required, `Checks` required, linear history, rebase-only merge, no force pushes, `enforce_admins: true`, no docs-only exception); `/build` opens a PR on `slice/<id>` or `worktree-<name>` with verification and session metadata (`.github/pull_request_template.md`), and `/merge` rebases, adds `docs: merge <branch>` (updating `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CORRECTIONS.md` and cleaning up finished specs), waits for CI, and rebase-merges one PR at a time.

## Corrections
None.

## Shared change requests
None.
