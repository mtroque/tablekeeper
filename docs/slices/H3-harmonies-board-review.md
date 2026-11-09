# H3: Harmonies review on the board

**Status:** ⬜ · **Depends on:** H2

**Goal:** The player checks and fixes a photo's reading by tapping hexes on the board itself, not in a list of prompts under it. Spaces that need an answer stay highlighted until answered, and the app asks only for choices that change the score.

## Owns
The `harmonies` game folders (AGENTS.md → Parallel sessions), plus this spec and `tests/e2e/H3.spec.ts`.

## Scope (must cover)
- **Remove "Set Heights"** (`apps/web/src/games/harmonies/height-prompts.tsx`) and its section in the editor.
- **Tap any hex** opens the stack sheet (as now). When the space's top came from a photo, the sheet shows that top color's choices first (the `CHOICES` in `height-prompts.tsx` move here), then "Something Else" for the full list.
- **Highlight until answered:** a space with a `"q,r:height"` key or a low-confidence `"q,r"` key is highlighted on the board until the player picks a stack for it (even the same one the photo gave). Answered spaces also drop out of the review banner's count. Do this inside the game: the editor already calls `useFlow('harmonies').setFlow`, so it can raise the answered keys' confidence in the flow's draft; check that `detection_meta` (`corrected`, `detected`, D-037) stays right. If that can't be done cleanly, write a shared change request for a generic "confirmed" set in `ReviewStep`.
- **One option per score-equivalent stack** (per `docs/games/harmonies.md` → Valid stacks and Scoring rules), in the sheet and in the photo choices:
  - `T` and `TT` score nothing (`HAR-STACK-3`): one "Trunks" option (stored as `T`).
  - `MR`, `TR`, `RR` are all buildings (`HAR-STACK-4`, `HAR-BLD-1`; only tops count for neighbors): one "Building" option (stored as `MR`, or keep whatever the space had if it was already a building). A lone `R` stays separate: it isn't a building.
  - Mountains 1/2/3 and trees `L`/`TL`/`TTL` stay separate (different points).
  - Confirm in the spec that no scoring rule reads below the top except tree and mountain heights; the existing states with `TT`, `TR`, `RR` stay valid and render unchanged (no state change, no version bump).
- The "Show Labels" toggle and the side switch stay.

## UI states
- No photo (manual): nothing highlighted; the sheet opens on the full list.
- Every highlighted space answered: no banner.

## Acceptance criteria (draft)
- [ ] After reading a sample photo there is no list of prompts under the board; spaces needing a height are highlighted on the board.
- [ ] Tapping a highlighted space and picking a stack removes its highlight and lowers the banner count by 1, even if the pick equals the draft.
- [ ] The sheet for a photo-read gray top offers 1 / 2 / 3; for red: "Lone Roof" / "Building"; for brown: "Trunks" / "Something Else"; for green: Leaves Only / 1 Trunk / 2 Trunks.
- [ ] The full list has no separate `TT`, `TR` or `RR` options.
- [ ] Saved games with `TT`, `TR` or `RR` still load and score as before (unit test).
- [ ] e2e: sample photo, answer every highlighted space on the board, see the score.

## Open questions
- Should spaces whose color is confident but not yet looked at stay plain? Plan: only height and low-confidence keys are highlighted.

## Decisions

## Shared change requests
