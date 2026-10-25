# A1: Azul manual round tracker

**Status:** ⬜ stub · **Depends on:** S1

**Goal:** Track a game round by round: enter the wall and floor after each round, and the app scores what changed, keeps the running total and adds end bonuses.

## Owns
The `azul` game folders (AGENTS.md → Parallel sessions).

## Scope (must cover)
- Schema and scorer per `docs/games/azul.md` (`AZU-*`, State), including round validation errors shown on the editor.
- `ScoreFlow`: round strip with running totals, chocolate box editor with the fixed color pattern, foundry line slots, "Confirm Round", end of game; in-progress sessions resumable at `/score/<sessionId>`. User-facing text uses the edition's terms (`docs/games/azul.md` → Edition vocabulary).
- Only the colored chocolate box side; the free-placement brown side isn't supported.

## Acceptance criteria (draft)
- [ ] The worked examples in the game doc pass.
- [ ] A guest can leave and resume on the same device; a signed-in user on another device.
