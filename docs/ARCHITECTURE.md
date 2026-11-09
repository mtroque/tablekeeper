# Tablekeeper: Architecture

## System overview

```
┌───────────────────────────────┐        ┌─────────────────────────────┐
│ apps/web  (Next.js, Vercel)   │  HTTPS │ apps/api  (Express, Render) │
│ - UI (Tailwind + shadcn/ui)   │───────▶│ - verifies Supabase JWT     │
│ - Supabase Auth (Google)      │  JSON  │ - sessions / campaigns      │
│ - CV pipeline in a Web Worker │        │ - rules assistant (agent)   │
│ - guest storage               │        │ - LLM gateway + quotas      │
└───────────────┬───────────────┘        └──────┬───────────────┬──────┘
                │ OAuth                         │ SQL (RLS)     │
                ▼                               ▼               ▼
        ┌────────────────────────────────────────┐    ┌───────────────┐
        │ Supabase: Auth, Postgres (+ full-text) │    │ Anthropic API │
        └────────────────────────────────────────┘    └───────────────┘
```

- **Computer vision runs in the browser:** no per-photo cost, no upload, no rate limiting.
- **The only paid external call is the LLM**, made only by the API, behind quotas.
- **The API is the source of truth for anything saved:** it validates state with each game's schema and recomputes scores with the same `packages/core` code the UI uses.

Hosting is described in `docs/DEPLOYMENT.md`.

## Monorepo (pnpm workspaces)

```
apps/web/src/
  app/                   routes (see docs/UX.md → Routes)
  games/<gameId>/        GameUiModule: Editor, ScoreFlow, Campaign, samples
  games/<gameId>/detector.ts   the game's detector loader for the CV worker (no UI imports)
  games/registry.ts      imports every games/<gameId>/index.ts
  games/detectors.ts     findDetector: imports every games/<gameId>/detector.ts, for the worker
  components/            shared UI (docs/UX.md → Components); components/ui = shadcn
  lib/api-client.ts      typed fetch wrapper built on core contracts
  lib/session-store/     SessionStore: LocalStore (guest) / ApiStore (signed in)
  lib/cv-client.ts       promise API over the CV worker
  workers/cv.worker.ts   runs packages/cv off the main thread
apps/web/public/samples/<gameId>/   sample photos
apps/api/src/
  app.ts / server.ts     express app (no listen) / listen
  config.ts              env parsed with Zod
  middleware/            optionalAuth, requireAuth, validate, rate limit, errors, request id
  routes/ services/ db/  per resource: router → logic → queries
  llm/                   gateway, quota store, providers (Anthropic, Fake)
  rules/                 agent loop, tools, prompt
packages/core/src/
  kit/                   shared types (types.ts), grid/hex geometry, breakdown and state helpers
  games/<gameId>/        definition: schema, scoring (+ tests), layout
  games/registry.ts
  contracts/             Zod schemas for every API request/response and error codes
packages/cv/src/
  pipeline/              generic CV stages
  games/<gameId>/        detector + calibration profile.json
supabase/                migrations, seed.sql, config.toml
scripts/                 ingest-rulebook.ts, eval-vision.ts, dev.mjs, worktrees.sh
data/                    rulebooks/ (gitignored), fixtures/<gameId>/
tests/e2e/               Playwright, one file per slice
```

**Package boundaries** (enforced with ESLint `import/no-restricted-paths`):

```
web ──▶ core, cv      api ──▶ core      cv ──▶ core (types only)      core ──▶ nothing internal
```

- `core` runs in browser, Node and Web Workers: no DOM, no Node built-ins, no I/O; Zod is its only runtime dependency.
- `cv` uses opencv.js and typed arrays; inputs are `ImageData`-compatible.
- `web` and `api` share only `core`.

## Game modules

A game is up to three pieces, each in its own folder and pre-registered, so adding a game never touches shared code.

```ts
// packages/core: pure
interface GameDefinition<State> {
  id: GameId;                       // 'patchwork' | 'azul' | 'harmonies' | 'dorfromantik'
  name: string;
  edition: string;
  rulebook: { publisherUrl: string; sourceKey: string };
  features: { rules: boolean; scorer: boolean; campaign: boolean; photo: boolean };
  rulesStarters: string[];          // starter questions for an empty rules chat
  stateSchema: z.ZodType<State>;
  stateVersion: number;
  upgrade?: (state: unknown, fromVersion: number) => unknown;
  initialState: () => State;
  score?: (state: State) => ScoreBreakdown;
  campaign?: { schema: z.ZodType; initialState: () => unknown };
}

interface ScoreBreakdown {
  total: number;
  categories: Array<{ key: string; label: string; points: number;
                      highlights?: CellRef[]; note?: string }>;
}
type CellRef = { kind: 'square'; row: number; col: number }
             | { kind: 'hex'; q: number; r: number }
             | { kind: 'slot'; group: string; index: number };

// packages/cv
interface Detector<State> { detect(image: ImageInput, opts?: DetectOptions): Promise<Draft<State>> }
interface Draft<State> {
  state: State;
  confidence: ConfidenceMap;        // per cell / field, 0..1
  corners: Quad;                    // user-adjustable
  warnings: string[];
}

// apps/web
interface GameUiModule<State> {
  Motif: React.FC;                           // small SVG drawn from the game's geometry and colors (docs/UX.md → Visuals)
  Editor: React.FC<EditorProps<State>>;      // manual entry and draft review
  Breakdown?: React.FC<BreakdownProps<State>>;
  ScoreFlow?: React.FC<ScoreFlowProps>;      // replaces the default capture → review → result flow
  Campaign?: React.FC;
  samples?: string[];                        // paths under /samples/<gameId>/
}

// apps/web/src/games/<gameId>/detector.ts: imports only @tablekeeper/cv/games/<gameId>, lazily
export const loadDetector: (() => Promise<Detector<unknown>>) | undefined;
```

- Shared code never branches on game id.
- **State versioning:** stored state carries `state_version`; on read it's upgraded with `upgrade` and then parsed with `stateSchema`. Changing a shape means bumping `stateVersion` and adding a tested upgrade step.
- Game rules come only from `docs/games/<gameId>.md`.

## Data model

Game state is JSON validated by the game's schema, so games need no tables of their own.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (= `auth.users.id`), `display_name` | Created by trigger on sign-up |
| `play_sessions` | `id`, `user_id`, `game_id`, `status` (`in_progress`/`completed`), `state` jsonb, `state_version`, `score_total`, `breakdown` jsonb, `detection_meta` jsonb, `campaign_id`, `played_at` | `detection_meta` records which detected values the user corrected |
| `campaigns` | `id`, `user_id`, `game_id`, `state` jsonb, `state_version`, `archived`, `updated_at` | |
| `rulebooks` | `id`, `game_id`, `edition`, `title`, `publisher_url`, `source_version` | |
| `rulebook_sections` | `id`, `rulebook_id`, `ordinal`, `number`, `title`, `parent_id`, `pdf_page_start`, `pdf_page_end`, `printed_pages`, `body`, `search` (generated tsvector, GIN) | PDF pages are for links; `printed_pages` (text, nullable, e.g. "4" or "4 and 5") is the page number printed in the rulebook, null when none is printed. A printed page and a PDF page don't map one to one (a PDF page can hold a two-page spread), so both are stored per section |
| `llm_usage` | `subject_type` (`user`/`ip`/`global`), `subject_key`, `day`, `requests`, `input_tokens`, `output_tokens` | Unique per subject per UTC day; IPs stored as salted hashes |

**RLS** is on for every table. Users can read and write only their own `profiles`, `play_sessions`, `campaigns`; the other tables have no user policies and are reached only by the API's service role.

## API

REST under `/v1`, JSON. Every request and response is a Zod schema in `packages/core/src/contracts`; the API validates with them and the web client is typed from them.

| Method and path | Auth | Purpose |
|---|---|---|
| `GET /health` | - | Liveness; keep-alive target |
| `GET /v1/games` | - | Registry summary |
| `GET /v1/me` | required | Profile |
| `GET /v1/me/quota` | optional | Rules questions left today |
| `POST /v1/games/:gameId/rules/ask` | optional | Rules assistant |
| `GET /v1/sessions?gameId=&cursor=` | required | History, newest first, with personal best and average |
| `POST /v1/sessions` | required | Save; the server validates state and recomputes the score |
| `GET` / `PATCH /v1/sessions/:id` | required | Read; update status/state (recomputed) |
| `GET` / `PUT /v1/campaigns/:gameId` | required | Active campaign |
| `POST /v1/campaigns/:gameId/new` | required | Archive the active campaign and start a new one, in one transaction |

- **Errors:** `{ "error": { "code", "message", "details"? } }` with a matching status. Codes: `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `QUOTA_EXCEEDED`, `LLM_DISABLED`, `RATE_LIMITED`, `INTERNAL`.
- **Auth:** `Authorization: Bearer <Supabase access token>`, verified by middleware. Database calls use a per-request client carrying that token, so RLS applies.
- **CORS:** configured web origins only. `trust proxy` is on (Render).
- **History:** 20 per page, newest first (`played_at`, then `id`); the cursor is opaque base64 of the last row's `played_at` and `id`. `best` and `average` cover all the user's completed sessions of that game.
- **Saving:** an unknown game is `NOT_FOUND`; a game without a scorer is 422 `VALIDATION`. State is parsed with `parseState` (upgrade, then validate), and a client-sent `scoreTotal` or `breakdown` is stripped (D-038). `detection_meta` holds the state paths that differ between the photo draft and the saved board and the number of detected values (D-037).
- **Rules:** `ask` takes `{ question (1 to 500 chars, trimmed), history? }` (at most the last 6 turns) and returns `{ answer, notCovered, citations, quota }`; `NOT_FOUND` when the game has no ingested rulebook. `quota` and `GET /v1/me/quota` are `{ enabled, subject: 'guest' | 'user', limit, used, remaining, resetsAt }`. The global budget answers `QUOTA_EXCEEDED` with `details.scope = 'global'`.

## Client state and storage

- The UI persists only through `SessionStore` (`list`, `get`, `save`, `getCampaign`, `saveCampaign`, `startCampaign`): `LocalStore` (localStorage, keys `tk:v1:*`) for guests, `ApiStore` when signed in. Components never know which.
- Guest data stays on the device; it is not imported on sign-in. The one exception: a result being saved when a guest signs in is kept in `sessionStorage` through the OAuth redirect and saved to the account.
- The in-progress score flow (photo, corners, draft, edits) is kept in `sessionStorage`, so refreshes and the sign-in redirect don't lose it.

## Rules assistant

**Ingestion** (`pnpm ingest <gameId>`, run locally):
1. Extract text per page from `data/rulebooks/<gameId>.pdf`, recording the PDF page each piece of text comes from.
2. Split into sections by heading size (none of the four PDFs has an outline), with per-game settings in `scripts/lib/rulebook-layouts.ts`: heading fonts and sizes, columns per page for reading order, skipped pages (D-035). Keep parent/child structure. Each section gets `pdf_page_start` and `pdf_page_end`, and `printed_pages` filled from the page-numbers note in `docs/games/<gameId>.md`.
3. Write `data/rulebooks/<gameId>.sections.json` (gitignored) for a human to review; the reviewer can correct any section's pages there. An existing review file is never overwritten without `--force`.
4. `pnpm ingest <gameId> --load` validates the review file and replaces that rulebook's sections in one transaction (`replace_rulebook`, idempotent).

`pnpm rules:smoke <gameId> "<question>"` runs one question through the API's own gateway, quotas and service (as a guest subject named `rules-smoke`); it's the only real model call outside the app.

**Answering** (`apps/api/src/rules`): an agent loop scoped to one rulebook, with tools whose arguments are validated with Zod:

| Tool | Returns |
|---|---|
| `list_sections()` | `[{ id, number, title, printedPages, pdfPages }]` |
| `read_section({ id })` | `{ id, title, printedPages, pdfPages, body }` |
| `search_rulebook({ query })` | top 5 by `ts_rank` (`websearch_to_tsquery`), each `{ id, title, printedPages, pdfPages, snippet }` |

- The final answer comes through an `answer` tool, `{ answer, citedSectionIds, notCovered }`, required by the prompt rather than a forced `tool_choice` (D-031). A text reply gets one reminder, then "Couldn't find an answer in the rulebook." An answer citing nothing it read is `notCovered` (D-032). Citations to sections the agent didn't read in this run are dropped; the rest become `{ sectionId, title, printedPages, pdfPage, url }`: `printedPages` is the section's `printed_pages` (null when none is printed), `pdfPage` its `pdf_page_start`, and `url` the publisher PDF plus `#page=<pdfPage>`.
- The system prompt is versioned: answer only from this rulebook, read before answering, cite what was used, set `notCovered` when the rulebook doesn't settle it, never invent rules, answer in the question's language, keep it short, and write plainly per `docs/UX.md` → Words (no dashes, no preamble such as "Great question", no sign-off). As a backstop the service replaces any em or en dash in the answer with a comma or "to" before returning it.
- Limits: `RULES_MAX_TOOL_CALLS` tool calls, `RULES_MAX_OUTPUT_TOKENS`, 30s overall, questions up to 500 characters, the last 6 turns as context. Conversations are not stored.

## LLM gateway and abuse protection

Every model call goes through `gateway.run({ purpose, subject, limits }, (model) => ...)`, which runs the checks below once and hands the callback a `model.complete(...)` that records tokens after every call and enforces the overall timeout. One rules question is one request, however many model calls it takes (D-030).

1. **Kill switch:** `LLM_ENABLED=false` → `LLM_DISABLED`.
2. **Global daily budget:** `LLM_GLOBAL_DAILY_REQUESTS`, `LLM_GLOBAL_DAILY_TOKENS`.
3. **Per-subject daily quota:** user id (`LLM_USER_DAILY_REQUESTS`) or salted SHA-256 of `req.ip` (`LLM_GUEST_DAILY_REQUESTS`). The check-and-increment is one SQL function (`llm_consume_request`, locking the global row first, D-034), so concurrent requests can't overshoot.
4. **Burst limit:** `express-rate-limit` on all `/v1` routes.
5. **Usage recorded** in `llm_usage` after every call, including failures (`llm_record_tokens`).

The SQL functions (these two, `search_rulebook_sections` and `replace_rulebook`) are `security definer`, executable by the service role only.

Outside the app, the Anthropic account has a monthly spend limit. Providers: `AnthropicProvider` (model from `LLM_MODEL_RULES`) and `FakeProvider` (scripted, used by all tests and selectable with `LLM_PROVIDER=fake`).

## Computer vision

`packages/cv` wraps opencv.js (`@techstark/opencv-js`, pinned). In the browser it runs only inside `cv.worker.ts` (opencv loads once, lazily, only on photo pages); in Node it runs for tests and `pnpm eval:cv`. opencv is never imported statically: cv takes a loader (D-025). Mat stages delete everything they allocate and the caller deletes what it receives; `sampleCells` copies cell pixels into typed arrays, so features, classification and calibration are plain TypeScript (D-027). `pipeline/leaks.test.ts` checks that no `Mat` outlives a stage or a full read.

| Stage | Function | Notes |
|---|---|---|
| Load | `loadImage(input, { maxSide: 1600 })` | EXIF orientation, downscale |
| Find board | `findBoardQuad(mat, opts)` | blur → Canny → largest convex 4-gon within the game's aspect bounds; `{ quad, confidence }`; centered fallback + warning |
| Order | `orderQuad(points)` | TL, TR, BR, BL |
| Warp | `warpToCanonical(mat, quad, size)` | perspective transform to the game's canonical size |
| Normalize | `normalizeLighting(mat)` | gray-world white balance, CLAHE on LAB lightness |
| Sample | `sampleCells(mat, layout, { inset })` | layout = cell polygons in canonical coordinates; samples only the inset to skip grid lines and neighbors |
| Features | `cellFeatures(region)` | LAB mean and spread, edge density, optional hue histogram |
| Classify | `classifyNearest(features, profile, { tolerance })` | nearest calibrated class by spread-scaled distance; confidence is the margin to the runner-up times a falloff once the distance passes the tolerance; never exact matching |
| Blobs | `findBlobs(mat, mask, opts)` | tokens beside a board: area, circularity, rotated rect |
| Match | `matchTemplateRotInvariant(crop, refs)` | rotation-invariant comparison against reference crops |

- **Calibration profiles** (`games/<gameId>/profile.json`) hold per-class feature centroids, spreads and tolerance, built from labeled fixtures by `pnpm eval:cv <gameId> --calibrate`. A game whose calibration doesn't fit a profile gives its `CvGame` a `calibrate` instead: the eval passes it the photos in `data/fixtures/<gameId>/references/` and the labeled fixtures, writes the JSON files it returns into `games/<gameId>/`, and evaluates the game it returns.
- **`CvGame`:** each `packages/cv/src/games/<gameId>/index.ts` exports a `cvGame` (detector, label schema, expected class per cell, calibration inputs). The eval loads it by path, so there is no cv registry; `packages/cv/package.json` exports `./games/*` for the web detector loaders.
- **Detector lookup:** the worker calls `findDetector(id)` (`apps/web/src/games/detectors.ts`), which gathers each game's `detector.ts` loader, plus the `_example` detector outside production builds or when `NEXT_PUBLIC_ENABLE_EXAMPLE_GAME=true`. The worker's module graph must never reach React, the DOM, the game UI registry or `cv-client.ts`: the chain `cv.worker.ts` → `games/registry.ts` → a game's React UI → `cv-client.ts` → `new Worker(...)` hung Turbopack's production build and crashed the webpack build's worker on `document`, while `next dev` looked fine (D-058). `apps/web/src/workers/cv-worker-imports.test.ts` guards it in `pnpm test`, and `pnpm test:build` builds for production and starts the worker.
- **Worker API** (`cv-client.ts`): `detectBoard(gameId, image, corners?, { hints? }) => Promise<Result<Draft>>`, with progress events (`loading-opencv`, `finding-board`, `classifying`). One worker per page session; the 20s timeout restarts on every progress event and terminates the worker (D-028). No `Worker` or no detector is `unavailable`, a timeout `timeout`, a worker error or abort `failed`. `hints` reach the detector as `DetectOptions.hints`, a game-specific reading hint the detector validates. On review, `ReviewStep` gives the Editor `reread(hints)` when the flow has a photo and corners: it reads the photo again at those corners and replaces the board, draft and warnings, resolving false when the reading fails.
- **Evaluation** (`pnpm eval:cv <gameId>`): runs the detector on `data/fixtures/<gameId>` and reports board-found rate, corner error (the worst corner's distance over the board's longer side), per-cell accuracy, confusion matrix, the share of errors flagged low-confidence (below 0.6, `LOW_CONFIDENCE`), and timing; writes `eval-report.md` (gitignored) and fails below the fixture set's `accuracyThreshold`.
- **`_example`:** a synthetic 3×3 board for the S1 example game, rendered by `scripts/make-example-fixtures.ts` (24 seeded photos with rotation, skew, tints and noise); the `/dev/cv` harness page reads one with the real worker.
