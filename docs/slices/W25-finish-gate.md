# W25: Finish gate

**Status:** ⬜ · **Depends on:** none

**Goal:** A slice can't be folded away with acceptance criteria still unchecked. Twice an agent finished anyway: X4 merged with production sign-in unverified, and production then broke; W11, W12 and W14 were folded with their live criteria open, so nothing tracked them. Every criterion must be checked, moved to a named follow-up spec, or the slice stays open.

## Owns
- `scripts/lib/check-repo/finish-gate.ts` with tests, `scripts/check-repo.ts` (wiring)
- `AGENTS.md` (Definition of done, items 2 and 6), `.agents/skills/build/SKILL.md`, `.agents/skills/issue/SKILL.md`, `docs/slices/_TEMPLATE.md` (how to move a criterion)
- `docs/AUTOMATION.md` (enforcement map row), `docs/CORRECTIONS.md` (the two rows' statuses)

## Scope
- **Check:** when a branch deletes a spec (its finish commit), `pnpm check:repo` reads the spec's last version, which it already does for ownership, and fails for each `- [ ]` line under `## Acceptance criteria`, unless the line ends with `(moved to <id>)` and `docs/slices/<id>-*.md` exists at `HEAD`. The message names the criterion and both ways out. It also fails when a branch sets a slice's roadmap row to ✅ while that slice's spec still exists with unchecked criteria.
- **Moving a criterion:** the follow-up spec copies the criterion into its own `## Acceptance criteria`, so it stays tracked. W24 is the first example, for W11, W12 and W14.
- **Rules text:**
  - Definition of done item 2 says a criterion that can't be verified yet (it needs owner setup or a deploy) is either moved to a follow-up spec or keeps the slice ⏸ with the reason. It's never folded away.
  - `/build` and `/issue` say the same where they describe finishing.
- This is the `/harden` promotion of `finished-with-unverified-criteria` (2 occurrences, `docs/CORRECTIONS.md`); set those rows to `promoted` in the finish commit.

## Acceptance criteria
- [ ] A branch deleting a spec with an unchecked criterion fails `pnpm check:repo` with the criterion quoted (paste it)
- [ ] The same branch passes once the line says `(moved to W24)` and W24's spec exists
- [ ] A branch marking a roadmap row ✅ while its spec has unchecked criteria fails
- [ ] The `finished-with-unverified-criteria` rows are `promoted: check:repo finish gate`

## Tests
- `finish-gate.test.ts`: all checked passes; unchecked fails; moved to an existing spec passes; moved to a missing spec fails; criteria outside `## Acceptance criteria` are ignored; ✅ roadmap row with an open spec fails.

## Out of scope
- Checking PR bodies' verification lists (they repeat the spec).

## Open questions

## Decisions

## Corrections

## Shared change requests
