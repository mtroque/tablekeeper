# H3: Harmonies review on the board

**Status:** 🟨 · **Depends on:** H2

**Goal:** The player checks and fixes a photo's reading by tapping hexes on the board itself, not in a list of prompts under it. Spaces that need an answer stay highlighted until answered, and the app asks only for choices that change the score.

## Owns
The `harmonies` game folders (AGENTS.md → Parallel sessions), plus this spec, `tests/e2e/H3.spec.ts`, and the finished slices' `tests/e2e/H1.spec.ts` and `tests/e2e/H2.spec.ts` (they check the 15-option sheet and "Set Heights", both of which this slice replaces).

## Scope
- **Remove "Set Heights"** (`apps/web/src/games/harmonies/height-prompts.tsx`) and its section in the editor.
- **Tap any hex** opens the stack sheet. In a photo review, when the space has a top from the photo and that top has height choices, the sheet opens on those choices (the `CHOICES` from `height-prompts.tsx`, reduced to score-equivalent options below), with "Something Else" to show the full list. The choices follow the space's current top, so a space the player recolored shows its new color's choices. Water and field tops, empty spaces and manual entry open on the full list.

  | Top | Choices |
  |---|---|
  | gray `M` | 1 / 2 / 3 |
  | green `L` | Leaves Only / 1 Trunk / 2 Trunks |
  | brown `T` | Trunks |
  | red `R` | Lone Roof / Building |

- **Highlight until answered:** a space is highlighted (the dashed warning outline) while its `"q,r"` key is low-confidence or it has a `"q,r:height"` key whose confidence is low. The editor passes `HexGridEditor` a per-space confidence (the lower of the two keys), so no shared change is needed. Picking any stack for a space, even the one it already has, sets both its keys to 1 in the flow's `draft.confidence` (one `setFlow` with the new state), so its highlight and its count in the review banner go away.
  - `detection_meta` stays right: `corrected` compares `draft.state` with the saved state, and `draft.state` isn't touched; `detected` counts `draft.confidence`'s keys, and only values change. The `side` key is left alone. A reread replaces the draft, so answers start over then (the board was read again).
- **One option per score-equivalent stack**, in the sheet and in the photo choices (`apps/web/src/games/harmonies/stack-options.ts`):
  - "Trunks" covers `T` and `TT` (`HAR-STACK-3`: both score nothing). Stored as `T`.
  - "Building" covers `MR`, `TR`, `RR` (`HAR-STACK-4`, `HAR-BLD-1`). Stored as `MR`.
  - A space already holding one of an option's stacks keeps it when that option is picked, so a saved `TT` or `TR` isn't rewritten by confirming it (and isn't logged as a correction).
  - A lone `R` ("Lone Roof") stays separate: it isn't a building. Mountains 1/2/3 and trees `L`/`TL`/`TTL` stay separate (different points).
  - The full list: Empty Space, Water, Field, Mountain heights 1 to 3, the 3 trees, Trunks, Lone Roof, Building (12 options).
- **No scoring rule reads below the top except tree and mountain heights** (checked against `scoring.ts`): trees score by exact stack (`L`, `TL`, `TTL`); mountains are all-gray stacks scored by height; buildings are any 2-token stack topped with `R`, scored on neighbors' top colors; fields and water are single tokens; side B islands only ask whether a space is water. So `T`/`TT` and `MR`/`TR`/`RR` always score the same. Existing states with `TT`, `TR`, `RR` stay valid and render unchanged: no state change, no version bump.
- The "Show Labels" toggle and the side switch stay.

## UI states
- No photo (manual): nothing highlighted; the sheet opens on the full list.
- Photo review: spaces to answer are outlined, the banner counts them.
- Every highlighted space answered: no banner.

## Acceptance criteria
- [ ] After reading a sample photo there is no list of prompts under the board; spaces needing a height are highlighted on the board.
- [ ] Tapping a highlighted space and picking a stack removes its highlight and lowers the banner count by 1, even if the pick equals the draft.
- [ ] The sheet for a photo-read gray top offers 1 / 2 / 3; for red: "Lone Roof" / "Building"; for brown: "Trunks" / "Something Else"; for green: Leaves Only / 1 Trunk / 2 Trunks.
- [ ] The full list has no separate `TT`, `TR` or `RR` options.
- [ ] Saved games with `TT`, `TR` or `RR` still load and score as before (unit test).
- [ ] Answering spaces leaves `detection_meta` right: same `detected`, and `corrected` lists only changed stacks (unit test).
- [ ] e2e: sample photo, answer every highlighted space on the board, see the score.

## Tests
- `stack-options.test.ts`: the classes, picks keeping a member stack, and that swapping any stack for another in its class never changes the score on generated boards.
- `review.test.ts` (the pure confidence helpers): per-space confidence, answering raises both keys, and `detectionMeta` after answers.
- `scoring.test.ts`: a saved state with `TT`, `TR`, `RR` parses and scores as before.

## Out of scope
- Highlighting spaces whose color is confident and that need no height (they stay plain).
- A screen map entry for the photo review (`tests/e2e/screens.ts` is shared; see Shared change requests).

## Open questions
- Should spaces whose color is confident but not yet looked at stay plain? Resolved: yes, only height and low-confidence keys are highlighted (Scope).

## Decisions

## Corrections

## Shared change requests
