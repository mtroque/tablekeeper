# W2: Prose rules become lint rules

**Status:** 🟨 · **Depends on:** W1

**Goal:** The hard rules that today live only in `AGENTS.md` and `docs/CONVENTIONS.md` fail lint instead, with error messages that name the fix, plus a baseline mechanism for rules whose existing violations get cleaned later. See `docs/AUTOMATION.md` → Principles and Enforcement map.

## Owns
- `eslint.config.js`, `eslint-rules/` (new rules and their tests, `baseline.json`, `baseline.js`, `baseline.test.js`), `package.json` (`lint` script)
- The files with existing violations it fixes directly: `packages/core/src/games/_example/index.ts`, `packages/core/src/games/_example/index.test.ts`, `packages/core/src/games/registry.ts`, `apps/web/src/lib/env.ts`, `apps/web/src/games/registry.ts`, `apps/web/src/games/detectors.ts`, `apps/web/src/app/dev/cv/page.tsx`, `apps/web/src/app/dev/cv/cv-harness.tsx`, `apps/web/src/components/corner-editor.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/lib/tokens.ts`, `apps/web/src/app/globals.css`, `apps/web/src/components/ui/sheet.tsx`, `apps/web/src/components/ui/dialog.tsx`, `apps/web/src/components/ui/sonner.tsx`
- `docs/AUTOMATION.md` → Enforcement map (W2 rows), `docs/CONVENTIONS.md` (shorten rules that are now enforced to a pointer), `docs/CORRECTIONS.md` (status updates on `main`)

## Scope
- **Only config reads env** (`rules/no-env-outside-config` in `eslint-rules/rules.js`): `process.env` allowed only in `apps/api/src/config.ts`, `apps/web/src/lib/env.ts`, `scripts/**`, test configs (`vitest.config.ts`, `playwright.config.ts`), and tests. `apps/web/src/lib/env.ts` exports `isExampleGameEnabled()` (true outside production or when `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true`), used by `apps/web/src/games/detectors.ts` and `apps/web/src/app/dev/cv/page.tsx`. In `packages/core`, `enableExampleGame(enabled = true)` sets a module flag in `packages/core/src/games/_example/index.ts` (called by `vitest.config.ts` and by `apps/web/src/games/registry.ts` when `isExampleGameEnabled()` is true), so `core` never touches `process`.
- **LLM SDK imports:** `@typescript-eslint/no-restricted-imports` in `eslint.config.js` forbids `@anthropic-ai/sdk` outside `apps/api/src/llm/**`, pointing to `apps/api/src/llm/gateway.ts`.
- **Pure scorers:** `no-restricted-globals` and `no-restricted-properties` (`Math.random`) in `packages/core/src/games/**` (excluding tests) forbid `Date`, `Math.random`, `fetch`, `process`, `console`, `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `queueMicrotask`, and `requestAnimationFrame`.
- **No `fetch` in web UI:** `no-restricted-globals` in `apps/web/src/{components,app,games}/**` (excluding tests) forbids `fetch` and `window.fetch`, pointing to `apps/web/src/lib/api-client.ts` or `lib/cv-client.ts`. `cv-harness.tsx` uses a helper in `lib/cv-client.ts` to load a sample URL into an `ImageInput`.
- **Raw colors** (`rules/no-raw-colors`): hex (`#rgb`, `#rrggbb`, `#rrggbbaa`), `rgb()`/`rgba()`, and `hsl()`/`hsla()` literals are forbidden in `apps/web/src/**` outside `apps/web/src/lib/tokens.ts` and `apps/web/src/games/**` (and tests). `apps/web/src/lib/tokens.ts` exports `THEME_COLORS` read by `apps/web/src/app/layout.tsx`, and `globals.css` defines `--shadow-float` used by `sheet.tsx`, `dialog.tsx`, and `sonner.tsx`.
- **Game-id branching** (`rules/no-game-id-branching`): shared code in `apps/*/src/**` and `packages/*/src/**` outside `**/games/**`, `**/contracts/games.ts`, `**/kit/types.ts`, and tests may not compare (`===`, `!==`, `==`, `!=`, `switch`/`case`) against a game-id literal (`'patchwork'`, `'azul'`, `'harmonies'`, `'dorfromantik'`, `'_example'`).
- **Disable directives need a reason** (`rules/require-disable-reason` + `linterOptions.reportUnusedDisableDirectives: 'error'`): every `eslint-disable*` comment must include `-- <reason>`, and unused disable directives are errors. Fixed in `apps/web/src/components/corner-editor.tsx`.
- **Baseline ratchet** (`eslint-rules/baseline.js` + `eslint-rules/baseline.json`): `pnpm lint` runs `node eslint-rules/baseline.js && prettier --check .`, which runs ESLint across `.`, compares any baselined rule's per-file violation count against `eslint-rules/baseline.json`, fails on any unbaselined error or count increase, and prints a reminder when a baselined file's count has dropped below the recorded count. Since all existing violations in W2 are small and fixed directly, `eslint-rules/baseline.json` starts empty (`{}`).
- **Error messages:** every new rule's message names what to do instead in one line and cites the doc section.

## UI states
None.

## Acceptance criteria
- [ ] Each new rule has a test with a failing and a passing case
- [ ] `pnpm lint` passes on `main` with the baseline (list what's in it, if anything)
- [ ] Adding a new violation of each rule fails lint locally and in CI (show one run)
- [ ] The enforcement map rows for these rules are ✅

## Tests
Unit tests in `eslint-rules/rules.test.js` and `eslint-rules/baseline.test.js` covering passing and failing cases for every new rule and the baseline ratchet (pass at baseline, fail on new violation or count increase, remind when count shrinks).

## Out of scope
- `useEffect` (W6). Repo-level checks (W3).
- A lint rule against comments that justify workarounds: not seen here yet; log it in `docs/CORRECTIONS.md` as `workaround-comment` if it happens.

## Open questions
Resolved:
- Local rule (`rules/require-disable-reason` in `eslint-rules/rules.js`) over `eslint-plugin-eslint-comments`: ~25 lines, zero new dependencies.

## Decisions

## Corrections

## Shared change requests
None.
