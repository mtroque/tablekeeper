# P3: Patchwork token detection

**Status:** ✅ · **Depends on:** P2

**Goal:** Count the praline chits laid out beside the box board, by value, and detect the special tile, so a photo draft carries the whole score and the player only checks it.

## Owns
The `patchwork` game folders (AGENTS.md → Parallel sessions): `packages/cv/src/games/patchwork/`, `apps/web/src/games/patchwork/`, `docs/games/patchwork.md`, `data/fixtures/patchwork/`, `apps/web/public/samples/patchwork/`, this spec, `tests/e2e/P3.spec.ts` and the Patchwork e2e tests it changes (`tests/e2e/P2.spec.ts`, whose drafts now include chits).

## Scope
Chits are read in `packages/cv/src/games/patchwork/` after the board is found, on the same loaded image. How it works goes in `docs/games/patchwork.md` → Photo reading; in short:

- **Regions** (`chit-regions.ts`): pixels far from the table's colors (the same border k-means as the board finder, color weighted double), outside the board quad grown 3%, with light shadows dropped, holes filled. Touching chits are split on the distance map: seeds where it reaches a share of the region's deepest point, going deeper while a part is too bulky (area over squared thickness) to be one chit. Each region's rotated rectangle gives an upright crop with its long side vertical.
- **Classes** (`chits.ts`, `PAT-SCORE-4`): gold regions are 1 chits, counted by area against the median lone 1 chit (so touching 1s that didn't split still count). Purple regions are compared with `matchTemplateRotInvariant` against upright crops of the reference chits (`token-5`, `token-10`, `token-20`, `special-tile`), with a shape bonus (10s are long, 20s nearly square, 5s in between); the special tile is the only candidate above 0.03 of the board's area, chits only below it.
- **Confidence** per count and for the special tile, on the `PATCHWORK_FIELD_KEYS` keys (D-046): a chit's margin over the runner-up lowers its count and the runner-up's; a region that can't be read (too small, too large, no template match) lowers every count to 0.3 and adds the warning "Some praline chits are touching or hidden. Check the counts, or spread them out and retake the photo."
- **Calibration:** `pnpm eval:cv patchwork --calibrate` also writes `chits.json` (gray 40×48 upright crops) from the reference crops; without them it keeps the committed file.
- **Eval:** `read` adds `tokens.one` to `tokens.twenty` and `specialTile` as pseudo-cells whose label is the count (or yes/no), so the eval counts 87 values per photo.
- **Board switch reread** (D-070): unchanged; the editor keeps the player's chits.

## UI states
None beyond P2's: the editor already outlines low-confidence counts and the special tile switch and counts them in the review banner; the capture screen shows detector warnings.

## Acceptance criteria
- [x] ≥ 95% of fixture photos get every count exactly right, and wrong counts are always flagged. **Target not reached (DoD 4):** 6 of 8 photos (75%) get every count right, at found and at labeled corners; all 5 wrong values are flagged (`pnpm eval:cv patchwork`: 691 of 696 values, 99.3%, errors flagged 5 of 5). Both misses are photos where chits overlap, against the photo guidelines: in 03 the special tile and all four purple chits touch in a chain, in 06 a 1 chit lies on a 10 chit. Each gives the warning and 0.3 on every count. A single 5 or 10 lying half on another is the case to improve next.
- [x] A photo draft carries the chit counts and special tile with a confidence for each (`tokens.one` to `tokens.twenty`, `specialTile`): `detector.test.ts` (87 confidence keys), `chits.test.ts`, and the e2e test.
- [x] Touching or overlapping chits that can't be read lower every count's confidence and show the warning: `chits.test.ts` ("flags every count and warns"), e2e on sample 2, eval on fixtures 03 and 06.
- [x] `pnpm eval:cv patchwork` scores the chit and special tile values with the spaces and passes (99.3% against 97%); `--calibrate` rebuilds `chits.json` (8 templates) and leaves `references.json` unchanged.
- [x] Trying a sample photo shows its chits, special tile and total on review (`tests/e2e/P3.spec.ts`, sample 3: 6 chits of 1, 2 of 10, the special tile).

## Tests
- Unit: region splitting and hole filling on synthetic masks; chit reading on a synthetic photo (drawn gold discs, template-textured purple chits and a special tile beside a board); calibration builds templates and keeps the committed file without references; no leaked Mats.
- Accuracy through `pnpm eval:cv patchwork`.

## Out of scope
- Verifying the 7×7 square for the special tile (`PAT-SCORE-3`).
- Chits stacked on each other or on the board.

## Open questions
None. The 20 chit reference crops are in `data/fixtures/patchwork/references/` (d90eb6d); no fixture photo shows a 20 chit, so 20s are recognized from the crops alone.

## Decisions
- Gold 1 chits are counted by area against the median lone 1 chit, so touching 1s that don't split still count right; only the purple chits need separating.
- Shape helps the templates: on the fixtures 10 chits are clearly longer than 5s (1.45 to 1.7 against 1.15 to 1.3), and templates alone mistook both 10s in 08 for 5s.
- Chit counts are eval pseudo-cells labeled with the count (87 values per photo), so chit errors show in the same report and confusion matrix as the spaces.
- `find-box-board.ts` now exports its table-color, noise, LAB and morphology helpers for `chit-regions.ts`; no behavior changed.
- A third sample photo (fixture 01, `red-board-special-tile.jpg`) shows a clean chit read; the first two both have touching chits. P2's e2e totals now include the chits (sample 1 is its labeled -11).
- Node's JPEG decoder and the browser's differ enough on sample 1 that its three touching 5 chits split in the browser (all read) but not in Node (flagged). The e2e tests pin the browser's reading, which matches the labels.
- No shared files or wiring were edited.

## Shared change requests
None.
