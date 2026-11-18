# W20: Trace pass 2

**Status:** ✅ · **Depends on:** none

**Goal:** Turn a full read of every Antigravity session (2026-11-15 to 2026-11-18, 9 sessions, about 1,300 tool calls) into specs. The point is to fix what slowed agents down or slipped through unnoticed, in the environment, the tooling and the process, not only what the owner corrected.

## Owns
- New specs: `docs/slices/W21-dependency-security.md`, `docs/slices/W22-agent-commands.md`, `docs/slices/W23-antigravity-environment.md`, `docs/slices/W24-factory-go-live.md`, `docs/slices/W25-finish-gate.md`, `docs/slices/W26-production-safety.md`
- Shared docs: `docs/ROADMAP.md` (new rows, Next), `docs/CORRECTIONS.md` (`trace` rows), `docs/DECISIONS.md`

## Scope
What the pass found, with counts from the transcripts (`~/.gemini/antigravity-cli/brain/*/…/transcript_full.jsonl`, condensed with a throwaway script; no transcript text is committed):

| Finding | Evidence | Spec |
|---|---|---|
| Truncated tool output hid the failing line, so the agent reran the whole chain | 69 steps in 6 of 9 sessions; mostly `pnpm format` (`prettier --write .` lists every file), `gh pr checks --watch` spinners and push progress | W22 |
| Import order failed lint after formatting | 8 steps in 4 sessions; `pnpm format` runs Prettier but not `eslint --fix` | W22 |
| A killed e2e run left `next dev` running, and the next run failed on Next's one-server-per-app lock; chained `pnpm shot` calls hit refused connections | 1 session each, about 8 calls | W22 |
| `pnpm: command not found` in Antigravity | 2 sessions, about 10 calls of workarounds (unpacking pnpm from the npm cache into `/tmp`, then `./node_modules/.bin`). Cause: pnpm lives in `~/.local/bin`, which the Antigravity sandbox replaces with its own read-only `~/.local` | W23 |
| `.git` and the Docker socket are read-only or unreachable in the sandbox, so every git write and `db:start` fails once and is retried outside it | 3 sessions | W23 |
| Antigravity has no deny rules; its allow list grew one-off approvals, including a blanket `command(gh)` and commands with `--no-verify` | `~/.gemini/antigravity-cli/settings.json` | W23 |
| `gh pr edit` fails on the Projects (classic) deprecation; a stale second `gh` account; no `project` scope | `gh` 2.65.0 (2025-01) | W23 |
| `next dev` stopped e2e runs to report a known vulnerability; the agent retried and never told the owner | 2 sessions | W21 |
| Advisories in production dependencies: `better-auth` 1.7.6 (critical, high) and `zod` 4.5.4 (high) through `@neondatabase/auth`; `next` 16.4.3 (2 moderate) | `pnpm audit --prod` on 2026-11-18 | W21 |
| W11, W12 and W14 finished with live criteria unchecked, and their specs were deleted, so nothing tracks them | PR #13 verification list | W24, W25 |
| X4 merged with production sign-in unverified; production saves and history then failed (wrong JWT issuer), and the tests shared the code's wrong assumption | X3/X4 session, PR #8 | W26 |
| Production migrations ran from throwaway `.scratch/` scripts holding production credentials | X3/X4 session (`migrate-neon.mts`, `x4/setup-prod.mts`) | W26 |
| The factory reads the Project with the GitHub App token, but Apps generally can't read Projects owned by a personal account | `scripts/factory/project.ts`; no factory run yet | W24 |

## Acceptance criteria
- [x] Each finding above has a spec that owns its fix, with dependencies that form no cycle
- [x] Each finding has a `trace` row in `docs/CORRECTIONS.md` (or a `user` row for the owner's correction), reusing existing tags
- [x] `docs/ROADMAP.md` lists W20 to W26 and orders them in Next

## Out of scope
- Building any of the fixes. Claude Code transcripts (this pass covers Antigravity; the 2026-11-16 pass covered Claude Code).

## Open questions

## Decisions
- Security first in Next: W21 changes dependencies on the sign-in path, so it goes before anything else touches auth.

## Corrections
| Date | Pattern | Where | What was wrong | Correction | Source | Status |
|---|---|---|---|---|---|---|
| 2026-11-18 | `output-truncated` | 6 of 9 Antigravity sessions, 69 steps | Long tool output (formatter file lists, CI watch spinners, push progress) was truncated, hiding the failing line; the agent reran whole command chains | `pnpm verify` printing one line per step and the failing tail (W22) | trace | open |
| 2026-11-18 | `import-order-after-format` | 4 sessions, 8 steps | `pnpm format` doesn't fix import order, so lint failed after formatting | `pnpm fix` runs Prettier and `eslint --fix` (W22) | trace | open |
| 2026-11-18 | `stale-dev-server` | X3/X4 session; W15 build | A killed e2e run left `next dev` holding the app's dev lock; chained `pnpm shot` runs hit refused connections | Servers started by scripts are stopped on exit, and a stale one is detected (W22) | trace | open |
| 2026-11-18 | `agy-sandbox-env` | W1 and W7 sessions (pnpm), 3 sessions (`.git`, Docker) | pnpm hidden by the sandbox's `~/.local`; `.git` read-only and the Docker socket unreachable inside it | W23 | trace | open |
| 2026-11-18 | `permission-allowlist-drift` | `~/.gemini/antigravity-cli/settings.json` | Antigravity's allow list holds one-off approvals, a blanket `command(gh)` and `--no-verify` commands, and no deny rules | A checked-in Antigravity permission profile mirroring `.claude/settings.json` (W23) | trace | open |
| 2026-11-18 | `vulnerable-dependency-unreported` | W6 and W7 sessions | `next dev` reported a known vulnerability; the agent retried without telling the owner, and nothing in CI audits dependencies | `pnpm audit` in CI and the upgrades (W21) | trace | open |
| 2026-11-18 | `finished-with-unverified-criteria` | PR #13 (W11, W12, W14) | Specs folded and deleted with live acceptance criteria unchecked, so the gap stopped being tracked | Follow-up spec W24; a `check:repo` gate (W25) | trace | open: candidate check (W25) |
| 2026-11-16 | `finished-with-unverified-criteria` | PR #7 (X4) | Merged with production sign-in unverified; production saves then failed | W25 | trace | open: candidate check (W25) |
| 2026-11-16 | `test-mirrors-implementation` | X4, `tests/e2e/helpers.ts`, `apps/api/src/test/helpers.ts` | Test JWTs used the same wrong issuer as the code, so tests passed while production rejected every token | An issuer contract test from Neon Auth's documented token shape (W26) | trace | open |
| 2026-11-16 | `prod-change-adhoc-script` | X3/X4 session | Production migrations and env setup ran from throwaway `.scratch/` scripts with production credentials | A codified, reviewed migration path (W26) | trace | open |
| 2026-11-18 | `unverified-ui-instructions` | W14 setup guidance | Told the owner to link the repo under the Project's Manage access, which has no such option; the owner had to ask | Say when UI steps are from memory, or check the docs first | user | open |

## Shared change requests
