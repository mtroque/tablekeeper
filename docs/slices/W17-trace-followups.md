# W17: Trace follow-ups

**Status:** ✅ · **Depends on:** none

**Goal:** Fix what a second transcript pass (Antigravity CLI sessions, 2026-11-16) found: a false claim in W14, where W16 should read Antigravity transcripts, and a shared `.scratch/` folder that one session deleted with another session's files in it.

## Owns
- `docs/slices/W14-nightly-factory.md` (the Transcripts line)
- `docs/slices/W15-local-screenshots.md` (the screenshot folder)
- `docs/slices/W16-session-grading.md` (Scope → Collect, Privacy)
- `AGENTS.md` (Parallel sessions → Commands in a worktree)
- `docs/AUTOMATION.md` (the scratch-files row of the enforcement map)
- `scripts/lib/check-repo/forbidden-files.ts` (the scratch-file hint only)
- `scripts/lib/check-repo/check-repo.test.ts` (the matching assertion)

## Scope
- **W14:** W1 to W3 were built in Antigravity session `607926b6`, and its transcript exists. Drop the claim that they couldn't be found; keep the point that unwatched runs must save transcripts.
- **W16 Collect:** add the Antigravity CLI transcript path and the step format W16 parses.
- **Scratch:** each session uses its own `.scratch/<session or slice>/` and deletes only its own files. Applies to AGENTS.md, W15's `pnpm shot` output, W16's trace storage, the enforcement map and the `check:repo` hint. The check's matching rule (anything outside `.scratch/` in the named paths) stays as is.

## Acceptance criteria
- [x] W14 no longer says W1 to W3 transcripts weren't found (`git grep "weren't found" -- docs` matches only this spec)
- [x] W16 → Collect names `~/.gemini/antigravity-cli/brain/<conversation-id>/.system_generated/logs/transcript_full.jsonl` and the step fields
- [x] No doc tells a session to write to or clear `.scratch/` itself rather than its own subfolder (`git grep -n "scratch"`: the remaining bare `.scratch/` mentions are history rows in `docs/CORRECTIONS.md` and the check's match rule)
- [x] `pnpm typecheck && pnpm lint && pnpm lint:commits && pnpm check:repo && pnpm test:unit` pass (`pnpm test` and `pnpm test:e2e` skipped: they need the database, and nothing here touches app code)

## Out of scope
- Building W16's collector.
- A harness deny rule for `rm -rf .scratch` (first occurrence; see Decisions).

## Open questions

## Decisions
- The `scratch-dir-deleted` fix is prose for now: it's the first occurrence, and lost scratch files are throwaway work, not user data. If it repeats, the check is a deny rule for `Bash(rm -rf .scratch*)` in `.claude/settings.json` (and the Antigravity equivalent), which `/harden` can add.
- `check:repo` still matches any path under `.scratch/`; only its hint changed to name the per-session subfolder, with its test updated to match.
- W15's `pnpm shot` defaults its subfolder to the branch name, so sessions in different worktrees or branches never share one.

## Corrections

| Date | Pattern | Where | What was wrong | Correction | Source | Status |
|---|---|---|---|---|---|---|
| 2026-11-16 | `scratch-dir-deleted` | main checkout, X3 session `3616668e` | Ran `pnpm exec tsx .scratch/smoke-save.mts && rm -rf .scratch`, deleting the whole shared folder, including another session's files | AGENTS.md → Parallel sessions: each session uses its own `.scratch/<session or slice>/` and deletes only its own files; W15 and W16 write there too (W17) | trace | open: candidate deny rule for `rm -rf .scratch` if it repeats |

## Shared change requests
