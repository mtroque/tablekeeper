# S4: CV Worker Detectors Without UI

**Status:** ✅ · **Depends on:** S2

**Goal:** Photo scoring works in production builds. The CV worker finds detectors without importing the web game UI, so `next build` (Turbopack) finishes and the worker runs in the deployed app.

## The problem

`apps/web/src/workers/cv.worker.ts` looks detectors up through `GAME_UI[gameId].detector` (D-029), so it imports `apps/web/src/games/registry.ts` and with it every game's React components (46 files on `main`). One of them leads back to the worker itself:

`cv.worker.ts` → `games/registry.ts` → `games/_example/index.ts` → `_example/score-flow.tsx` → `components/score-flow/default-score-flow.tsx` → `components/score-flow/capture-step.tsx` → `lib/cv-client.ts` → `new Worker(new URL('../workers/cv.worker.ts', import.meta.url))`

Found on 2026-10-25 during the first Vercel deploy:

- **Turbopack (`next build`, the default):** hangs at "Creating an optimized production build" and never finishes. It reproduces in a clean clone with plain CSS and no PostCSS config. Removing the worker's registry import makes it build in about 2s.
- **Webpack (`next build --webpack`):** builds, but the worker crashes on load in the browser with `ReferenceError: document is not defined`, because UI code runs in the worker scope. Checked by serving the build with `next start` and starting the worker in Chromium.
- **`next dev`** compiles lazily and never hits the loop, so dev and every e2e test (which run against `next dev`) look fine.

**Workaround before this slice (removed by it):** Vercel builds with `next build --webpack` (`docs/DEPLOYMENT.md` → Vercel). Pages work; photo detection doesn't, which on `main` affects no real game yet, since no game ships a detector before P2 and H2.

## Owns

- `apps/web/src/workers/cv.worker.ts` and a new `apps/web/src/workers/cv-worker-imports.test.ts`
- `apps/web/src/games/detectors.ts` (new): the UI-free detector lookup
- `apps/web/src/games/<gameId>/detector.ts` (new) for `_example`, `patchwork`, `azul`, `harmonies`, `dorfromantik`: one loader stub per game; game slices own them afterwards
- `apps/web/src/games/types.ts` (removing `detector` from `GameUiModule`), `apps/web/src/games/_example/index.ts`
- `scripts/test-build.mjs` and `tests/build/playwright.config.ts` (new), the root `package.json` `test:build` script, its line in `README.md` → Commands
- `docs/ARCHITECTURE.md` → Monorepo, Game modules and Computer vision (the detector contract)
- `docs/DEPLOYMENT.md` → Vercel (removing the webpack workaround)
- `tests/e2e/S4.spec.ts`

## Scope

Must cover:

- The worker imports nothing that reaches React, `document` or `lib/cv-client.ts`. Detector loaders live in a module the worker can import safely.
- Games stay pre-registered (D-008): game slices add their detector without editing a registry.
- A check that fails when the worker graph pulls in UI again: a production `next build` that must finish in a time limit, plus starting the built worker in a browser and getting a reply.
- `docs/DEPLOYMENT.md` goes back to the default build command once Turbopack builds; Vercel's build command override is removed.
- D-029 is superseded in `docs/DECISIONS.md` (by `/merge`, from this spec's Decisions).

**Detector lookup.** Each web game folder has a `detector.ts` exporting `loadDetector: DetectorLoader | undefined` (`DetectorLoader = () => Promise<Detector<unknown>>`). It may import only `@tablekeeper/cv/games/<gameId>` (lazily) and types. S4 adds the stubs (`undefined` for the four real games, the cv `_example` loader for `_example`); P2 and H2 then fill in their own file, which their slices already own, so they edit no registry. `apps/web/src/games/detectors.ts` imports the five files and exports `findDetector(id: string)`: a registered game's loader, or `_example`'s outside production builds or when `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true` (the rule S2 put in the worker). The worker imports only `findDetector`. `GameUiModule.detector` is removed; nothing in the UI read it.

**Import guard (`pnpm test`).** `cv-worker-imports.test.ts` walks the worker's module graph with TypeScript's own module resolution (the web `tsconfig.json`, so `@/` paths and workspace packages resolve), following static and dynamic imports and skipping type-only ones, which bundlers erase. It fails, printing the chain, if the graph reaches a `.tsx` file, `react`, `react-dom`, `next`, `games/registry.ts` or `lib/cv-client.ts`. It takes about a second, so it stays in `pnpm test`.

**Production check (`pnpm test:build`).** `scripts/test-build.mjs` runs `next build` for `apps/web` (Turbopack, the default) with `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true` so the `/dev/cv` harness exists, and fails if the build takes longer than 5 minutes. It then runs `tests/e2e/S4.spec.ts` with `tests/build/playwright.config.ts`, which serves the build with `next start` on a free port. The same spec also runs in `pnpm test:e2e` against `next dev`, which covers the dev lookup.

## UI states

None. The spec uses the S2 harness page.

## Acceptance criteria

- [x] `next build` (Turbopack) completes for `apps/web` from a clean clone. *A fresh clone of this branch, `pnpm install --frozen-lockfile`, then `next build` in `apps/web` with no env vars: compiled in 2.4s, whole build 9.2s. Before the change, the same command was still at "Creating an optimized production build" when cut off at 120s.*
- [x] In a production build served with `next start`, the CV worker starts and answers a `stats` message with no page errors. *`pnpm test:build`: build in 8.0s, then `tests/e2e/S4.spec.ts` against `next start` reads the example board correctly, shows 1 worker and 1 opencv load from the worker's `stats` reply, and records no `pageerror`.*
- [x] The `_example` detector still runs in dev and tests through the new lookup. *`tests/e2e/S4.spec.ts` and `S2.spec.ts` pass under `next dev` in `pnpm test:e2e` (26 of 26); `games/detectors.test.ts` loads the detector through `findDetector`.*
- [x] The build check runs in `pnpm test` or CI and fails if the worker imports the UI registry again. *`workers/cv-worker-imports.test.ts` runs in `pnpm test`. With `import { GAME_UI } from '@/games/registry'` put back into the worker it fails and prints chains such as `cv.worker.ts → games/registry.ts → games/_example/index.ts → games/_example/campaign.tsx → react`. With the same import, `pnpm test:build` also fails: from a clean `.next` with "next build didn't finish in 180s" (no build process left running), and over a cached `.next` with a Turbopack panic.*
- [x] Vercel deploys with its default build command. *Verified up to the deploy itself: the clean-clone `next build` above is what Vercel runs from `apps/web`, and `docs/DEPLOYMENT.md` → Vercel now says to use the default. The override is a Vercel dashboard setting, so removing it and redeploying is the owner's step.*

## Tests

- `apps/web/src/workers/cv-worker-imports.test.ts`: the worker graph is UI-free; a control case shows the walker catches the old chain (`games/registry.ts` reaches `lib/cv-client.ts`).
- `apps/web/src/games/detectors.test.ts`: `findDetector` returns `_example` when enabled, `undefined` for games without a detector and unknown ids.
- `tests/e2e/S4.spec.ts`: on `/dev/cv`, read the example board, `stats` reports one opencv load, and no `pageerror` fires. Runs under `next dev` (`pnpm test:e2e`) and `next start` (`pnpm test:build`).

## Out of scope

- Any game's detector (P2, H2).
- Changing the CV pipeline or `cv-client.ts`'s API.
- Turning photo scoring on in production (D-055 waits for a game's detector).

## Open questions

None. Resolved: loaders live in a `detector.ts` beside each web game module (game slices own their folder, the registry imports the stub); the full production build is its own `pnpm test:build` step, and a fast import-graph test in `pnpm test` catches the regression.

## Decisions

- **Supersedes D-029:** the CV worker finds detectors through `findDetector(id)` in `apps/web/src/games/detectors.ts`, which imports each game's `games/<gameId>/detector.ts` (`loadDetector: DetectorLoader | undefined`). `GameUiModule.detector` is gone; nothing in the UI read it. A game's detector slice (P2, H2) fills in its own `detector.ts`, in the folder it already owns, so it edits no registry.
- **Supersedes D-053:** Vercel builds with its default command (Turbopack). The import loop through the worker was the whole cause.
- **`_example` is checked before `isGameId`,** which also accepts the example id when the example game is enabled (D-040). Checking it second made the lookup return nothing for `_example`; the unit test caught it.
- **Two guards.** `cv-worker-imports.test.ts` in `pnpm test` walks the worker's graph with TypeScript's resolution of the web tsconfig (static, re-export and dynamic imports; `import type` skipped, since `verbatimModuleSyntax` keeps every other import) and fails on any `.tsx`, `react`, `react-dom`, `next`, `games/registry.ts` or `lib/cv-client.ts`. `pnpm test:build` makes the real production build (180s limit; a clean build takes about 8s) and runs `tests/e2e/S4.spec.ts` against `next start` with `tests/build/playwright.config.ts`.
- **`pnpm test:build` builds and serves with `NODE_ENV=production`.** `.env.local` sets `NODE_ENV=development` for the API and `loadLocalEnv` passes it on; a build with it fails to prerender `/_global-error`. It sets `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true` so the `/dev/cv` harness exists, and picks the ports before building so the baked-in API URL matches.
- **Photo scoring stays off in production (D-055)** until a game ships a detector; S4 only makes that possible.
- **Shared files edited:** root `package.json` (the new `test:build` line only) and `README.md` → Commands (its line), both listed under Owns. No registry, hub or test config lines changed.

## Shared change requests

- `AGENTS.md` → Definition of done, step 1: add `pnpm test:build` to the command list, so every slice proves the production build still finishes and the CV worker still starts. It takes about 15 seconds.
