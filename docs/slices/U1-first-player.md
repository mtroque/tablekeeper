# U1: Who goes first

**Status:** ⬜ · **Depends on:** S0

**Goal:** Any table can pick a random first player with the phone in the middle: everyone taps once, the screen splits into a wedge facing each player, and a tap in the center spins a roulette that lands on one of them. Works for every game, and for games Tablekeeper doesn't support.

## Owns
- `packages/core/src/tools/first-player/` and its tests
- `apps/web/src/tools/first-player/` and the route's `page.tsx`
- `docs/UX.md` → Routes (the new row) and → Key interactions (a new "Who goes first" section)
- `docs/PRODUCT.md` → Games and features (a short "Table tools" note)
- `tests/e2e/U1.spec.ts`, and the new route's entries in `tests/e2e/screens.ts` (additive)

## Scope (must cover)
- **Joining:** each player taps the screen once, where they sit. Each tap adds a player marker; tapping a marker again removes it. 2 to 8 players (decide the max in the spec).
- **Wedges:** core takes the tap points and returns one wedge per player around the center, ordered by angle, with boundaries halfway between neighbors, so each wedge points at the player who tapped it. Pure functions in `packages/core`, unit-tested (including taps at nearly the same angle and a single side of the screen).
- **Spin:** a center button starts the roulette. The winner is drawn first, uniformly (`crypto.getRandomValues`, not `Math.random`), then the highlight runs around the wedges and slows to land on it. Tapping again during the spin does nothing; after it lands, "Spin Again" and "New Players".
- **Reduced motion:** with `prefers-reduced-motion`, skip the spin and show the winner after a short pause.
- No account, no server, works offline. Nothing is saved.
- Screen states: no taps yet (empty state explains "Each player taps where they sit"), 1 player (spin disabled), ready, spinning, result.
- Look and voice per `docs/UX.md` (no emoji, no em or en dashes); wedge colors from the design tokens, still distinguishable without color (marker number or initial).

## Acceptance criteria (draft)
- [ ] Three taps on different sides of the screen give three wedges, each containing its tap.
- [ ] The spin lands on a wedge and announces it (visible and to screen readers); over many draws in a unit test each player wins about equally often.
- [ ] Spin is disabled with fewer than 2 players.
- [ ] Reduced motion shows the winner without the animation.
- [ ] Reachable from the game library and from inside a game, works offline (e2e).

## Open questions
- Route and entry points: `/tools/first-player`, linked from the game library and from each game hub (a header button rather than a tab, since hub tabs come from `GameDefinition.features`)?
- Taps one at a time (as above), or everyone holds a finger down at once (multi-touch)? One at a time is simpler and works on any phone.
- Should it also show the game's own first-player rule from `docs/games/<gameId>.md` when opened from a game? Only where the rule is in the game doc; never guessed.
- Haptics (`navigator.vibrate`) on each tick and on landing?

## Decisions

## Corrections

## Shared change requests
- A link to the tool from the game library and the game hub (additive wiring, list it in Decisions).
