# AGENTS.md

Instructions for coding agents in this repo.

Tablekeeper is a phone companion for physical board games: rules answers cited from the official rulebook, board scoring from a photo that the player confirms, and a history of plays and campaigns.

## Docs: one home per fact

Read the first five before any work. Put each fact in its home and link to it from elsewhere; don't restate it.

| Doc | Owns |
|---|---|
| `docs/PRODUCT.md` | What the app does and for whom; scope |
| `docs/ARCHITECTURE.md` | System design: packages, interfaces, data model, API, rules assistant, LLM limits, CV pipeline |
| `docs/UX.md` | Screens, routes, states, interactions, design tokens |
| `docs/CONVENTIONS.md` | Code style and patterns |
| `docs/ROADMAP.md` | Slices, dependencies, status on `main`, priority |
| `docs/slices/<id>-*.md` | One slice: what it owns, slice-specific scope, acceptance criteria, live status |
| `docs/games/<gameId>.md` | A game's rules (with ids), board coordinates, state shape, official rulebook URL |
| `docs/DATA_ASSETS.md` | Rulebooks, fixtures, photo guidelines, label formats |
| `docs/DEPLOYMENT.md` | Hosting setup |
| `docs/DECISIONS.md` | Why things are the way they are |
| `README.md` | Setup and every `pnpm` command |

## Workflow

Work is built in **slices**: one feature end to end (database, core logic, API, UI, tests). Never build all of one layer first.

1. **Check dependencies:** each must be ✅ in `docs/ROADMAP.md`, or ✅ in its own spec earlier on this branch.
2. **Spec:** if the slice's spec is a stub, expand it from `docs/slices/_TEMPLATE.md`, resolving open questions from the docs. Commit it alone (`docs(<scope>): spec <id>`). Set its status to 🟨.
3. **Build in this order**, editing only what the spec owns:
   1. Migration (if any) → `pnpm db:reset` → `pnpm db:types`
   2. Core logic in `packages/core` / `packages/cv` with unit tests
   3. Contracts in `packages/core/src/contracts`
   4. API routes with integration tests
   5. UI
   6. One Playwright test of the main flow, `tests/e2e/<id>.spec.ts`
4. **Commit** small Conventional Commits as you go.
5. **Finish** by meeting the definition of done below.

**Stop and ask** (after finishing whatever else you can, with the spec set to ⏸ and the reason written in it) only when a rule the slice needs is marked ⚠️ or VERIFY in `docs/games/`, required assets are missing (`docs/DATA_ASSETS.md`), or a needed shared change blocks all remaining work. Never guess game rules.

## Definition of done

1. `pnpm typecheck && pnpm lint && pnpm lint:commits && pnpm test && pnpm test:e2e` pass. Fix what this slice broke; report anything else.
2. Every acceptance criterion in the spec is checked, each one actually verified (test, script output, or a manual run you describe).
3. Every screen state from the spec and `docs/UX.md` → Screen states is implemented, and all UI text and visuals follow `docs/UX.md` → Look and voice (no em or en dashes, no emoji, no AI-template styling).
4. A measurable target that can't be reached (e.g. CV accuracy) doesn't block done if the feature still works end to end: record the numbers and the gap in the spec.
5. The spec's `**Status:**` is ✅ and its `## Decisions` lists anything worth remembering.
6. **Shared docs** (`docs/ROADMAP.md` status, `docs/DECISIONS.md`): update them now if you're on `main`; on any other branch leave them alone, and `/merge` updates them.
7. Every commit follows Conventional Commits (`docs/CONVENTIONS.md` → Git). The commit-msg hook rejects bad messages; `pnpm lint:commits` checks the whole branch. Reword any that slipped through before finishing.
8. Final commit `docs(<scope>): finish <id>`, then report what was built, how it was verified, and what's left.

## Parallel sessions

Parallel work runs in Claude Code worktrees (`claude --worktree <name>`: `.claude/worktrees/<name>/`, branch `worktree-<name>`, from local `main`; gitignored files in `.worktreeinclude` are copied in). Use `/parallel` to start them and `/merge` to bring them back.

- **Ownership:** a slice edits only what its spec lists under `## Owns`; slices running at the same time never overlap. A game slice owns that game's folders: `{packages/core,packages/cv,apps/web}/src/games/<gameId>/`, `docs/games/<gameId>.md`, `data/fixtures/<gameId>/`, `apps/web/public/samples/<gameId>/`, plus its spec and tests. Games are pre-registered, so game slices never edit registries; other slices may add registry entries as additive wiring.
- **Shared code** (anything you don't own): write the change you need under `## Shared change requests` in your spec (what, where, why) and carry on with the rest. To apply requests, a session on `main` implements them with tests, commits `feat(<area>): <change> (requested by <id>)`, and runs `scripts/worktrees.sh sync`.
- **Additive wiring:** a slice may add lines to shared hub files to connect its own code: export lines in `packages/core/src/index.ts` and `packages/cv/src/index.ts`, route mounts in `apps/api/src/app.ts`, entries in the game registries, a call to its own function from an existing page or hook, and env flags in test configs. It may not change or remove existing lines, and `packages/core/src/kit/types.ts` stays frozen. List each wiring edit in the spec's `## Decisions`. When `/merge` hits a conflict in these lines, it keeps both sides.
- **Database:** one local Supabase for all worktrees, started from the main checkout. Never run `pnpm db:start`, `db:reset` or `supabase stop` from a worktree. Prefix test data with your slice's area (e.g. the game id).
- **Ports** are picked automatically by `pnpm dev` and `pnpm test:e2e`; never hard-code them.

## Hard rules

- TypeScript `strict`; no `any`; no `@ts-ignore` without a comment saying why.
- Validate every external input with Zod: request bodies and params, env vars, LLM tool arguments, stored JSON.
- Scorers are pure functions in `packages/core`. The API recomputes scores; never trust a client-sent score.
- Every LLM call goes through `apps/api/src/llm/gateway.ts`.
- Every detected value is a draft with a confidence that the user can override.
- Never commit secrets, `.env*` (except `.env.example`), rulebook PDFs or extracted rulebook text, or photos over 2MB.
- Don't add a dependency when a few lines will do; justify new ones in the commit message.
