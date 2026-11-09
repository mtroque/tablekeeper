# X4: Sign-in with Neon Auth

**Status:** ⬜ · **Depends on:** X3

**Goal:** Move Google sign-in from Supabase Auth to Neon Auth, so users live in the same Neon database and Supabase leaves the stack entirely. Guests notice nothing; signed-in users sign in again once (fresh start).

## Owns
- `apps/web/src/lib/supabase.ts` (replaced by an auth client), `apps/web/src/components/auth-provider.tsx`, `apps/web/src/app/auth/callback/page.tsx`, `apps/web/src/lib/api.ts` (bearer token), `apps/web/package.json`
- `apps/api/src/middleware/` auth (optionalAuth, requireAuth), `apps/api/src/config.ts` (auth env), `apps/api/package.json`
- One migration pointing `profiles` and `user_id` columns at Neon Auth's users
- `scripts/lib/test-users.mjs`, `tests/e2e/helpers.ts` (sign-in), the e2e specs that sign in (`S1`, `S3`, `A1`, `D1`, `D2`, `H1`, `P1`) only where they use Supabase sessions, `tests/e2e/X4.spec.ts`
- `supabase/` (removed), `docs/ARCHITECTURE.md` (overview, Auth bullet), `docs/DEPLOYMENT.md` (Google OAuth), `.env.example`, `README.md`, `docs/PRODUCT.md` → Privacy page, `apps/web/src/app/privacy/page.tsx`, `docs/UX.md` if the sign-in flow changes

## Scope (must cover)
- **Sign-in flow.** Google via Neon Auth; the result-being-saved handoff through the OAuth redirect keeps working (ARCHITECTURE → Guest data).
- **API verification.** The API verifies Neon Auth's JWTs (JWKS), and the user id feeds X3's per-request `app.user_id`.
- **Session storage.** Where the session lives in the browser and under what key; supersede D-022 and update the privacy page's Browser storage row.
- **Local dev and e2e.** How seeded test users sign in without Google (D-022 used passwords), and whether local dev needs a hosted Neon Auth project.
- **Removal.** `@supabase/supabase-js`, the `supabase/` folder, Supabase env vars and every Supabase mention in docs and the privacy page.

## Acceptance criteria
- [ ] Signing in with Google on production creates a Neon Auth user and a profile, and a saved play shows in history
- [ ] A guest result saved during sign-in lands in the account after the redirect
- [ ] The API rejects missing, expired and foreign-issuer tokens with `UNAUTHENTICATED` (tests)
- [ ] Every e2e spec that signs in passes with the new test-user sign-in
- [ ] No `supabase` dependency, folder, env var or doc mention remains (`grep -ri supabase` is clean outside git history and `docs/DECISIONS.md`)

## Out of scope
- Other sign-in providers; importing Supabase users.

## Open questions
- Neon Auth's local story: can it run offline for e2e, or do tests mint JWTs from a local key the API trusts in test mode?
- Does Neon Auth's client keep the PKCE redirect flow the callback page relies on?

## Decisions

## Shared change requests
