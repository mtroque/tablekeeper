# S3: Rules assistant

**Status:** 🟨 · **Depends on:** S0

**Goal:** rules answers for every supported game, drawn only from its official rulebook with page citations, behind quotas that keep a public deployment from running up the LLM bill.

## Owns
- `scripts/ingest-rulebook.ts`, `scripts/rules-smoke.ts`, `scripts/lib/` (new files only)
- `supabase/migrations/*_rules_assistant.sql` (new migration)
- `apps/api/src/llm/**`, `apps/api/src/rules/**`, `apps/api/src/{routes,services,db}/{rules,quota}.ts`
- `packages/core/src/contracts/{rules,quota}.ts`
- `apps/web/src/app/games/[gameId]/rules/**`, `apps/web/src/components/{chat-thread,citation-chip,quota-pill}.tsx`
- `tests/e2e/S3.spec.ts`
- Wiring, additions only (see Shared change requests): two export lines in `packages/core/src/index.ts`, two router lines in `apps/api/src/app.ts`, the `ingest` / `rules:smoke` scripts and new dev dependencies in the root `package.json`, `@anthropic-ai/sdk` in `apps/api/package.json`, the regenerated `apps/api/src/db/database.types.ts`.

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

## UI states
Beyond `docs/UX.md` → Screen states:
- Asking: the question appears at once, followed by a "Reading the rulebook." placeholder; the input is disabled until the answer arrives.
- Not in the Rulebook: muted answer card that says to check the publisher's FAQ.
- Quota used up: guest sees "No questions left today." with "Sign In with Google" for the larger limit; a signed-in user sees when it resets. The input is disabled.
- Assistant switched off (`LLM_DISABLED`, or `enabled: false` from `/me/quota`): "Rules answers are switched off right now." with the rulebook link.
- No rulebook loaded (`NOT_FOUND`): "This rulebook isn't loaded yet." with the rulebook link.
- Error: the message from the API with "Try Again", which resends the same question.

## Acceptance criteria
- [ ] Ingest → review → `--load` works for all four games, and re-running is idempotent.
- [ ] "How does the game end?" gets a cited answer with a working page link for each game.
- [ ] An off-topic question returns `notCovered` with no invented rules.
- [ ] Guest request N+1 gets `QUOTA_EXCEEDED`; the signed-in limit is separate and higher; `LLM_ENABLED=false` shows the disabled state.
- [ ] 20 concurrent requests from one subject never exceed its quota.
- [ ] E2E (with `FakeProvider`): ask → cited answer → quota exhausted.

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

## Shared change requests
