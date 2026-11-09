# P4: Patchwork piece colors on the read board

**Status:** ⬜ · **Depends on:** P2

**Goal:** After a photo, each covered space on the box board is drawn in the color of the chocolate piece the photo shows there, so the player can compare the drawing with the table at a glance and spot a misread space.

## Owns
The `patchwork` game folders (AGENTS.md → Parallel sessions), plus this spec and `tests/e2e/P4.spec.ts`.

## Scope (must cover)
- Today a covered space is one flat chocolate fill (`apps/web/src/games/patchwork/colors.ts`), so a misread covered space looks just like a real one.
- Read a color per space from the photo: the median color of the space's middle (as `measure.ts` already samples it), corrected for light with the frame shift `classify.ts` uses, so it looks like the piece and not the room's light.
- Get the colors to the editor without changing the frozen `Draft` type (`packages/core/src/kit/types.ts`): compute them on the main thread from the flow's photo and corners in plain TypeScript, like Harmonies' `rereadAsSide` (D-064), exported from `@tablekeeper/cv/games/patchwork`. Kept in the editor, not in state: they aren't saved and don't affect the score.
- Covered spaces from the photo use their color; a space the player covers by hand, or any board without a photo (manual, history), uses the current flat fill. A space the player uncovers shows the board again.
- Low-confidence spaces keep the warning outline over the color; a covered space whose color is close to the board's own empty color stands out (that is the misread case).
- Optional "Photo Colors" / "Plain" toggle if the colors make the grid harder to read; decide in the spec.

## Acceptance criteria (draft)
- [ ] With a sample photo, covered spaces are drawn in colors matching the pieces in the photo (checked by eye on all three samples; screenshot noted in the spec).
- [ ] Manual entry and history look as they do today.
- [ ] Tapping a space still toggles it; uncovered spaces show the board color.
- [ ] Reading the colors adds under 100ms on a 1200px photo (measured).
- [ ] Unit test: the color reader returns 81 colors for a fixture, and a known covered space's color is near its labeled piece color.

## Open questions
- Raw photo color (truest) or snapped to a small chocolate palette (cleaner, but can hide a wrong piece)? Plan: raw, light-corrected.

## Decisions

## Shared change requests
