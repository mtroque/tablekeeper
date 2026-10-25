# S3: Rules assistant

**Status:** ✅ · **Depends on:** S0

**Goal:** rules answers for every supported game, drawn only from its official rulebook with page citations, behind quotas that keep a public deployment from running up the LLM bill.

## Owns
- `scripts/ingest-rulebook.ts`, `scripts/rules-smoke.ts`, `scripts/lib/` (new files only)
- `supabase/migrations/*_rules_assistant.sql` (new migration)
- `apps/api/src/llm/**`, `apps/api/src/rules/**`, `apps/api/src/{routes,services,db}/{rules,quota}.ts`
- `packages/core/src/contracts/{rules,quota}.ts`
- `apps/web/src/app/games/[gameId]/rules/**`, `apps/web/src/components/{chat-thread,citation-chip,quota-pill}.tsx`
- `tests/e2e/S3.spec.ts`
- Additive wiring (AGENTS.md → Parallel sessions), listed under Decisions.
- The `ingest` and `rules:smoke` entries in the root `package.json` (S0 left them as "not implemented yet" placeholders for this slice), new dependencies, and the regenerated `apps/api/src/db/database.types.ts`.

## Scope
- Everything in `docs/ARCHITECTURE.md` → Rules assistant and → LLM gateway and abuse protection, plus the `rules/ask` and `me/quota` routes (`NOT_FOUND` when a game has no ingested rulebook).
- Rules page per `docs/UX.md` → Rules assistant.
- `pnpm rules:smoke <gameId> "<question>"`: the only path that calls the real API outside the app.
- Ingest and review all four rulebooks (files per `docs/DATA_ASSETS.md`).

**Contracts** (`packages/core/src/contracts`)
- `POST /v1/games/:gameId/rules/ask` body `{ question (1 to 500 chars, trimmed), history? }`; `history` is at most the last 6 turns `{ role: 'user' | 'assistant', content }`. Response `{ answer, notCovered, citations: [{ sectionId, title, printedPages, pdfPage, url }], quota }`.
- `GET /v1/me/quota` → `{ enabled, subject: 'guest' | 'user', limit, used, remaining, resetsAt }`. `quota` in the ask response has the same shape.

**Database** (new migration): SQL functions called by the API's service role, so each step is one statement or one transaction:
- `llm_consume_request(subject_type, subject_key, subject_limit, global_requests, global_tokens)`: increments the subject and global rows for today (UTC) only while under their limits; returns which limit was hit, if any.
- `llm_record_tokens(subject_type, subject_key, input, output)`: adds tokens to the subject and global rows.
- `search_rulebook_sections(rulebook_id, query, limit)`: `websearch_to_tsquery` + `ts_rank` with a `ts_headline` snippet.
- `replace_rulebook(rulebook jsonb, sections jsonb)`: upserts the rulebook row by game and replaces its sections in one transaction (the `--load` step).
- All four are `security definer` with execute granted to `service_role` only.

**Ingestion** (`pnpm ingest <gameId> [--load]`): none of the four PDFs has an outline, so sections come from headings found by font size, with per-game layout settings in `scripts/lib/rulebook-layouts.ts` (heading sizes and levels, columns per PDF page for reading order, pages to skip, and the printed page numbers from each `docs/games/<gameId>.md` → Page numbers). The review file is validated with Zod on `--load`.

**Gateway** (`apps/api/src/llm/gateway.ts`): `gateway.run({ purpose, subject, limits }, (model) => ...)` checks the kill switch, consumes one request from the global and subject quotas, and hands the callback a `model.complete(...)` that records tokens after every call (including failed ones) and enforces the overall timeout. One rules question is one request, however many model calls the agent makes.

**Commands:** `pnpm ingest <gameId>` writes the review file and refuses to overwrite an existing one (which may hold review edits) unless given `--force`; `pnpm ingest <gameId> --load` loads it. `pnpm rules:smoke <gameId> "<question>"` runs one question through the API's own gateway, quotas and service, counted against a guest subject named `rules-smoke`.

## UI states
Beyond `docs/UX.md` → Screen states:
- Asking: the question appears at once, followed by a "Reading the rulebook." placeholder; the input is disabled until the answer arrives.
- Not in the Rulebook: muted answer card that says to check the publisher's FAQ.
- Quota used up: guest sees "No questions left today." with "Sign In with Google" for the larger limit; a signed-in user sees when it resets. The input is disabled.
- Assistant switched off (`LLM_DISABLED`, or `enabled: false` from `/me/quota`): "Rules answers are switched off right now." with the rulebook link.
- No rulebook loaded (`NOT_FOUND`): "This rulebook isn't loaded yet." with the rulebook link.
- Error: the message from the API with "Try Again", which resends the same question.

## Acceptance criteria
- [x] Ingest → review → `--load` works for all four games, and re-running is idempotent. (Manual run: 9, 13, 17 and 10 sections for Patchwork, Azul, Harmonies, Dorfromantik; I reviewed titles, pages and bodies. Loading twice kept the same rulebook ids and the same md5 over every section's title, body, pages and parent. Splitting, page numbers and the review file: `scripts/lib/sections.test.js`.)
- [x] "How does the game end?" gets a cited answer with a working page link for each game. (Manual `pnpm rules:smoke` with the real model, 2026-10-25: all four answered correctly with citations; Azul "End of the game" printed p. 6 → `#page=5`, Harmonies "End of Game" p. 7 → `#page=4`, Dorfromantik p. 5 to 7 → `#page=5`, Patchwork "End of the Game" no printed page → `#page=2`, each matching the page note in `docs/games/<gameId>.md`. Link format: `apps/api/src/routes/rules.test.ts`.)
- [x] An off-topic question returns `notCovered` with no invented rules. (Real model: "What is the capital of France?" for Patchwork and "Can I trade tiles with another player?" for Azul both returned `notCovered: true` and said the rulebook doesn't cover it. With `FakeProvider`: `rules.test.ts`, `agent.test.ts`, e2e.)
- [x] Guest request N+1 gets `QUOTA_EXCEEDED`; the signed-in limit is separate and higher; `LLM_ENABLED=false` shows the disabled state. (`rules.test.ts`: guest limit 2 then 429 with `scope: guest`; the same IP signed in gets its own limit of 4; kill switch gives 503 `LLM_DISABLED` and `/me/quota` reports `enabled: false`; the page's disabled state was checked in screenshots, light and dark.)
- [x] 20 concurrent requests from one subject never exceed its quota. (`rules.test.ts`: exactly 5 of 20 succeed with a limit of 5, and `used` is 5; the full API suite was run 5 times in a row after the lock-order fix.)
- [x] E2E (with `FakeProvider`): ask → cited answer → quota exhausted. (`tests/e2e/S3.spec.ts`, which also covers the "Not in the Rulebook" answer.)

## Tests
- core: contract schemas.
- api unit: agent loop with a scripted `FakeProvider` (citations to unread sections dropped, invalid tool arguments returned to the model as tool errors, tool call limit, dash replacement), page-number mapping and section splitting in `scripts/lib`.
- api integration (local Supabase, `FakeProvider`, test rulebooks under game ids created and removed by the test): ask, `NOT_FOUND`, quotas (guest, user, global, concurrency), kill switch, `/me/quota`.

## Out of scope
Streaming, saved conversations, questions about a score breakdown.

## Open questions
None open. Resolved from the docs:
- Starter questions, rulebook URLs and page-number notes already exist in `packages/core/src/games/*` and `docs/games/*.md`.
- A guest's subject is the salted SHA-256 of `req.ip` (`trust proxy` is on); a signed-in user's is the user id.
- The global budget returns `QUOTA_EXCEEDED` with `details.scope = 'global'`.

## Decisions
- **Migration applied by hand:** worktrees can't run `pnpm db:reset`, so `20261025200000_rules_assistant.sql` was applied to the shared local database with `psql` (not recorded in the migration history). After merging, run `pnpm db:reset` on `main` so it is recorded, then `pnpm ingest <gameId> --load` for each game again (reset empties the rulebook tables).
- **One question is one quota request**, however many model calls it takes; `gateway.run` takes a callback that receives the timed, recorded model, rather than a single message list.
- **No forced tool choice:** current Claude models reject a forced `tool_choice`, so the final `answer` tool is required by the prompt, with `strict: true` tool schemas. If the model replies in text, it gets one reminder; then the reply is "Couldn't find an answer in the rulebook."
- **The tool list never changes within a run.** Claude's thinking blocks are bound to it (changing it returned a 400 in a real run). Past `RULES_MAX_TOOL_CALLS`, tool calls get a tool error and a reminder to answer.
- **An answer citing nothing it read is marked `notCovered`**, so an uncited claim is never shown as "From the Rulebook".
- **Model:** `LLM_MODEL_RULES`, defaulting to `claude-opus-5-5` at medium effort, with the server-side refusal fallback (`fallbacks: 'default'`). A rules question took 4 to 11 seconds and about 7,000 input tokens in the smoke runs; `RULES_MAX_OUTPUT_TOKENS=800` was enough.
- **Usage rows lock global first** in both quota functions, so concurrent requests can't deadlock (a first version did, under the 20 request test).
- **Ingestion splits by heading size**, since none of the four PDFs has an outline. Per-game settings (heading fonts and sizes, columns per page, skipped pages, printed page numbers) live in `scripts/lib/rulebook-layouts.ts`; font ids belong to the exact PDF version, so a new rulebook version needs a review of that file. Text smaller than the body (the score and campaign sheets reproduced in Dorfromantik) is dropped.
- **Review notes:** Patchwork's Setup section reads in diagram order (numbered callouts), Harmonies' End of Game puts the second end condition after a diagram caption, and the Harmonies player aid (PDF page 7) repeats sections in short form. All are readable for the model and were left as extracted.
- **Additive wiring:** `packages/core/src/index.ts` exports `contracts/quota` and `contracts/rules`; `apps/api/src/app.ts` imports `createLlm`, `quotaRouter` and `rulesRouter`, creates the LLM services and mounts both routers.
- **Dependencies:** `@anthropic-ai/sdk` (API); `pdfjs-dist`, `tsx` and `zod` as root dev dependencies for the scripts.
- **Tests reach the API with a forwarded IP** (`x-forwarded-for`, trusted through `trust proxy`) and their own `IP_HASH_SALT`, so every test starts with a fresh guest quota; each removes its usage rows and takes them back off the global row.

## Shared change requests
None.
