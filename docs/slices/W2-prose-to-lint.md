# W2: Prose rules become lint rules

**Status:** ✅ · **Depends on:** W1

**Goal:** The hard rules that today live only in `AGENTS.md` and `docs/CONVENTIONS.md` fail lint instead, with error messages that name the fix, plus a baseline mechanism for rules whose existing violations get cleaned later. See `docs/AUTOMATION.md` → Principles and Enforcement map.

## Owns
- `eslint.config.js`, `eslint-rules/` (new rules and their tests, `baseline.json`, `baseline.js`, `baseline.test.js`), `package.json` (`lint` script)
- The files with existing violations it fixes directly: `packages/core/src/games/_example/index.ts`, `packages/core/src/games/_example/index.test.ts`, `apps/api/src/config.ts`, `apps/web/src/lib/env.ts`, `apps/web/src/games/registry.ts`, `apps/web/src/games/detectors.ts`, `apps/web/src/app/dev/cv/page.tsx`, `apps/web/src/app/dev/cv/cv-harness.tsx`, `apps/web/src/app/games/[gameId]/game.ts`, `apps/web/src/components/providers.tsx`, `apps/web/src/components/corner-editor.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/lib/tokens.ts`, `apps/web/src/lib/cv-client.ts`, `apps/web/src/app/globals.css`, `apps/web/src/components/ui/sheet.tsx`, `apps/web/src/components/ui/dialog.tsx`, `apps/web/src/components/ui/sonner.tsx`, `apps/web/src/lib/session-store/session-store.test.ts`, `apps/web/src/components/score-flow/reread.test.ts`
- `docs/AUTOMATION.md` → Enforcement map (W2 rows), `docs/CONVENTIONS.md` (shorten rules that are now enforced to a pointer), `docs/CORRECTIONS.md` (status updates on `main`)

## Scope
- **Only config reads env** (`rules/no-env-outside-config` in `eslint-rules/rules.js`): `process.env` allowed only in `apps/api/src/config.ts`, `apps/web/src/lib/env.ts`, `scripts/**`, test configs (`vitest.config.ts`, `playwright.config.ts`), and tests. `apps/web/src/lib/env.ts` exports `isExampleGameEnabled()` (true outside production or when `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true`), used by `apps/web/src/games/detectors.ts` and `apps/web/src/app/dev/cv/page.tsx`. In `packages/core`, `enableExampleGame(enabled = true)` sets a module flag in `packages/core/src/games/_example/index.ts` (called by `apps/api/src/config.ts`, `apps/web/src/games/registry.ts`, and core/web unit tests), so `core` never touches `process`.
- **LLM SDK imports:** `@typescript-eslint/no-restricted-imports` in `eslint.config.js` forbids `@anthropic-ai/sdk` outside `apps/api/src/llm/**`, pointing to `apps/api/src/llm/gateway.ts`.
- **Pure scorers:** `no-restricted-globals` and `no-restricted-properties` (`Math.random`) in `packages/core/src/games/**` (excluding tests) forbid `Date`, `Math.random`, `fetch`, `process`, `console`, `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `queueMicrotask`, and `requestAnimationFrame`.
- **No `fetch` in web UI:** `no-restricted-globals` and `no-restricted-properties` in `apps/web/src/{components,app,games}/**` (excluding tests) forbid `fetch`, `window.fetch`, and `globalThis.fetch`, pointing to `apps/web/src/lib/api-client.ts` or `apps/web/src/lib/`. `cv-harness.tsx` uses `imageInputFromUrl` in `lib/cv-client.ts` to load its sample image.
- **Raw colors** (`rules/no-raw-colors`): hex (`#rgb`, `#rrggbb`, `#rrggbbaa`), `rgb()`/`rgba()`, and `hsl()`/`hsla()` literals are forbidden in `apps/web/src/**` outside `apps/web/src/lib/tokens.ts` and `apps/web/src/games/**` (and tests). `apps/web/src/lib/tokens.ts` exports `THEME_COLORS` read by `apps/web/src/app/layout.tsx`, and `globals.css` defines `--shadow-float` and `--shadow-sheet` used by `sheet.tsx`, `dialog.tsx`, and `sonner.tsx`.
- **Game-id branching** (`rules/no-game-id-branching`): shared code in `apps/*/src/**` and `packages/*/src/**` outside `**/games/**`, `**/contracts/games.ts`, `**/kit/types.ts`, and tests may not compare (`===`, `!==`, `==`, `!=`, `switch`/`case`) against a game-id literal (`'patchwork'`, `'azul'`, `'harmonies'`, `'dorfromantik'`, `'_example'`).
- **Disable directives need a reason** (`rules/require-disable-reason` + `linterOptions.reportUnusedDisableDirectives: 'error'`): every `eslint-disable*` comment must include `-- <reason>`, and unused disable directives are errors. Fixed in `apps/web/src/components/corner-editor.tsx`.
- **Baseline ratchet** (`eslint-rules/baseline.js` + `eslint-rules/baseline.json`): `pnpm lint` runs `node eslint-rules/baseline.js && prettier --check .`, which runs ESLint across `.`, compares any baselined rule's per-file violation count against `eslint-rules/baseline.json`, fails on any unbaselined error or count increase, and prints a reminder when a baselined file's count has dropped below the recorded count. Since all existing violations in W2 are small and fixed directly, `eslint-rules/baseline.json` starts empty (`{}`).
- **Error messages:** every new rule's message names what to do instead in one line and cites the doc section.

## UI states
None.

## Acceptance criteria
- [x] Each new rule has a test with a failing and a passing case: `eslint-rules/rules.test.js` (26 tests covering `no-env-outside-config`, `no-raw-colors`, `no-game-id-branching`, `require-disable-reason`, `@anthropic-ai/sdk` restriction, pure scorers in `packages/core/src/games/`, `fetch` ban in `apps/web/src/{components,app,games}/`, and `reportUnusedDisableDirectives`) and `eslint-rules/baseline.test.js` (4 tests for the baseline ratchet).
- [x] `pnpm lint` passes on `main` with the baseline (`eslint-rules/baseline.json` is `{}`: all existing violations were fixed directly). Passed locally and in CI on `main` ([run 43830726517](https://github.com/mtroque/tablekeeper/actions/runs/43830726517)).
- [x] Adding a new violation of each rule fails lint locally and in CI (show one run): verified on temporary PR `#2` (`test/w2-violations`, closed and branch deleted), where a commit introducing one violation of every W2 rule (`@anthropic-ai/sdk` import in `rules.ts`, `process.env` in `rules.ts`, `'patchwork' === ...` in `rules.ts`, `Date.now()` and `Math.random()` in `packages/core/src/games/patchwork/index.ts`, `eslint-disable-next-line` without `-- reason` and unused `eslint-disable-next-line`, `fetch(...)`, and `'#ff00ff'` in `game-card.tsx`) failed `pnpm lint` locally with all 10 errors and failed the `Lint` step in CI in 58s ([run 43830969143](https://github.com/mtroque/tablekeeper/actions/runs/43830969143)).
- [x] The enforcement map rows for these rules are ✅ (`docs/AUTOMATION.md` → Enforcement map).

## Tests
Unit tests in `eslint-rules/rules.test.js` and `eslint-rules/baseline.test.js` covering passing and failing cases for every new rule and the baseline ratchet (pass at baseline, fail on new violation or count increase, remind when count shrinks).

## Out of scope
- `useEffect` (W6). Repo-level checks (W3).
- A lint rule against comments that justify workarounds: not seen here yet; log it in `docs/CORRECTIONS.md` as `workaround-comment` if it happens.

## Open questions
Resolved:
- Local rule (`rules/require-disable-reason` in `eslint-rules/rules.js`) over `eslint-plugin-eslint-comments`: ~25 lines, zero new dependencies.

## Decisions
- **D-040 (updated):** `packages/core` no longer reads `process.env`; instead `enableExampleGame(true)` in `packages/core/src/games/_example/index.ts` is called by `apps/api/src/config.ts` (in test mode or when `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true`), by `apps/web/src/games/registry.ts` (via `isExampleGameEnabled()` in `apps/web/src/lib/env.ts`), and by unit tests that exercise `_example`.
- **D-080:** Prose rules in `AGENTS.md` and `docs/CONVENTIONS.md` are enforced in ESLint (`eslint-rules/rules.js` and `eslint.config.js`), and `pnpm lint` runs through `eslint-rules/baseline.js` (`eslint-rules/baseline.json`, currently `{}`) so future rules with larger existing backlogs can land as errors for new code while their baseline only shrinks.

## Corrections
None.

## Shared change requests
None.
