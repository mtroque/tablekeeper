# S3: Rules assistant

**Status:** ⬜ · **Depends on:** S0

**Goal:** rules answers for every supported game, drawn only from its official rulebook with page citations, behind quotas that keep a public deployment from running up the LLM bill.

## Owns
- `scripts/ingest-rulebook.ts`, `scripts/rules-smoke.ts`, `scripts/lib/`
- `apps/api/src/llm/**`, `apps/api/src/rules/**`, `apps/api/src/{routes,services,db}/{rules,quota}.ts`
- `packages/core/src/contracts/{rules,quota}.ts`
- `apps/web/src/app/games/[gameId]/rules/**`, `apps/web/src/components/{chat-thread,citation-chip,quota-pill}.tsx`
- `tests/e2e/S3.spec.ts`

## Scope
- Everything in `docs/ARCHITECTURE.md` → Rules assistant and → LLM gateway and abuse protection, plus the `rules/ask` and `me/quota` routes (`NOT_FOUND` when a game has no ingested rulebook).
- Rules page per `docs/UX.md` → Rules assistant.
- `pnpm rules:smoke <gameId> "<question>"`: the only path that calls the real API outside the app.
- Ingest and review all four rulebooks (files per `docs/DATA_ASSETS.md`).

## Acceptance criteria
- [ ] Ingest → review → `--load` works for all four games, and re-running is idempotent.
- [ ] "How does the game end?" gets a cited answer with a working page link for each game.
- [ ] An off-topic question returns `notCovered` with no invented rules.
- [ ] Guest request N+1 gets `QUOTA_EXCEEDED`; the signed-in limit is separate and higher; `LLM_ENABLED=false` shows the disabled state.
- [ ] 20 concurrent requests from one subject never exceed its quota.
- [ ] E2E (with `FakeProvider`): ask → cited answer → quota exhausted.

## Out of scope
Streaming, saved conversations, questions about a score breakdown.
