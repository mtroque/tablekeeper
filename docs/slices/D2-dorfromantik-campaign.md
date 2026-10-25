# D2: Dorfromantik campaign and unlocks

**Status:** ⬜ stub · **Depends on:** D1

**Goal:** After each game, record what the campaign unlocked and show its progress on a campaign page.

## Owns
The `dorfromantik` game folders (AGENTS.md → Parallel sessions).

## Scope (must cover)
- Finish flow per `docs/UX.md` → Dorfromantik, using the high-score table and unlock list in the game doc.
- Spoiler-safe: names only until unlocked.
- `Campaign` page: games played, high score, rank title, unlocks with the game each came in, undo an unlock, start a new campaign (archives the old one).
- One active campaign per user; older ones are archived.
- Red Hearts: one unlock item, with a count of hearts from 1 to 3 (`docs/games/dorfromantik.md` → Campaign sheet unlockables).

## Acceptance criteria (draft)
- [ ] 142 points → Actress, 4 circles.
- [ ] Red Hearts can be unlocked at most 3 times.
- [ ] Undoing an unlock affects future games only.
