---
name: build
description: Build one or more slices end to end on a branch and open a PR, unattended
argument-hint: <slice id> [more ids, built in order]
disable-model-invocation: true
---
Build the slice ids given with this command, in the order given.

1. **Preflight:** run `pnpm preflight` (if `node_modules` is missing, run `pnpm install` first). Don't check `.env.local` yourself; reading it is denied.
2. **Branch:** in a worktree, keep `worktree-<name>`. In the main checkout, if on `main`, create and switch to `slice/<first-id>` (`git switch -c slice/<first-id>`). Never commit to `main`.
3. **Build each id in order:** skip it if its spec is already ✅; otherwise check dependencies (`docs/slices/<dep>-*.md` on this branch first, then `docs/ROADMAP.md`) and follow `AGENTS.md` → Workflow through the Definition of done. Leave `docs/ROADMAP.md`, `docs/DECISIONS.md` and `docs/CORRECTIONS.md` untouched (`/merge` updates them). Work without asking, stopping only for the reasons in `AGENTS.md` → Workflow.
4. **Push and open a PR:** push the branch (`git push -u origin HEAD`) and open a PR against `main` (`gh pr create`) following `.github/pull_request_template.md`:
   - `## Slice`: link each slice spec (`docs/slices/<id>-<slug>.md`).
   - `## Verification`: the check suite result and each acceptance criterion from the spec with how it was verified.
   - `## Session`: `Runner` (`claude-local`, `claude-cloud`, or `agy`) and `Session` (for `agy`, the `Conversation ID` in your prompt; for `claude-local`, the newest `<uuid>.jsonl` in `~/.claude/projects/` for this working directory).

End with one summary: PR URL, slices finished, slices blocked and why, anything I need to do.
