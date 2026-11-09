# H2: Harmonies photo detection

**Status:** 🟨 · **Depends on:** H1, S2

**Goal:** From a top-down photo, detect the board side and each space's top color, then ask only for the heights that can't be seen.

## Owns
The `harmonies` game folders (AGENTS.md → Parallel sessions):
- `packages/cv/src/games/harmonies/` (board finder, reading, draft, profile, tests)
- `apps/web/src/games/harmonies/` (detector loader, samples, height prompts, the photo branch of the side switch)
- `apps/web/public/samples/harmonies/`
- `docs/games/harmonies.md`, `data/fixtures/harmonies/` (eval report)
- `tests/e2e/H2.spec.ts`, this spec

## Scope

**cv** (`packages/cv/src/games/harmonies/`)
- **Board finding** (`board.ts`, `outline-fit.ts`): the bottom is curved, so `findBoardQuad` (a convex 4-gon) doesn't apply. Fit the board's whole outline, the same on both sides (straight top, sides straight to about half the height, one wide curve whose lowest point is the rectangle's bottom edge, measured from the dark-table fixtures), to the photo's Canny edges:
  - an edge field per signed gradient direction (16 bins, chamfer distance), so an outline point counts only edges that run its way with one consistent polarity (the board is all lighter, or all darker, than the table). Wood grain and the busy middle of the board then support only a fraction of the outline;
  - a coarse search over every center, width and angle (any quarter turn, up to 18 degrees off) at 800px, polishing the best 150 distinct poses, then a pattern search (shifts, scale, turn, depth, single corners) on the best 10, coarse to fine;
  - the best fit's score gives the confidence; below 0.6 of the outline on edges, the centered fallback and the "Couldn't find the board edges" warning.
  - The result is the board rectangle's corners (`docs/games/harmonies.md` → Board rectangle), TL, TR, BR, BL in the board's own orientation, whichever way the board is turned.
- **Side** (`read.ts`): flatten to the board rectangle and take the median CIELAB of the board's background (inside the outline, outside every space of either side). Compare its a and b with the same measure of both empty references (`references/side-a.jpg`, `side-b.jpg`), committed as constants and checked against the photos by a test; the nearer wins, confidence is the margin.
- **Top color per space**: hex centers from the chosen side's layout and grid placement (`docs/games/harmonies.md`), never detected. At each center, a disc of 0.65 hex sizes (a little smaller than the printed hex, so a leaning stack doesn't reach a neighbor, but wide enough to see the token around a cube). Animal cube pixels (CIELAB hue 50 to 100 degrees, chroma 8 to 45) are dropped; the rest give a median L, a, b, corrected by the difference between the photo's background and the side reference's (the room's light). `classifyNearest` against the calibrated profile (classes `W F M T L R empty`). "Occluded" only when under 10% of the disc is left after dropping the cube.
- **Draft**: each seen top becomes the shortest valid stack ending in it; confidence keys `"q,r"` (color match), `"q,r:height"` (0, for tops that need a height) and `"side"`.
- The CV worker loads it through the existing `GameUiModule.detector`; `pnpm eval:cv harmonies` reports a `side` pseudo-cell so side errors show in the confusion matrix.

**web** (`apps/web/src/games/harmonies/`)
- `detector` and `samples` in the UI module; 3 sample photos (both sides, three tables), downscaled to 1200px.
- **Height prompts** (from `HAR-STACK-*`, `docs/games/harmonies.md` → Valid stacks): a "Set Heights" section under the board lists every space with a height key whose stack still tops with `M`, `L`, `T` or `R`, with one button per allowed stack: `M` 1 / 2 / 3; `L` Leaves Only / 1 Trunk / 2 Trunks; `T` 1 / 2; `R` Alone / On Mountain / On Trunk / On Roof. The current choice is pressed. `W` and `F` never ask.
- **Side switch, board from a photo** (`docs/UX.md` → Board side switch): the sheet offers "Reread Photo as Side X" · "Clear Board" · "Cancel". Rereading reads the photo again at the same corners with the other side's layout, keeps the cards, and replaces the draft (so its confidence outlines follow).

## UI states
- Review of a photo draft: uncertain spaces outlined, banner counting values to check (colors and heights), "Set Heights" section.
- "Set Heights" with nothing left to ask: the section isn't shown.
- Side switch sheet on a board from a photo: three actions. Rereading shows "Reading the photo again." on the button while it runs; if the photo can't be read, "Couldn't read the photo again. Clear the board or cancel." and the other two actions stay.
- Capture on a Harmonies photo: the existing tip, progress, corner editing and fallback warning (S1, S2).

## Acceptance criteria
- [ ] `pnpm eval:cv harmonies`: the side is right on every fixture; ≥ 95% top-color accuracy.
- [ ] The board is found on every fixture, including both wooden tables, without given corners.
- [ ] Spaces with an animal cube are read for their top color, not marked occluded.
- [ ] Heights are asked only as `HAR-STACK-*` allows, and every draft is a valid state.
- [ ] "Reread Photo as Side X" rereads with the other layout at the same corners and keeps the cards.
- [ ] Try Sample Photo → corners → Read Board → review with the draft and height prompts → result (e2e).

## Tests
- cv unit: outline fit on a synthetic board photo (found, corners within 2%, turned a quarter); side detection and cube pixels; draft keys and stacks; label schema; reference constants recomputed from the reference photos; every fixture's side and board found (fast, given and detected corners).
- web: none beyond e2e (the editor logic is small).
- e2e: `tests/e2e/H2.spec.ts`.

## Out of scope
Reading stack heights from the photo (`docs/PRODUCT.md` → Out of scope; `docs/ROADMAP.md` → Later).

## Open questions
None open. Resolved:
- How often do animal cubes hide a top color completely? On the labeled fixtures, never: 0 of 52 spaces with a cube are `occluded`. So "occluded" is kept as a rule for a disc that is almost all cube, not a profile class.

## Decisions

## Shared change requests
