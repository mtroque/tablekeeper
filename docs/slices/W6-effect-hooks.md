# W6: Effects only through named hooks

**Status:** ⬜ · **Depends on:** W2

**Goal:** Raw `useEffect` is easy to misuse and agents copy whatever is there. Replace the 8 current uses with a few named hooks (or no effect at all), then ban `useEffect` outside those hooks.

## Owns
- `apps/web/src/lib/hooks/` (new), with tests
- The files using `useEffect` today: `games/patchwork/editor.tsx`, `games/dorfromantik/finish-screen.tsx`, `games/azul/score-flow.tsx`, `games/azul/game.tsx`, `components/score-flow/default-score-flow.tsx`, `components/score-flow/capture-step.tsx`, `components/auth-provider.tsx`, `app/auth/callback/page.tsx`
- `eslint.config.js` (the ban), `docs/CONVENTIONS.md` → Web, `docs/AUTOMATION.md` (W6 row)

## Scope (must cover)
- Classify each use: derived state (remove the effect), redirect on a condition, timer, one-time start, subscription. Patchwork's editor syncs state into its parent from an effect; move that into the event that causes it.
- Hooks with names that say what they do (e.g. `useRedirectWhen`, `useTimeout`, `useRunOnce`), each with a test.
- Ban `useEffect` and `useLayoutEffect` outside `lib/hooks/`, with a message listing the hooks.
- Behavior unchanged: every affected flow's e2e test still passes.

## Acceptance criteria
- [ ] No `useEffect` outside `apps/web/src/lib/hooks/`, and lint fails on a new one
- [ ] All e2e tests for S1, A1, D1, D2, P1 and S0 pass

## Out of scope

## Open questions

## Decisions

## Shared change requests
