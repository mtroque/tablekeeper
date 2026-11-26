# U1: Who goes first

**Status:** 🟨 · **Depends on:** S0

**Goal:** Any table can pick a random first player with the phone in the middle: everyone taps once, the screen splits into a wedge facing each player, and a tap in the center spins a roulette that lands on one of them. Works for every game, and for games Tablekeeper doesn't support.

## Owns
- `packages/core/src/tools/first-player/` and its tests
- `apps/web/src/tools/first-player/` and the route's `apps/web/src/app/tools/first-player/page.tsx`
- `docs/UX.md` → Routes (the new row) and → Key interactions (a new "Who goes first" section)
- `docs/PRODUCT.md` → Games and features (a short "Table tools" note)
- `tests/e2e/U1.spec.ts`, and the new route's entries in `tests/e2e/screens.ts` (additive)
- Additive wiring only (one added line each, no existing line changed): `packages/core/src/index.ts` (export), `apps/web/src/app/page.tsx` (library link), `apps/web/src/app/games/[gameId]/layout.tsx` (hub header link). The last two aren't in `check:repo`'s wiring list, so they're named here.

## Scope
- **Route:** `/tools/first-player`, a client screen inside the app shell. No account, no server call, nothing saved; it keeps working after the connection drops.
- **Joining:** each player taps the table area where they sit. A tap adds a numbered marker (1, 2, 3 in tap order); tapping a marker removes it and the others renumber. 2 to 8 players: a ninth tap is refused with a message. Taps in the center circle (under the spin button) don't add a player. A tap within 15 degrees of another player's direction is refused ("Too close to player 2."), so every wedge stays wide enough to see and tap.
- **Keyboard:** an "Add Player" button (visually hidden until focused) adds a player in the middle of the widest gap, so the screen works without a pointer.
- **Wedges (core):** `packages/core/src/tools/first-player/`: tap points are turned into angles around the center of the table area, sorted by angle; each wedge runs from the bisector with its previous neighbor to the bisector with its next one (wrapping around), so it contains its tap. One player gets the whole circle.
- **Spin (core + web):** the winner is drawn first, uniformly, by rejection sampling over 32-bit values from `crypto.getRandomValues` (no modulo bias, no `Math.random`). Core then lists the steps the highlight takes: from the current wedge clockwise for 3 full turns and on to the winner, with delays that ease out from 50ms to about 400ms (about 3.5s in total). The web plays the steps with timers, cancelled on unmount. While spinning, taps and the button do nothing.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, no steps play: the status reads "Picking." for 600ms, then the winner shows.
- **Result:** the winner's wedge fills with `--accent`, its marker turns solid, and the status line (an `aria-live` region) reads "Player 3 goes first." The center button becomes "Spin Again"; "New Players" clears the markers. One short vibration on landing where `navigator.vibrate` exists.
- **Entry points:** a "Table Tools" section with a "Who Goes First" link at the foot of the game library, and a small "Who Goes First" link in each game hub's header (not a tab: tabs come from `GameDefinition.features`).
- **Look:** wedge fills cycle `--accent-soft`, `--warn-soft`, `--surface`, `--line` (never the same color on both sides of a boundary), 1px boundaries; markers carry their number, so color is never the only signal.

## UI states
- **Empty:** no taps yet: the center reads "Each player taps where they sit."; no spin button.
- **One player:** the spin button is shown disabled; the status says another player is needed.
- **Ready:** 2 to 8 markers and wedges; "Spin" enabled; "New Players" below.
- **Spinning:** the highlight steps around; "Spin" disabled, markers inert.
- **Result:** winner highlighted and announced; "Spin Again" and "New Players".
- **Refused tap:** the status line says why (too close, the center, or 8 players already), and nothing else changes.

## Acceptance criteria
- [ ] Three taps on different sides of the screen give three wedges, each containing its tap (unit test on the core, and e2e: three markers and three wedges).
- [ ] The spin lands on a wedge and announces it, visibly and in an `aria-live` region (e2e); over many draws in a unit test each player wins about equally often.
- [ ] Spin is disabled with fewer than 2 players (e2e).
- [ ] Reduced motion shows the winner without the animation (e2e with `reducedMotion: 'reduce'`: no spinning steps are seen, and the winner shows).
- [ ] Reachable from the game library and from inside a game, and works offline (e2e: both links, then a spin with the browser context offline).

## Tests
- Core unit tests: wedge ordering and containment (three sides, nearly the same angle, all taps along one side, one player), refusals (too close, center, ninth player), the widest-gap seat, `pickIndex` uniformity (chi-square over 80,000 draws with a seeded source) and rejection of biased values, spin steps ending on the winner, delays easing out.
- `tests/e2e/U1.spec.ts`: the main flow, reduced motion, entry links, offline.

## Out of scope
- Showing a game's own first-player rule when opened from a game (no shared field for it, and `kit/types.ts` is frozen; a later slice can add it from `docs/games/`).
- Multi-touch (everyone holding a finger down at once): one tap at a time works on any phone.
- Haptics on each tick (calm motion); only the landing pulse.
- Saving results or player names.

## Open questions
None left; the stub's questions are answered under Scope and Out of scope.

## Decisions
- Route `/tools/first-player`, linked from the library foot and each hub header rather than a tab.
- Taps one at a time; at most 8 players; a 15 degree minimum between players' directions.
- Randomness: core takes a `nextUint32` source so it stays free of DOM and Node APIs; the web passes `crypto.getRandomValues`.
- The game's own first-player rule is not shown in U1.

## Corrections

## Shared change requests
- Links to the tool from the game library and the game hub: applied as additive wiring (one line each), listed under Owns.
