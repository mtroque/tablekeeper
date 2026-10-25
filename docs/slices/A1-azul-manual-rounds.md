# A1: Azul manual round tracker

**Status:** ✅ · **Depends on:** S1

**Goal:** Track a game round by round: enter the chocolate box and foundry line after each round, and the app scores what changed, keeps the running total and adds end bonuses, so nobody has to read the score track.

## Owns
- The `azul` game folders (AGENTS.md → Parallel sessions): `packages/core/src/games/azul/`, `apps/web/src/games/azul/`, `docs/games/azul.md`, `data/fixtures/azul/`.
- `apps/api/src/routes/sessions.azul.test.ts` (new file: Azul through the sessions API).
- `tests/e2e/A1.spec.ts`, this spec.

## Scope

**core** (`packages/core/src/games/azul/`)
- `AzulStateSchema` per `docs/games/azul.md` → State: `rounds` (each `wall: boolean[25]`, `floorCount` 0 to 7), `finished`. The schema also enforces `AZU-ROUND-2` and `AZU-ROUND-3` between consecutive rounds, so the API rejects any sequence the editor would reject. `stateVersion` stays 0: the S0 placeholder (`null` state) could never be saved, since a game without a scorer is rejected and no Azul UI existed, so there is nothing to upgrade.
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
- [x] The worked examples in the game doc pass. (`packages/core/src/games/azul/index.test.ts`: the four placement examples, the two worked rounds (0 floored, then 6) and the +2 end bonus example; the e2e test plays the same two rounds and sees "This Round −2", "0 Points", then "6 Points".)
- [x] Every `AZU-*` rule has a test named with its id. (Same file: `AZU-PLACE-1` to `-3`, `AZU-FLOOR-1` to `-3`, `AZU-END-1` to `-4`, `AZU-ROUND-1` to `-4`.)
- [x] Round errors (`AZU-ROUND-2`, `-3`) are shown on the editor and block Confirm Round; the API rejects a state that breaks them. (e2e guest test: two new tiles in row 5 and a removed confirmed tile each show their message and disable Confirm Round; `apps/api/src/routes/sessions.azul.test.ts` gets 400 `VALIDATION` for both.)
- [x] The API recomputes an Azul score and ignores a client-sent one. (`sessions.azul.test.ts`: a save with `scoreTotal: 50` stores 0; patches rescore to 6 and then 18.)
- [x] A guest can leave and resume on the same device; a signed-in user on another device. (e2e: the guest leaves for the library, comes back through Games in Progress to round 3, and a refresh keeps the taps of the round being entered; signed in, a game started in one browser context is resumed and finished in a second one.)
- [x] A finished game adds end bonuses once and, signed in, lands in history with the right total. (Core `AZU-END-4` test: 15 while playing, 17 finished, one bonus row; e2e: the signed-in game lands on its history page at 6 Points with the bonus rows, the guest game shows 18 Points with +7 for the column, and the old game URL redirects to history.)

Not run: a guest's "Sign In with Google" from Azul's final score. It uses S1's pending save (`setPendingSave`, saved by `/auth/callback`), which S1's e2e test covers; Azul only stores the completed state there.

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
- `stateVersion` stays 0 for the first real Azul state: the S0 placeholder could never be saved, and S0's registry test expects 0 for every game. A later shape change bumps it with an upgrade step.
- The state schema enforces `AZU-ROUND-2` and `-3` across consecutive rounds, so a stored game is always one the editor would accept; `checkAzulRound` gives the same errors to the editor with their cells.
- Each round's breakdown row is its change to the running total, so the rows add up to the total even when the score is floored at 0; the note gives the tiles, the foundry line penalty and how much of the penalty didn't count.
- Exported names that could clash with other games in the core barrel carry an Azul prefix (`checkAzulRound`, `scoreAzulRounds`, `AzulRoundScore`, ...).
- A guest's games in progress are found through ids under `tk:v1:azul:in-progress` in `localStorage`, read back through `SessionStore` (whose `list` is empty for guests); ids the store no longer has are dropped. Signed in, the score home lists in-progress Azul sessions from the store's first page.
- The round being entered is kept per game in `sessionStorage` (`tk:v1:azul:draft:<id>`), like the default flow's state, so a refresh keeps the taps.
- Confirm Final Round: signed in, the session is saved as completed and opens in history. A guest's finished game is kept on the device as in progress (`finished: true`) so the final score survives a reload, until they sign in to save it or tap Don't Save (both remove it from the device).
- Edit Last Round takes the last confirmed round back into the editor (also from the final score), so an entry mistake never needs a new game.
- The score home's in-progress query uses `staleTime: 0`, because the app-wide 60s cache showed a game just finished or discarded.
- `/score/result` (where S1's pending save returns after a failed save) offers a retry; other unknown paths say there's no game there. Non-UUID ids never reach the store.
- The UI says "tiles", as the rulebook does; only the terms in the edition vocabulary table are renamed.
- Additive wiring: `packages/core/src/index.ts` gains `export * from './games/azul';`.

## Shared change requests
None.
