# W9: CV accuracy gate

**Status:** ⬜ · **Depends on:** W1

**Goal:** A PR can't quietly make board reading worse: CI runs `pnpm eval:cv` for every photo game and fails if accuracy drops below the last recorded numbers.

## Owns
- `scripts/eval-vision.ts` (a check mode), a recorded baseline file per game next to its fixtures, `.github/workflows/ci.yml` (a job, only when `packages/cv/` or fixtures change), `docs/DATA_ASSETS.md`, `docs/AUTOMATION.md` (W9 row)

## Scope (must cover)
- `pnpm eval:cv --check` compares each game's accuracy to its baseline, with a small tolerance, and exits non-zero on a drop.
- Raising a baseline is an explicit command and its own commit.
- Runs in Node in CI without network.

## Acceptance criteria
- [ ] Passes on `main`; a deliberately worse threshold in a detector fails it (show the run)

## Out of scope

## Open questions

## Decisions

## Shared change requests
