# W15: Local screenshots

**Status:** 🟨 · **Depends on:** none

**Goal:** Agents can see the screens they build without writing throwaway Playwright specs. One command screenshots a route in a given state at phone size, so the definition of done's screen-state check is a step, not an improvisation. W10 later builds its screen map and CI job on top of it.

## Owns
- `scripts/shot.ts`, `scripts/lib/shot-args.ts` with tests
- `package.json` (one script line), `README.md` (Commands), `AGENTS.md` (Definition of done, item 3: point at `pnpm shot`)

## Scope
- **Command:** `pnpm shot <route> [--signed-in [user]] [--offline] [--dark] [--wait <selector>]`, for example `pnpm shot /games/patchwork/score --dark`.
  - Route parameters are written out (`/games/azul/history/<id>`); W10 adds map entry ids later.
  - `--signed-in` uses the same minted test JWT as the e2e tests (`tests/e2e/helpers.ts`), with a user from `scripts/lib/test-users.mjs` (default `default`). Never real accounts.
  - `--offline` loads the page, then sets the browser context offline and waits a moment, so the offline state shows.
  - `--wait` waits for a selector before the shot (default: network idle).
- **Server:** if `SHOT_URL` is set, it uses that running app. Otherwise it starts the app the way `pnpm dev` does (free ports, local env), waits for it, takes the shots, and stops it. One plain command either way, so it works in a worktree (AGENTS.md → Parallel sessions).
- **Output:** Chromium at 390×844, PNG to `.scratch/<branch>/shots/<route-slug>-<state>-<theme>.png` (gitignored; the folder name is the current branch name, as AGENTS.md asks). It prints each path so an agent can open it with Read. It never deletes anything outside its own `shots/` folder.
- **Why:** the 2026-11-16 transcript pass found 6 build sessions writing temporary `tests/e2e/zz-shot.spec.ts` files just to look at screens. Several were refused by the worktree guard, and 6 reads failed on screenshots that were never written (`docs/CORRECTIONS.md`, `scratch-files-in-repo`).

## Acceptance criteria
- [ ] From a worktree, `pnpm shot /games/patchwork/score --dark` writes a PNG an agent can open with Read
- [ ] `pnpm shot /games/patchwork/history --signed-in patchwork` renders the signed-in history, not the sign-in prompt
- [ ] `--offline` on a rules page shows "You're offline."
- [ ] `AGENTS.md` → Definition of done, item 3 names `pnpm shot` as the way to check screen states

## Tests
- `shot-args.test.ts`: argument parsing, route slug and file name, unknown flags rejected with usage.

## Out of scope
- The screen map, CI upload and PR comments (W10). Visual diffs.

## Open questions

## Decisions
- Reuses the e2e sign-in helper rather than a second way to sign in, so screenshots and tests can't drift apart.

## Corrections

## Shared change requests
