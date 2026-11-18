# W27: Factory first-run fixes

**Status:** ✅ · **Depends on:** W24

**Goal:** The factory's first live runs (2026-11-18: PR #24 W26, PR #28 W10, their review loops) failed in ways nobody saw at the time. This slice fixes the ones that can be built and checked locally, so the next runs leave a transcript, keep paused slices in the queue, and post reviews whose verdict matches the gate. Found by decrypting the three builder transcripts and reading every factory and review run log. The audit was first written into W24 (66c88a8) and dropped from it by 7f88a3c; this spec restores it.

## Owns
- `scripts/factory/run.ts`, `scripts/factory/project.ts`, `scripts/factory/finish.ts` and `scripts/factory/stream.ts` (new) and their tests in `scripts/factory/factory.test.ts`
- `scripts/review/run.ts`, `scripts/review/findings.ts` and `scripts/review/review.test.ts` (verdict gate only)
- `.github/workflows/review.yml` (concurrency only), `.github/factory/config.json` (`builder.maxTurns`)
- `scripts/preflight.mjs`
- `.claude/skills/build/SKILL.md`, `.agents/skills/build/SKILL.md`, `.github/pull_request_template.md` (`Refs`, `## Also found`)

W24 owns the same factory files for its live checks; it is ⏸ with no build work left, so the two don't run at the same time.

## Scope
- **Builder output never buffered:** `run.ts` passes file descriptors to `claude -p --output-format stream-json` instead of buffering its output (crashed twice: `stdout` undefined in run 44275657268, `ENOBUFS` in run 44328772893; PR #26's 64MB limit only moved the cliff). The session id is read from the stream file, and the session is encrypted for upload even when the run errors or times out. A crash comments on the issue with the run link.
- **Paused slices don't close their issue:** the build skill writes `Closes #n` only when the spec was folded; a ⏸ slice writes `Refs #n`. After the build, `run.ts` checks: if the slice's spec is still on the branch, it rewrites `Closes #n` to `Refs #n` in the PR body and labels the issue `needs-human` with the spec's status line. Merging PR #24 closed #19 as completed with four criteria open, and PR #28 (W10) had the same body.
- **Verdict follows the gate:** with a finding at or above `blockingSeverity`, the posted verdict is `fix`, whatever the model said (PR #24's last review said `merge` at 0.70 with a should-fix finding). When `maxRounds` adds `needs-human`, a PR comment says why.
- **A fix round doesn't cancel itself:** `review.yml` uses `cancel-in-progress: false`. The round's own push started a new `Review` run that cancelled the running one (runs 44325881925 and 44326540795: no logs, no session). Runs now queue; the same-head-commit guard already stops duplicate reviews.
- **Project read:** `project.ts` reads with `FACTORY_PROJECT_TOKEN` first when it's set. Every run opened with the App token's "Could not resolve to a ProjectV2" error, which looks like a real failure.
- **Preflight on runners:** `pnpm preflight` reports a missing `.env.local` as `info`, not a failure, when `CI` is set. All three factory transcripts start with a failed preflight the agent has to dismiss.
- **Findings outside the slice get filed:** the build skill opens an issue (labeled `bug`, not `agent-ready`) for each problem found outside the slice and links it in the PR. W10 found that saving offline never shows "You're offline.", and it was only recorded in W10's spec.
- **Turn budget:** builder `maxTurns` goes from 80 to 150. The W10 builder wrote "Turn budget is limited, so I'm moving fast" after about 35 turns of reading, then batched edits into long shell chains.

## Acceptance criteria
- [x] Builder output goes to files, not a buffer: a test runs a child that writes more than 64MB and the stream file holds it all, with the session id parsed from it; a child that exits non-zero still yields the id (`spawnToFiles` test: 70MB, exit 3, id `sess-123`, stderr tail)
- [x] `Closes`/`Refs`: a body with `Closes #n` and the spec still on the branch becomes `Refs #n` with the status line as the reason; a folded spec keeps `Closes` (tests); the build skill says so (5 `pausedSliceFollowUp` tests; build skill step 4 and the PR template)
- [x] A review whose model verdict is `merge` but has a should-fix finding is posted as `fix` (test), and the `maxRounds` label comes with a comment (code path shown) (3 `applyVerdictGate` tests; `scripts/review/run.ts` posts the comment before adding the label)
- [x] `review.yml` has `cancel-in-progress: false`
- [x] With `FACTORY_PROJECT_TOKEN` set, the Project is read with it first and the App token isn't tried (test); without it, the App token is used as before (3 `readFactoryProjectOrder` tests, plus the existing neither-works test)
- [x] `CI=true pnpm preflight` without `.env.local` exits 0 and says `info`; without `CI` it still fails (run in the W27 worktree, which has no `.env.local`: exit 0 with the `info` line, exit 1 without `CI`)
- [x] The build skill tells agents to file outside findings as issues, and the offline-save bug from W10 is filed (skill step 4 `## Also found`; the bug is #30, now labeled `bug`)
- [x] `builder.maxTurns` is 150
- [ ] The live parts (a crash leaves a transcript and an issue comment; a ⏸ factory PR says `Refs #n`; a fix round isn't cancelled) are checked on the next factory runs (moved to W28)

## Tests
- `factory.test.ts`: stream capture to file over 64MB; session id from a failed child; `Closes`/`Refs` rewrite; Project token order.
- `review.test.ts`: verdict gate.

## Out of scope
- Kept reviewer transcripts, per-round session uploads, the first review waiting for the session, earlier rounds in the review prompt, actionlint, Node 24 actions, and the two permission questions: W28.

## Open questions

## Decisions

## Corrections
| Date | Pattern | Where | What was wrong | Correction | Source | Status |
|---|---|---|---|---|---|---|
| 2026-11-18 | `closes-paused-slice` | PR #24 (W26), PR #28 (W10) | A ⏸ slice's PR said `Closes #n`, as the build skill required; merging #24 closed #19 as completed with four criteria open | `Refs #n` for ⏸ slices, checked by `run.ts` (W27); #19 reopened with `needs-human` | trace | promoted: `scripts/factory/finish.ts` (W27) |
| 2026-11-18 | `factory-cannot-push-workflows` | PR #24 (W26), PR #28 (W10) | Push refused without the `workflows` permission; workflows staged as drafts, and a review fix posted as a patch for the owner | Owner decision (W28 Open questions) | trace | open: second occurrence |
| 2026-11-18 | `output-buffer-crash` | factory runs 44275657268, 44328772893 | `spawnSync` buffered the agent's stream: `stdout` undefined, then `ENOBUFS`; no transcript, no output in the log | Output to files (W27) | trace | promoted: file descriptors in `scripts/factory/run.ts` (W27) |
| 2026-11-18 | `self-cancelled-fix-round` | PR #24, review runs 44325881925, 44326540795 | The fix round's push started a new review that cancelled the running one; the resumed session was never uploaded | `cancel-in-progress: false` (W27), upload per round (W28) | trace | open |
| 2026-11-18 | `verdict-contradicts-gate` | PR #24 | Verdict `merge` with a should-fix finding; the gate labeled `needs-human` with no explanation | Verdict follows the gate, label comes with a comment (W27) | trace | promoted: verdict gate in `scripts/review/findings.ts` (W27) |
| 2026-11-18 | `review-repeats-finding` | PR #24 | The deploy-wait race raised in three rounds; twice asked about criteria `check:repo` enforces | Earlier rounds and enforced checks in the review prompt (W28) | trace | open |
| 2026-11-18 | `preflight-fails-in-ci` | factory sessions `f7723ab4`, `c738266c`, `f3ed8221` | `pnpm preflight` exits 1 on the runner for a missing `.env.local`; every build starts with a failure to dismiss | `info` when `CI` is set (W27) | trace | promoted: `scripts/preflight.mjs` (W27) |
| 2026-11-18 | `out-of-slice-finding-unfiled` | PR #28 (W10) | Offline save never shows "You're offline."; recorded only in W10's spec Decisions | Build skill files an issue (W27) | trace | promoted: build skill (prose: whether a finding is outside the slice can't be checked) |
| 2026-11-18 | `secret-without-local-copy` | owner setup | `FACTORY_SESSION_KEY` set from `$(openssl rand ...)` with no copy kept; recovering it needed a one-off workflow (PR #27) | Keep a local copy; rotation steps in `docs/AUTOMATION.md` → Accounts and setup (PR #29) | trace | promoted: `docs/AUTOMATION.md` row (prose: where an owner keeps a secret can't be checked) |
| 2026-11-18 | `stale-observation-reported` | trace audit of the factory | Reported issue #16 as stuck in `in-progress` from a snapshot taken while a factory run had just picked it | Check whether a run is in progress before calling state stuck; corrected in the report | self | open |
| 2026-11-18 | `shared-checkout-collision` | main checkout, W24 audit | Switched branches in the main checkout while an `agy` session was editing there; its uncommitted fold moved with each switch and it committed onto and reset my branch | Work in a worktree when another session may use the checkout (AGENTS.md → Parallel sessions already says so) | self | open |
| 2026-11-19 | `content-dropped-in-edit` | W24 spec, commit 7f88a3c (`agy`) | A commit titled "skip review fix round on owner PRs and log W24" deleted the W24 audit (15 fixes, 4 criteria, 2 open questions, 10 correction rows) without saying so | Restored as W27 and W28 | trace | open |

## Shared change requests
