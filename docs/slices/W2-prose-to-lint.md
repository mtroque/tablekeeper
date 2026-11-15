# W2: Prose rules become lint rules

**Status:** ⬜ · **Depends on:** W1

**Goal:** The hard rules that today live only in `AGENTS.md` and `docs/CONVENTIONS.md` fail lint instead, with error messages that name the fix, plus a baseline mechanism for rules whose existing violations get cleaned later. See `docs/AUTOMATION.md` → Principles and Enforcement map.

## Owns
- `eslint.config.js`, `eslint-rules/` (new rules and their tests), a baseline file (e.g. `eslint-rules/baseline.json`) and the script that checks it
- The files with existing violations it fixes directly: `packages/core/src/games/_example/index.ts`, `apps/web/src/games/detectors.ts`, `apps/web/src/app/dev/cv/page.tsx`, `apps/web/src/components/corner-editor.tsx`, `apps/web/src/app/layout.tsx`, and any others the new rules find
- `docs/AUTOMATION.md` → Enforcement map (W2 rows), `docs/CONVENTIONS.md` (shorten rules that are now enforced to a pointer)

## Scope (must cover)
- **Only config reads env:** `process.env` allowed only in `apps/api/src/config.ts`, `apps/web/src/lib/env.ts`, scripts and test configs. The example-game flag moves behind `lib/env.ts`, and core stops reading env (take the flag as a parameter, or decide and record).
- **LLM SDK imports** only under `apps/api/src/llm/`.
- **Pure scorers:** in `packages/core/src/games/**`, no `Date`, `Math.random`, `fetch`, `process`, `console`, timers.
- **No `fetch` in `apps/web/src/{components,app,games}`**; allowed in `lib/`.
- **Raw colors:** hex, `rgb()` and `hsl()` literals only in the token file and `games/<gameId>/`; theme colors in `layout.tsx` read from tokens.
- **Game-id branching:** shared code (outside `games/**` and registries) may not compare against a game-id literal.
- **Disable directives need a reason** (`-- why`), and unused ones are errors (`reportUnusedDisableDirectives`).
- Every rule here enforces a rule already written in `AGENTS.md` or `docs/CONVENTIONS.md`, so none waits for a second logged occurrence (`docs/CORRECTIONS.md`). Rules that aren't written down yet don't belong in this slice.
- **Baseline ratchet:** a rule can list existing violations by file and count; lint fails on new ones and when a count goes up, and prints a reminder when it can shrink. Used only where cleanup is bigger than this slice.
- Each error message says what to do instead, in one line, and links the doc section.

## Acceptance criteria
- [ ] Each new rule has a test with a failing and a passing case
- [ ] `pnpm lint` passes on `main` with the baseline (list what's in it, if anything)
- [ ] Adding a new violation of each rule fails lint locally and in CI (show one run)
- [ ] The enforcement map rows for these rules are ✅

## Out of scope
- `useEffect` (W6). Repo-level checks (W3).
- A lint rule against comments that justify workarounds: not seen here yet; log it in `docs/CORRECTIONS.md` as `workaround-comment` if it happens.

## Open questions
- `eslint-plugin-eslint-comments` for directive descriptions, or a few-line local rule? (Prefer local unless the plugin is clearly smaller.)

## Decisions

## Shared change requests
