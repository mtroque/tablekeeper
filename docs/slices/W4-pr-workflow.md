# W4: PR workflow

**Status:** 🟨 · **Depends on:** W1, W3

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
- [ ] A direct push to `main` is rejected; a PR with failing checks can't be merged (show both)
- [ ] `/build` of a small slice ends with an open PR with the verification list filled in
- [ ] `/merge` merges two PRs in a row, each with its shared-doc commit, and `main` passes CI after each
- [ ] `AGENTS.md` and `docs/CONVENTIONS.md` → Git describe only the new flow

## Tests
Live verification against GitHub branch protection and Actions: rejected direct push to `main`, rejected merge of a failing PR, PR creation with verification list and session metadata, and two sequential PR merges through `/merge` with green `Checks` on `main`.

## Out of scope
- Bot reviews (W11). Auto-merge (W14).

## Open questions
Resolved:
- **Keep `docs/ROADMAP.md` hand-edited in `/merge`'s shared-doc commit rather than generated from specs:** finished specs are deleted on merge (`AGENTS.md` → Docs), so `docs/ROADMAP.md` is the lasting record on `main`. Because `/build` never edits `docs/ROADMAP.md` on a branch and `/merge` adds `docs: merge <branch>` to one rebased PR at a time right before merging, open PRs never conflict on it. To prevent the two 2026-11-16 transcript-pass issues: `docs/ROADMAP.md` on `main` only ever holds `⬜` or `✅` (live `🟨`/`⏸` stay in `docs/slices/<id>-*.md`), and dependency checks read `docs/slices/<dep>-*.md` on the current branch before `docs/ROADMAP.md`.

## Decisions

## Corrections

## Shared change requests
None.
