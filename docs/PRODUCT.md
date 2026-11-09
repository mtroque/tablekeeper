# Tablekeeper: Product

**Your games stay physical. Tablekeeper takes away the friction around them: rules lookups, scoring math, and record-keeping.**

## The problem

- **Rules questions stall the table.** Physical rulebooks can't be searched, and an answer is often spread across several sections.
- **End-of-game scoring is slow and error-prone.** Counting adjacency, empty spaces, river lengths and stack heights by hand invites mistakes.
- **Nothing is remembered.** Scores live on scraps of paper; campaign progress lives on a sheet that gets lost.

## Who it's for

People who own and regularly play the supported games, at home with a partner or friends, with a phone on the table.

## Principle: the app drafts, you confirm, it remembers

| | The app drafts | You confirm | The app remembers |
|---|---|---|---|
| Rules assistant | An answer citing rulebook sections and pages | Check the cited page in the official rulebook | - |
| Board scorers | The board read from your photo, with confidence per value | Review and override anything | History and personal bests |
| Campaign tracker | A scoresheet with only what your campaign has unlocked | Fill it in, report new unlocks | Campaign progress |

Every scorer also works fully by hand, without a photo.

## Games and features

| | Patchwork | Azul | Harmonies | Dorfromantik |
|---|---|---|---|---|
| Edition | Valentine's Day | Master Chocolatier | Base Game, both board sides | Base Game |
| Rules assistant with citations | ✓ | ✓ | ✓ | ✓ |
| Score from a photo | box board + praline chits | - | top colors; you set heights | - |
| Manual scoring | ✓ | ✓ round by round | ✓ incl. animal cards | ✓ campaign scoresheet |
| History and personal bests | ✓ | ✓ | ✓ | ✓ |
| Campaign | - | - | - | ✓ unlocks, rank title |

- **Rules assistant:** ask in plain language; answers come only from that game's official rulebook, cite sections and pages that open the publisher's PDF, and say so when the rulebook doesn't cover the question.
- **Photo scoring:** the app finds the board, reads it, and shows a draft with uncertain values highlighted; the breakdown explains where every point came from. Anyone can try it with a sample photo.
- **Azul** is tracked across a whole game: after each round you tap in the chocolate box and the foundry line, and the app scores only what changed since the last confirmed round, so the running score never needs reading from the score track.
- **Dorfromantik** replaces the paper scoresheet and campaign sheet: the scoresheet shows only unlocked rows, and after each game the app asks what you unlocked (spoiler-safe: details stay hidden until unlocked).

Rules and scoring details: `docs/games/<gameId>.md`. Screens: `docs/UX.md`.

## Guests and accounts

**Guests can use everything; signing in with Google saves it.**

| | Guest | Signed in |
|---|---|---|
| Rules assistant | Small daily limit | Larger daily limit |
| Scorers, photo and manual | ✓ | ✓ |
| Azul game in progress, Dorfromantik campaign | This device only | Synced to the account |
| History and personal bests | - | ✓ |

## Privacy page

`/privacy` says in plain words what Tablekeeper stores and who processes it. Contact is the GitHub repository's issues, and the page doesn't describe data deletion (D-054). When the code behind a claim changes, update the page and its "Last updated" date.

| Section | Says | Checked against |
|---|---|---|
| Without an account | In-progress games and campaigns stay in this browser | `lib/session-store/local-store.ts`, D-041, D-050 |
| With an account | Google sign-in through Supabase Auth; stores email and name from Google, the display name, saved games and campaigns | `supabase/migrations/*_init.sql`, `components/auth-provider.tsx` |
| Board photos | Read in the browser, kept in this tab while scoring, never uploaded | `components/score-flow/photo.ts` |
| Rules questions | Sent to Anthropic; not stored; daily limits count requests per account or per salted IP hash | `services/rules.ts`, `llm/quota-store.ts` |
| Logs | Method, path, status and timing only; hosts keep their own request logs | `middleware/request-id.ts` |
| Browser storage | Sign-in session (`tk:auth`) and in-progress games; no cookies, ads or analytics | `lib/supabase.ts` |
| Services | Vercel (website and server), Supabase, Google, Anthropic | `docs/DEPLOYMENT.md` |

## Out of scope (v1)

- Playing the games digitally.
- Hosting rulebook PDFs (the app links to the official ones).
- Card databases or strategy advice.
- Reading score tracks or Harmonies stack heights from photos.
- Modeling Dorfromantik's campaign advancement track (the player reports unlocks).
