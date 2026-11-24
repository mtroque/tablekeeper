# S7: Rules quota refund on failed asks

**Status:** 🟨 · **Depends on:** S3

**Goal:** Give back the consumed quota request when a rules ask fails on our side (provider error or pre-model failure), and keep the web quota pill synced with the server after every error.

## Owns
- `db/migrations/`
- `apps/api/src/db/types.ts`
- `apps/api/src/db/quota.ts`
- `apps/api/src/llm/quota-store.ts`
- `apps/api/src/llm/gateway.ts`
- `apps/api/src/llm/gateway.test.ts`
- `apps/api/src/routes/rules.test.ts`
- `apps/web/src/app/games/[gameId]/rules/rules-assistant.tsx`
- `tests/e2e/S7.spec.ts`
- `docs/ARCHITECTURE.md`
- `docs/slices/S7-rules-quota-refund.md`

## Scope
- Add migration `db/migrations/20261124120000_llm_refund_request.sql` defining `public.llm_refund_request(p_subject_type text, p_subject_key text)`, locking `global` first (D-034) and decrementing `requests` with `greatest(0, requests - 1)` so counts never go below zero.
- Add `refundRequest` in `apps/api/src/db/quota.ts` and `refund` on `QuotaStore` in `apps/api/src/llm/quota-store.ts`.
- Update `gateway.run` in `apps/api/src/llm/gateway.ts` to refund the consumed request when `work(model)` throws a non-timeout error (provider errors such as 401/5xx/network, or pre-model failures). Timeouts (504) still count against the request quota because they may have already spent tokens across model calls; tokens remain recorded in `complete`'s `finally` block either way.
- Update `apps/web/src/app/games/[gameId]/rules/rules-assistant.tsx` `onError` to invalidate `['quota']` on every error, not only `blocked` errors, so the quota pill always reflects the server's count.
- Update `docs/ARCHITECTURE.md` (LLM gateway and abuse protection) and `docs/DECISIONS.md`.

## UI states
No new screen states beyond `docs/UX.md` → Screen states.

## Acceptance criteria
- [ ] `llm_refund_request` atomically decrements both `global` and subject `requests` for the current UTC day, locking `global` first and clamping at 0.
- [ ] `gateway.run` refunds the consumed request on provider errors (502) and pre-model failures, does not refund on `QUOTA_EXCEEDED` / `LLM_DISABLED` / timeout (504), and continues recording tokens on all model calls.
- [ ] `POST /v1/games/:gameId/rules/ask` returning 502 leaves `GET /v1/me/quota` unchanged.
- [ ] In the web rules assistant, after a failed ask, the quota pill refetches and displays the server's count.
- [ ] `pnpm verify --full` passes.

## Tests
- `apps/api/src/llm/gateway.test.ts`: provider throw leaves `used` unchanged; success counts 1; `QUOTA_EXCEEDED` leaves `used` unchanged; timeout (504) still counts 1.
- `apps/api/src/routes/rules.test.ts`: 502 from failing provider leaves `GET /v1/me/quota` unchanged.
- `tests/e2e/S7.spec.ts`: failed ask invalidates quota query and updates the quota pill to the server's count.

## Out of scope
- Production guest quota reset (handled separately after deploy with owner approval).

## Open questions
None.

## Decisions
- Record in `docs/DECISIONS.md` (next ID after D-101) that `gateway.run` refunds non-timeout failures (`llm_refund_request`) while timeouts (504) still count against the request quota and tokens are always recorded.

## Corrections
None.
