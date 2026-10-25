# X1: Privacy Policy

**Status:** 🟨 · **Depends on:** S0

**Goal:** Visitors can read, in plain words, what Tablekeeper stores and who processes it. Google's OAuth consent screen needs a public privacy policy URL before it can go to production.

## Owns

- `apps/web/src/app/privacy/`
- One link to `/privacy` on the game library (`apps/web/src/app/page.tsx`, additive wiring)
- `docs/UX.md` → Routes (the `/privacy` row)
- `tests/e2e/X1.spec.ts`

## Scope

A static page at `/privacy` in the app's one-column layout, following `docs/UX.md` → Look and voice. Each section and the code it was checked against:

| Section | Says | Checked against |
|---|---|---|
| Without an account | In-progress games and campaigns stay in this browser; nothing is sent to an account | `lib/session-store/local-store.ts`, D-041 |
| With an account | Google sign-in through Supabase Auth; stored: email and name from Google, the display name, saved games and campaigns | `supabase/migrations/*_init.sql` (`profiles`, `play_sessions`, `campaigns`), `components/auth-provider.tsx` |
| Board photos | Read in the browser, kept in this tab while scoring, never uploaded | `components/score-flow/photo.ts` (sessionStorage), ARCHITECTURE → System overview |
| Rules questions | Sent to Anthropic to write the answer; not stored by Tablekeeper; daily limits count requests per account or per salted IP hash | `services/rules.ts`, `llm/quota-store.ts`, `llm_usage` |
| Logs | The API logs method, path, status and timing only; hosts keep their own standard request logs | `middleware/request-id.ts` |
| Browser storage | Sign-in session (`tk:auth`) and in-progress games; no cookies, ads or analytics | `lib/supabase.ts`, grep for cookies and analytics |
| Services | Vercel, Render, Supabase, Google, Anthropic | `docs/DEPLOYMENT.md` |
| Questions | Open an issue on the GitHub repository; issues are public, so don't post personal details | |
| Last updated | A date | |

## Acceptance criteria

- [ ] `/privacy` renders without signing in and without the API.
- [ ] Every claim on the page matches the code it's checked against (table above).
- [ ] The game library links to it.
- [ ] The text passes the UI copy lint.
- [ ] The production URL works as the consent screen's privacy policy link.

## Out of scope

- Data deletion requests and in-app account deletion.
- Terms of service.

## Decisions

- Contact is the GitHub repository's issues (chosen by the owner).
- The page doesn't describe data deletion (chosen by the owner).

## Shared change requests
