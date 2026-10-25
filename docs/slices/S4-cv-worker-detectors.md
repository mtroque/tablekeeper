# S4: CV Worker Detectors Without UI

**Status:** ⬜ · **Depends on:** S2

**Goal:** Photo scoring works in production builds. The CV worker finds detectors without importing the web game UI, so `next build` (Turbopack) finishes and the worker runs in the deployed app.

## The problem

`apps/web/src/workers/cv.worker.ts` looks detectors up through `GAME_UI[gameId].detector` (D-029), so it imports `apps/web/src/games/registry.ts` and with it every game's React components (46 files on `main`). One of them leads back to the worker itself:

`cv.worker.ts` → `games/registry.ts` → `games/_example/index.ts` → `_example/score-flow.tsx` → `components/score-flow/default-score-flow.tsx` → `components/score-flow/capture-step.tsx` → `lib/cv-client.ts` → `new Worker(new URL('../workers/cv.worker.ts', import.meta.url))`

Found on 2026-10-25 during the first Vercel deploy:

- **Turbopack (`next build`, the default):** hangs at "Creating an optimized production build" and never finishes. It reproduces in a clean clone with plain CSS and no PostCSS config. Removing the worker's registry import makes it build in about 2s.
- **Webpack (`next build --webpack`):** builds, but the worker crashes on load in the browser with `ReferenceError: document is not defined`, because UI code runs in the worker scope. Checked by serving the build with `next start` and starting the worker in Chromium.
- **`next dev`** compiles lazily and never hits the loop, so dev and every e2e test (which run against `next dev`) look fine.

**Workaround until this slice is done:** Vercel builds with `next build --webpack` (`docs/DEPLOYMENT.md` → Vercel). Pages work; photo detection doesn't, which on `main` affects no real game yet, since no game ships a detector before P2 and H2.

## Owns

- `apps/web/src/workers/cv.worker.ts`
- A new UI-free detector registry, e.g. `apps/web/src/games/detectors.ts`
- `apps/web/src/games/types.ts` (removing `detector` from `GameUiModule`)
- `apps/web/src/games/_example/` (moving its detector loader)
- `docs/ARCHITECTURE.md` → Game modules and Computer vision (the `detector` contract)
- `docs/DEPLOYMENT.md` → Vercel (removing the webpack workaround)
- A production build check (script or test) and `tests/e2e/S4.spec.ts`

## Scope

Must cover:

- The worker imports nothing that reaches React, `document` or `lib/cv-client.ts`. Detector loaders live in a module the worker can import safely.
- Games stay pre-registered (D-008): game slices add their detector without editing a registry.
- A check that fails when the worker graph pulls in UI again: a production `next build` that must finish in a time limit, plus starting the built worker in a browser and getting a reply.
- `docs/DEPLOYMENT.md` goes back to the default build command once Turbopack builds; Vercel's build command override is removed.
- D-029 is superseded in `docs/DECISIONS.md`.

## Acceptance criteria

- [ ] `next build` (Turbopack) completes for `apps/web` from a clean clone.
- [ ] In a production build served with `next start`, the CV worker starts and answers a `stats` message with no page errors.
- [ ] The `_example` detector still runs in dev and tests through the new lookup.
- [ ] The build check runs in `pnpm test` or CI and fails if the worker imports the UI registry again.
- [ ] Vercel deploys with its default build command.

## Out of scope

- Any game's detector (P2, H2).
- Changing the CV pipeline or `cv-client.ts`'s API.

## Open questions

- Where each game's loader lives without overlapping game slices' ownership: a `detector.ts` beside each web game module (owned by the game slice; the registry imports it) or a pre-registered map importing `@tablekeeper/cv/games/<gameId>` directly. Either way, P2 and H2 need the stub for their game to exist, so S4 should land before they merge.
- Whether the build check belongs in `pnpm test` (slow: a full production build) or a separate `pnpm test:build` step in the definition of done.

## Decisions

## Shared change requests
