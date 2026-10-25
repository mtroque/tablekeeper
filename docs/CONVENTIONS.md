# Tablekeeper: Conventions

Code style and patterns. The hard rules in `AGENTS.md` and the boundaries in `docs/ARCHITECTURE.md` apply on top of these.

## Tooling

- pnpm workspaces; packages `@tablekeeper/{web,api,core,cv}`; Node LTS pinned in `.nvmrc` and `engines`.
- TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, shared `tsconfig.base.json`.
- ESLint (typescript-eslint, react-hooks, import order, restricted paths) + Prettier. No disabled rule without a comment.
- Vitest everywhere, Supertest for the API, Playwright end to end.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Files and folders | kebab-case | `hex-grid-editor.tsx` |
| React components | PascalCase, one per file | `HexGridEditor` |
| Types | PascalCase, no `I` prefix | `PlaySession` |
| Zod schemas | PascalCase + `Schema`, type via `z.infer` | `PlaySessionSchema` |
| Constants | `SCREAMING_SNAKE_CASE` only for true constants | `MAX_TOOL_CALLS` |
| DB tables and columns | snake_case | `state_version` |
| API JSON | camelCase, converted at the db layer | `stateVersion` |
| Unit tests | next to the code, `*.test.ts` | |

Barrel `index.ts` files only at package roots and game-module roots.

## TypeScript

- `type` for data and unions; `interface` for contracts that get implemented (`SessionStore`, `Detector`).
- Narrow `unknown` with Zod. No non-null assertions (`!`) outside tests.
- Discriminated unions with an exhaustive `switch` ending in `assertNever`.
- Functions that can fail in expected ways (parsing, detection) return `{ ok: true, value } | { ok: false, error }`; throw only for programmer errors.

## API (Express 5)

- Per resource: `routes/` (router + `validate({ params, query, body })`) → `services/` (logic) → `db/` (queries). Handlers stay thin.
- Throw `AppError(code, status, message, details?)`; one error middleware formats it. Unknown errors become `INTERNAL` with the request id and are logged.
- Log with `pino` and the request id; never log tokens, photos or rulebook text.
- Only `config.ts` reads `process.env`.

## Web (Next.js App Router)

- Server components for static shells; interactive screens are client components.
- Server data through TanStack Query and `lib/api-client.ts` (query keys like `['sessions', gameId]`); no `fetch` in components.
- Tailwind with the tokens from `docs/UX.md`; no hex colors outside the token file and game modules. shadcn components in `components/ui` are restyled per `docs/UX.md` → Look and voice.
- **Copy lint:** a local ESLint rule (`eslint-rules/ui-copy.js`) checks string literals and JSX text in every package's `src` (tests excluded) and fails on em or en dashes, emoji, and the banned phrases in `docs/UX.md` → Words. User-facing strings include scorer labels and notes in `packages/core` and API error messages.

## Database

- Every change is a new migration (`supabase migration new <name>`); never edit an applied one. Then `pnpm db:reset && pnpm db:types` and commit the generated types.
- RLS policies are named `<table>_<action>_<who>`, e.g. `play_sessions_select_owner`.

## LLM code

- Prompts are exported template functions next to their feature, each with a version constant that changes with the prompt.
- An invalid tool call from the model returns a tool error to the model, never an exception.

## Testing

- Every rule in `docs/games/*.md` has a test named with its id: `it('HAR-TREE-1: leaves on two trunks score 7')`.
- API tests run against local Supabase with `FakeProvider`; each test creates uniquely prefixed data and cleans it up.
- E2E tests use seeded local users, never real Google sign-in.
- CV: geometry unit tests on synthetic images; accuracy through `pnpm eval:cv`.
- Prefer a cheap integration test over mocking your own code.

## Git

- [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`, lowercase imperative summary, no trailing period, header up to 72 characters.
  - Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `style`, `revert`. Breaking changes add `!` (`feat(api)!: …`) and a `BREAKING CHANGE:` footer.
  - Scope: a game id or an area (`core`, `cv`, `api`, `web`, `db`, `rules`, `deps`, `roadmap`).
  - Examples: `feat(harmonies): score side A river`, `fix(api): reset quotas at UTC midnight`, `docs(roadmap): plan X1`.
  - Enforced by commitlint (`@commitlint/config-conventional` plus the scope list) in a commit-msg hook, and across a branch by `pnpm lint:commits`.
- One logical change per commit; a slice's spec is committed before its code.
- Work goes to `main` directly (`/build` in the main checkout) or through worktree branches `worktree-<name>`, merged only by `/merge`.
