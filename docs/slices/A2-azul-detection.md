# A2: Azul wall and floor detection

**Status:** deferred · **Depends on:** A1, S2

**Deferred:** the wall prints each chocolate's image on its space, so empty and occupied spaces look alike in a photo (D-017, `docs/games/azul.md` → Board). Azul is a manual round tracker (A1). This stub is kept for a later attempt.

**Goal:** Pre-fill each round's wall and floor from a photo of the player board.

## Owns
The `azul` game folders (AGENTS.md → Parallel sessions).

## Scope (must cover)
- Layout: 25 chocolate box spaces + 7 foundry line slots.
- Chocolate box space occupied vs empty, calibrated per position (the printed chocolate box shows faint tile art); foundry line = occupied slot count (the starting player marker counts).
- Tile colors under warm light are calibrated from the fixtures.
- A draft that removes a confirmed tile shows as an error on that cell (`AZU-ROUND-3`).
- Sample photos per `docs/DATA_ASSETS.md`.
- Fixtures and labels: `data/fixtures/azul/` (`docs/DATA_ASSETS.md` → Fixtures); chocolate box and foundry line placement: `docs/games/azul.md` → Board.
- Placed tiles are raised, so their edges and shadows may separate them from the printed images better than color does.

## Acceptance criteria (draft)
- [ ] `pnpm eval:cv azul`: ≥ 98% chocolate box space accuracy, ≥ 95% exact foundry line counts.
