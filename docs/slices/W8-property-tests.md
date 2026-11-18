# W8: Property-based tests

**Status:** 🟨 · **Depends on:** W1

**Goal:** Catch scoring and contract bugs no hand-written example covers, by checking invariants over generated game states with fast-check. A wrong saved score is high-stakes (`docs/CORRECTIONS.md`), and these properties hold for every game, so they guard each new game for free.

## Owns
- `packages/core/src/kit/properties.ts` (the shared properties as one reusable test helper) and `packages/core/src/kit/properties.test.ts`
- `packages/core/src/games/<gameId>/arbitrary.ts` and `<gameId>.property.test.ts` for each registered game (patchwork, azul, harmonies, dorfromantik, and `_example`)
- `packages/core/src/contracts/contracts.property.test.ts`
- `packages/core/package.json` (dev dependency `fast-check`, justified in the commit: generating valid states by hand for four games is the whole point and not a few lines), `vitest.config.ts` (seed setup, additive), `docs/CONVENTIONS.md` → Testing, `docs/AUTOMATION.md` (W8 row)

## Scope
- **Arbitraries:** one per game, hand-written from the game's `stateSchema` and `docs/games/<gameId>.md` (board shapes, piece counts), producing only valid states. No schema-to-arbitrary library: the schemas carry refinements a generic generator can't satisfy. Each arbitrary has a check that everything it generates parses with `stateSchema`.
- **Shared properties** (a helper every game's property test calls with its definition and arbitrary):
  1. `score(state).total` equals the sum of its categories' points, and category keys are unique.
  2. Scoring is deterministic: the same state scores the same twice, and scoring doesn't mutate the state.
  3. Round trip: `stateSchema.parse(JSON.parse(JSON.stringify(state)))` deep-equals the state.
  4. `upgrade(state, stateVersion)` (when defined) returns the state unchanged.
  5. `initialState()` parses and scores without throwing.
- **Game-specific properties** only where `docs/games/<gameId>.md` states them (for example a rule that a component never scores negative); each names the rule id in its title, like the rule tests. No invented rules.
- **Contracts:** for generated valid states, the save and patch session request schemas accept them with their game id; they reject unknown game ids, a state from another game, and wrong types.
- **Seeds:** CI runs with a fixed seed, so a property can't fail on an unrelated PR; locally the seed is random. fast-check prints the seed and path on failure, and `FC_SEED=<n> pnpm test:unit` replays it. Default 100 runs per property.

## Acceptance criteria
- [ ] Every registered game passes the shared properties in `pnpm test:unit`
- [ ] Every counterexample found while building is fixed with a regular test that reproduces it, or recorded here
- [ ] A deliberately broken scorer (a category left out of the total) fails property 1 with a printed seed (show the output)

## Tests
This slice is tests. The helper itself is tested against a toy game where each property holds and one where each fails.

## Out of scope
- UI property testing. Randomized runs on a schedule (could join the groomer later).

## Open questions

## Decisions
- No score-bounds property: no game doc states a maximum, and guessing one would be guessing rules.
- "API agrees with UI" from the enforcement map needs no property: both call the same `score` from `packages/core`, and the API recomputing scores is covered by API tests.

## Corrections

## Shared change requests
