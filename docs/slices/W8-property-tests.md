# W8: Property-based tests

**Status:** ⬜ · **Depends on:** W1

**Goal:** Catch scoring and contract bugs no hand-written example covers, by checking invariants over generated game states with fast-check.

## Owns
- `packages/core/src/kit/arbitraries/` (or per game `games/<gameId>/*.property.test.ts`) and the property tests, `packages/core/package.json` (dev dependency), `docs/CONVENTIONS.md` → Testing, `docs/AUTOMATION.md` (W8 row)

## Scope (must cover)
- Arbitraries that generate valid states for each game from its schema.
- Properties for every game: breakdown lines sum to the total; a valid state survives a Zod round trip and an `upgrade`; scoring is deterministic; scores are within the game's bounds.
- Game-specific properties only where `docs/games/<gameId>.md` states them (no guessing rules).
- Contracts: every request schema rejects unknown game ids and wrong types.
- Runs in `pnpm test:unit` with a fixed seed in CI and a printed seed on failure.

## Acceptance criteria
- [ ] Every registered game has the shared properties passing
- [ ] Any counterexample found is fixed or recorded here with a test

## Out of scope
- UI property testing.

## Open questions

## Decisions

## Shared change requests
