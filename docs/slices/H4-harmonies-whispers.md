# H4: Harmonies Crescendo, Whispers

**Status:** ⬜ · **Depends on:** H3

**Goal:** Players using the Crescendo expansion's Whispers module can score their Whisper cubes in the Harmonies scorer. This slice also adds the place where Crescendo modules are switched on, which H5 and H6 reuse.

## Owns
The `harmonies` game folders (AGENTS.md → Parallel sessions), plus this spec and `tests/e2e/H4.spec.ts`.

## Source
Official rulebook (English, 12 pages, square pages, so printed page N is PDF page N): https://cdn.svc.asmodee.net/production-libelludv2/uploads/2026/08/HARMONIES-CRESCENDO-RULES-EN.pdf. Asmodee Canada links another copy (`production-asmodeeca/uploads/2026/09/HC_RULES_EN-low.pdf`, same 12 pages); use the Libellud one. Whispers: pp. 10 to 12.

## Scope (must cover)
- Transcribe the Whispers scoring rules into `docs/games/harmonies.md` with ids (e.g. `HAR-WHISPER-1`), in our own words, plus the Crescendo rulebook URL and page note. Read from the rulebook p. 12 (planning read): each space with a Whisper cube alone scores 2; each space with a Whisper cube and an Animal or Nature's Spirit cube scores 5; a space holds at most one Whisper cube; unplaced cubes score 0. Update `HAR-TOTAL-1`.
- **Entry:** two counters, "Whisper Cubes Alone" and "Whisper Cubes with an Animal" (the second covers Nature's Spirit cubes too; say so in a hint). Counting cubes on the board is easier than marking hexes; tapping hexes for cubes is out of scope.
- **Modules:** a "Crescendo" section (or "Modules") in the editor where the player switches on Whispers; Sanctuaries (H6) and boards C and D (H5) join it later. Nature's Spirit cards stay as they are.
- **State:** optional `whispers?: { alone: number; withAnimal: number }`, absent when the module is off. Optional field, so old states stay valid; decide in the spec whether `stateVersion` still needs a bump. The API recomputes with the same scorer.
- Breakdown category "Whispers" with a note ("4 alone, 2 with an animal").
- History and breakdown show the category only when the module was on.

## Acceptance criteria (draft)
- [ ] With Whispers on, 3 alone and 2 with an animal scores Whispers 16 (worked example added to `docs/games/harmonies.md`).
- [ ] With Whispers off, nothing about Whispers is shown or saved.
- [ ] A saved game from before H4 loads and scores the same.
- [ ] Server recomputes the Whispers category (integration test).
- [ ] e2e: switch on Whispers, enter cubes, see the category in the breakdown.

## Out of scope
- The Crescendo rulebook in the rules assistant (one rulebook per game today; listed in Later).
- Photo detection of Whisper cubes.

## Open questions
- Where the module switches live: top of the editor (before the board) or with the card lists?

## Decisions

## Shared change requests
