---
name: build
description: Build one or more slices end to end on a branch and open a PR, unattended
argument-hint: <slice id> [more ids, built in order]
disable-model-invocation: true
---
Build the slice ids given with this command, in the order given.

1. **Preflight:** run `pnpm preflight` (if `node_modules` is missing, run `pnpm install` first). Don't check `.env.local` yourself; reading it is denied.
2. **Branch:** in a worktree, keep `worktree-<name>`; in a factory run (`factory/*`), keep that branch. In the main checkout, if on `main`, create and switch to `slice/<first-id>` (`git switch -c slice/<first-id>`). Never commit to `main`.
3. **Build each id in order:** skip it if its spec is already ✅; otherwise check dependencies (`docs/slices/<dep>-*.md` on this branch first, then `docs/ROADMAP.md`) and follow `AGENTS.md` → Workflow through the Definition of done, including its finish commit, which rebases on `origin/main`, updates `docs/ROADMAP.md`, `docs/DECISIONS.md` and `docs/CORRECTIONS.md` and removes the spec (`AGENTS.md` → Parallel sessions → Shared docs). Work without asking, stopping only for the reasons in `AGENTS.md` → Workflow.
4. **Push and open a PR:** run `pnpm fix` and `pnpm verify --full`, then push the branch (`git push -u origin HEAD`) and open a PR against `main` (`gh pr create`) following `.github/pull_request_template.md`:
   - `## Slice`: link each slice spec as it stood before the finish commit removed it (a permalink to `docs/slices/<id>-<slug>.md` at that commit), and include `Closes #<n>` when `FACTORY_ISSUE_NUMBER` is set.
   - `## Verification`: the check suite result and each acceptance criterion from the spec with how it was verified. A criterion you couldn't verify is moved to a follow-up spec or keeps the slice ⏸ (`AGENTS.md` → Definition of done, item 2); never fold it away.
   - `## Session`: `Runner` (`claude-local`, `claude-cloud`, `claude-actions`, or `agy`) and `Session` (for `agy`, the `Conversation ID` in your prompt; for `claude-local`, the newest `<uuid>.jsonl` in `~/.claude/projects/` for this working directory; for `claude-actions`, the session id from the stream-json output or newest `.jsonl` under `~/.claude/projects/-home-runner-work-tablekeeper-tablekeeper/`).

To wait for CI, use `gh pr checks <n> --watch --interval 30 > /dev/null; gh pr checks <n>`.

End with one summary: PR URL, slices finished, slices blocked and why, anything I need to do.
