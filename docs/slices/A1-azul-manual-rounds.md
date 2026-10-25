# A1: Azul manual round tracker

**Status:** 🟨 · **Depends on:** S1

**Goal:** Track a game round by round: enter the chocolate box and foundry line after each round, and the app scores what changed, keeps the running total and adds end bonuses, so nobody has to read the score track.

## Owns
- The `azul` game folders (AGENTS.md → Parallel sessions): `packages/core/src/games/azul/`, `apps/web/src/games/azul/`, `docs/games/azul.md`, `data/fixtures/azul/`.
- `apps/api/src/routes/sessions.azul.test.ts` (new file: Azul through the sessions API).
- `tests/e2e/A1.spec.ts`, this spec.

## Scope

**core** (`packages/core/src/games/azul/`)
- `AzulStateSchema` per `docs/games/azul.md` → State: `rounds` (each `wall: boolean[25]`, `floorCount` 0 to 7), `finished`. The schema also enforces `AZU-ROUND-2` and `AZU-ROUND-3` between consecutive rounds, so the API rejects any sequence the editor would reject. `stateVersion` 1 (the S0 placeholder was version 0 with `null` state; nothing was ever stored, so no upgrade step).
- `checkRound(previousWall, wall)`: the round errors for the editor, each with the cells it concerns (`AZU-ROUND-2`, `AZU-ROUND-3`).
- `placementScore(wall, row, col)` (`AZU-PLACE-2`, `-3`), `floorPenalty(count)` (`AZU-FLOOR-1`), `scoreRounds(state)`: per round its new tiles top row first, each with its placement score (`AZU-PLACE-1`), the foundry line penalty, the round score and the totals before and after (`AZU-ROUND-1`, `-4`, `AZU-FLOOR-3`). `endBonuses(wall)` (`AZU-END-1` to `-3`).
- `scoreAzul(state)` (the game's `score`): one category per confirmed round whose points are the change in the running total (so categories sum to the total when the floor at 0 applies; the note says how much was not lost), plus end bonus rows only when `finished` (`AZU-END-4`). Round rows highlight their new tiles and foundry slots; bonus rows highlight their rows, columns or color.
- The wall color pattern (`WALL_COLORS`) from the game doc's table.

**web** (`apps/web/src/games/azul/`), `ScoreFlow` under `/games/azul/score`:
- `/score` (score home): "New Game" and the games in progress. Signed in: in-progress Azul sessions from the store's first page. Guest: ids kept under `tk:v1:azul:in-progress` in `localStorage` (the store's `list` is empty for guests), each read back through the store; missing ones are dropped.
- New Game saves an in-progress session through `SessionStore` and opens `/score/<sessionId>`.
- `/score/<sessionId>`: round strip (each confirmed round's score and running total), chocolate box editor (5×5, each space drawn in its fixed color, faint when empty, tiles placed in earlier rounds solid, this round's new tiles marked), foundry line (7 slots with their penalties; tap a slot to fill up to it, tap the last filled slot to clear it), live "This Round" and total, round errors on the editor, "Confirm Round", "Confirm Final Round", "Edit Last Round". Every confirm saves through the store.
- Final round: signed in, the session is saved as completed and opens in history. Guest: the final breakdown with "Sign In with Google" (pending save, saved on return) or "Don't Save".
- `Breakdown` for the result and history: the chocolate box miniature with highlights.
- `/score/result` (where a failed pending save returns): a retry.

## UI states
- Score home: no games in progress (one sentence and New Game), loading, error with retry.
- Game page: loading, session not found ("This game isn't on this device." for guests, or not in the account), save failed (round stays in the editor, retry), round errors (Confirm disabled, cells outlined, message per error), a completed session opened from its URL goes to history.

## Acceptance criteria
- [ ] The worked examples in the game doc pass.
- [ ] Every `AZU-*` rule has a test named with its id.
- [ ] Round errors (`AZU-ROUND-2`, `-3`) are shown on the editor and block Confirm Round; the API rejects a state that breaks them.
- [ ] The API recomputes an Azul score and ignores a client-sent one.
- [ ] A guest can leave and resume on the same device; a signed-in user on another device.
- [ ] A finished game adds end bonuses once and, signed in, lands in history with the right total.

## Tests
- core: every rule id, the worked examples, schema round validation, breakdown sums.
- api: save and patch an Azul game, tampered total, invalid round sequence.
- e2e (`tests/e2e/A1.spec.ts`): the worked rounds as a guest with reload; signed in, start in one browser context, resume in another, finish, history total.

## Out of scope
- The brown free-placement side (Variant play), photo detection (A2), other players' boards, tie breaks.

## Open questions
None open. Resolved from the docs:
- "Tile": the rulebook says tiles (chocolate tiles); the vocabulary table renames only wall, floor line, wall-tiling and first player marker.
- A round may add no tiles (all to the foundry line), so an empty round is valid.
- The game end is not checked against a complete row: the round that ends the game can be triggered by another player's row.

## Decisions

## Shared change requests
None.
