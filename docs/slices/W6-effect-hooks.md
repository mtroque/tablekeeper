# W6: Effects only through named hooks

**Status:** ⬜ · **Depends on:** W2

**Goal:** Raw `useEffect` is easy to misuse, and agents copy whatever is already there. Replace the 8 current uses with two named hooks (or no effect at all), then make lint reject `useEffect` and `useLayoutEffect` anywhere else, so the next agent reaches for a hook whose name says what it does.

## Owns
- `apps/web/src/lib/hooks/` (new): `use-redirect-when.ts`, `use-on-mount.ts`, `index.ts`, with tests
- The files using `useEffect` today (paths under `apps/web/src/`): `app/auth/callback/page.tsx`, `components/auth-provider.tsx`, `components/score-flow/capture-step.tsx`, `components/score-flow/default-score-flow.tsx`, `games/azul/game.tsx`, `games/azul/score-flow.tsx`, `games/dorfromantik/finish-screen.tsx`, `games/patchwork/editor.tsx`
- `eslint.config.js` (the ban), `docs/CONVENTIONS.md` → Web, `docs/AUTOMATION.md` (the W6 row of the enforcement map)

## Scope
Each current use, what it really is, and where it goes:

| File | What the effect does | Replacement |
|---|---|---|
| `app/auth/callback/page.tsx` | Finishes the OAuth return once on load (refresh session, resume a pending save, go back) | `useOnMount` |
| `components/auth-provider.tsx` | Loads the session once, ignoring the result after unmount | `useOnMount` (its abort signal replaces the `cancelled` flag) |
| `components/score-flow/capture-step.tsx` | Runs every render: redirects when there's no photo, otherwise starts reading the photo once | `useRedirectWhen(!photo && !leaving, base)` plus `useOnMount` for the read |
| `components/score-flow/default-score-flow.tsx` | Redirects when the flow is lost | `useRedirectWhen` |
| `games/azul/game.tsx` | Redirects a signed-in user to history when the game is completed | `useRedirectWhen` |
| `games/azul/score-flow.tsx` | Redirects a guest away from the retry screen | `useRedirectWhen` |
| `games/dorfromantik/finish-screen.tsx` | Clears a highlight after 900ms | No effect: a CSS animation (respecting `motion-reduce`) |
| `games/patchwork/editor.tsx` | After a board switch, pushes the kept chits and special tile into the parent | No effect: send them in the board-switch handler that causes the change |

- **`useRedirectWhen(condition, href)`**: `router.replace(href)` when `condition` becomes true; never pushes history.
- **`useOnMount(task)`**: runs `task(signal)` once per mount (once in Strict Mode too, via a ref), aborts the signal on unmount, ignores a result after abort.
- **Ban:** `@typescript-eslint/no-restricted-imports` for the named imports `useEffect` and `useLayoutEffect` from `react`, and `no-restricted-properties` for `React.useEffect` and `React.useLayoutEffect`, everywhere in `apps/web/src/` except `lib/hooks/`. The message names both hooks and says to add a new named hook in `lib/hooks/` when neither fits. No baseline: all 8 uses are replaced in this slice.
- **Behavior unchanged:** no UI or copy changes.

## UI states
None new.

## Acceptance criteria
- [ ] `grep -rn "useEffect\|useLayoutEffect" apps/web/src` finds them only in `lib/hooks/`
- [ ] A new `useEffect` in a component fails `pnpm lint` with the message naming the hooks (show the output)
- [ ] The e2e tests covering the changed flows pass: S0, S1, A1, D1, D2, P1, P2, X4

## Tests
- `use-redirect-when.test.ts`: redirects once when the condition turns true, not before, with `replace`.
- `use-on-mount.test.ts`: runs once under Strict Mode, aborts on unmount, ignores a late result.

## Out of scope
- `useSyncExternalStore` and other hooks: they're fine as they are.

## Open questions

## Decisions
- Two hooks, not three: the only timer can be CSS, so `useTimeout` isn't needed yet. Add hooks when a real use needs one.

## Corrections

## Shared change requests
