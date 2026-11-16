# W9: CV accuracy gate

**Status:** ⬜ · **Depends on:** W1

**Goal:** A PR can't quietly make board reading worse. CI runs the CV eval for every game with a detector and fails when a game's numbers drop below what's recorded on `main`, even when they're still under the target threshold (some games are, by design: `AGENTS.md` → Definition of done, item 4).

## Owns
- `scripts/eval-vision.ts` (a `--check` mode and `--record`), `scripts/lib/cv-baseline.ts` with tests
- `data/fixtures/<gameId>/baseline.json` for each game with a detector (today `_example`, `harmonies`, `patchwork`)
- `.github/workflows/ci.yml` (a `CV` job), `package.json` (an `eval:cv:check` script), `README.md` (Commands), `docs/DATA_ASSETS.md` (baseline format), `docs/AUTOMATION.md` (W9 row)

## Scope
- **Two numbers, two jobs.** `accuracyThreshold` in `labels.json` stays the target and keeps deciding `pnpm eval:cv`'s exit code as today. The new `baseline.json` records what `main` actually achieves, and the gate compares against that.
- **Baseline:** `{ cellAccuracy, boardFoundRate, flaggedErrorRate, meanCornerError, recordedAt, commit }`, written by `pnpm eval:cv <gameId> --record`. Raising or lowering a baseline is that command plus its own commit (`test(cv): record <gameId> baseline`), so a drop can never hide inside a feature commit.
- **Check:** `pnpm eval:cv:check` runs every game that has both a detector and a baseline, and fails if cell accuracy or board-found rate falls more than 0.5 percentage points below the baseline, or mean corner error rises more than 10%. The tolerance absorbs harmless floating-point noise; a single misread cell in a small fixture set is bigger than that and fails. It prints a table per game: baseline, now, change.
- **A game with a detector but no baseline** fails the check with a message naming `--record`, so a new detector can't skip the gate.
- **CI job `CV`:** on PRs that touch `packages/cv/`, `packages/core/src/games/`, `data/fixtures/` or `scripts/eval-vision.ts` (`paths` filter), and on every push to `main`. Node only, no network; opencv.js loads from `node_modules`. Required on `main` like the others, through a job that always runs and passes when no relevant path changed, so required-check rules don't block unrelated PRs.

## Acceptance criteria
- [ ] Baselines recorded for `_example`, `harmonies` and `patchwork`; `pnpm eval:cv:check` passes on `main`
- [ ] A deliberately worse threshold in a detector fails the `CV` job (link the run)
- [ ] A PR that touches only docs skips the eval but still reports `CV` as passing

## Tests
- `cv-baseline.test.ts`: tolerance at, above and below the line for each metric; missing baseline; extra game without a detector ignored.

## Out of scope
- Raising targets or improving detectors. Azul detection (A2) gets a baseline when its detector exists.

## Open questions

## Decisions
- Gate on the recorded baseline, not the target: P3 and others finished below target with the gap recorded, so gating on the target would fail `main` today.

## Corrections

## Shared change requests
