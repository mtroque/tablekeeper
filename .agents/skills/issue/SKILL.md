---
name: issue
description: Build a standalone GitHub issue (not a slice) end to end and open a PR
argument-hint: <issue number>
disable-model-invocation: true
---
Build the GitHub issue given with this command.

1. **Preflight:** run `pnpm preflight` (if `node_modules` is missing, run `pnpm install` first). Don't check `.env.local` yourself; reading it is denied.
2. **Branch:** keep the current `factory/<n>-<slug>` branch if already on one; otherwise create `fix/<n>` or `chore/<n>` from `main`. Never commit to `main`.
3. **Read the issue:** `gh issue view <n> --json title,body,labels` and implement every acceptance criterion using small Conventional Commits (`AGENTS.md` → Hard rules, `docs/CONVENTIONS.md`). A criterion you can't verify (it needs owner setup or a live run) goes in the PR as unchecked with the reason, and the issue stays open with `needs-human`; never report it as done.
4. **Verify:** run `pnpm typecheck && pnpm lint && pnpm lint:commits && pnpm check:repo && pnpm test` (and `pnpm test:e2e` if UI or API routes changed).
5. **Push and open a PR:** push the branch (`git push -u origin HEAD`) and open a PR against `main` (`gh pr create`) following `.github/pull_request_template.md`, including `Closes #<n>` and the verification output.

End with one summary: PR URL, what changed, how it was verified.
