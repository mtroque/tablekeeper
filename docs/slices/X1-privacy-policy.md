# X1: Privacy Policy

**Status:** ⬜ · **Depends on:** S0

**Goal:** Visitors can read, in plain words, what Tablekeeper stores and who processes it. Google's OAuth consent screen needs a public privacy policy URL before it can go to production.

## Owns

- `apps/web/src/app/privacy/`
- One link to `/privacy` from an existing page (additive wiring), e.g. the game library and the sign-in prompt
- `docs/UX.md` → Routes (the `/privacy` row)
- `tests/e2e/X1.spec.ts`

## Scope

A static page at `/privacy`, in the app's one-column layout, following `docs/UX.md` → Look and voice. Must cover, checked against the code at build time:

- **Guests:** in-progress games and campaigns stay in this browser's storage (D-041); nothing is sent to an account.
- **Signed in:** Google sign-in through Supabase Auth; stored: email and display name (`profiles`), saved games and campaigns (`play_sessions`, `campaigns`).
- **Photos** are read in the browser and never uploaded (`docs/ARCHITECTURE.md` → System overview).
- **Rules questions** are sent to Anthropic to write the answer; daily quotas store request counts per account or per salted IP hash (`llm_usage`), not the questions.
- **Processors:** Vercel (web), Render (API), Supabase (database and sign-in), Google (sign-in), Anthropic (rules answers).
- No ads, analytics or tracking cookies; browser storage holds the sign-in session and in-progress games.
- How to get data deleted, and a contact.
- The date it was last updated.

## Acceptance criteria

- [ ] `/privacy` renders without signing in and without the API.
- [ ] Every claim on the page matches the code and docs (listed in the spec when built).
- [ ] The page is linked from the game library.
- [ ] The text passes the UI copy lint.
- [ ] The production URL works as the consent screen's privacy policy link.

## Out of scope

- In-app account deletion (no such feature exists yet).
- Terms of service.

## Open questions

- The contact for privacy requests (an email address, or the GitHub repo's issues).
- Whether deletion requests are handled by hand through that contact, or a Delete Account feature is planned as its own slice.

## Decisions

## Shared change requests
