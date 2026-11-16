# W15: Local screenshots

**Status:** ⬜ · **Depends on:** none

**Goal:** Agents can see the screens they build without writing throwaway Playwright specs. One command screenshots a route in a given state at phone size, so the definition of done's screen-state check is a step, not an improvisation. W10 later builds its screen map and CI job on top of it.

## Owns
- `scripts/shot.ts`, `package.json` (one script line), `README.md` (Commands), `AGENTS.md` (Definition of done, item 3: point at `pnpm shot`)

## Scope (must cover)
- `pnpm shot <route> [--state <name>] [--dark] [--signed-in]` starts or reuses `pnpm dev` (ports picked as usual), opens the route at 390×844 with Playwright, and writes PNGs to `.scratch/<session or slice>/shots/` (gitignored; the folder name defaults to the branch name), printing their paths. It never clears anything outside that folder (AGENTS.md → Parallel sessions).
- States it can reach without a screen map: guest, signed in as a seeded test user (`scripts/lib/test-users.mjs`), offline, light and dark. Anything else is W10's map.
- Works from a worktree as one plain command (AGENTS.md → Parallel sessions).
- Why: the 2026-11-16 transcript pass found 6 build sessions writing temporary `tests/e2e/zz-shot.spec.ts` files just to look at screens; several were refused by the worktree guard, and 6 reads failed on screenshots that were never written (`docs/CORRECTIONS.md`, `scratch-files-in-repo`).

## Acceptance criteria
- [ ] From a worktree, `pnpm shot /games/patchwork/score --dark` writes a PNG an agent can open with Read
- [ ] A signed-in route renders signed in, not the sign-in screen

## Out of scope
- The screen map, CI upload and PR comments (W10).

## Open questions

## Decisions

## Corrections

## Shared change requests
