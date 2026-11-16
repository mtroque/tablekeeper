# Tablekeeper: Roadmap

Status: ⬜ not started · 🟨 in progress · ✅ done · ⏸ blocked. This table changes only on `main`; live status is in each spec (`/status` shows it across worktrees). A finished slice's spec is removed once it's merged and its lasting facts are in their home docs; git history keeps it.

## Slices

| ID | Slice | Depends on | Status |
|---|---|---|---|
| S0 | Foundation: monorepo, all tables, auth + guest mode, app shell, registries, shared types | - | ✅ |
| S1 | Score flow: sessions API, SessionStore, capture → review → result → history, grid editors, breakdown | S0 | ✅ |
| S2 | CV toolkit: worker, pipeline stages, calibration, eval harness | S0 | ✅ |
| S3 | Rules assistant: ingestion, LLM gateway and quotas, agent, chat UI | S0 | ✅ |
| D1 | Dorfromantik scoresheet | S1 | ✅ |
| D2 | Dorfromantik campaign and unlocks | D1 | ✅ |
| P1 | Patchwork manual scorer | S1 | ✅ |
| P2 | Patchwork board detection | P1, S2, S4 | ✅ |
| P3 | Patchwork token detection | P2 | ✅ |
| A1 | Azul manual round tracker | S1 | ✅ |
| H1 | Harmonies manual scorer | S1 | ✅ |
| H2 | Harmonies photo detection | H1, S2, S4 | ✅ |
| S4 | CV worker detectors without UI (production builds) | S2 | ✅ |
| X1 | Privacy policy page | S0 | ✅ |
| S5 | Quiet server status: drop the false "Couldn't reach the server." line | S0 | ✅ |
| X2 | API on Vercel: move the Express API off Render, shared burst limit, no waking state | S0, S3, S5 | ✅ |
| S6 | Typed counters: tap a counter's value to type a number, in every game | S1 | ⬜ |
| P4 | Patchwork piece colors: covered spaces drawn in the photo's piece colors | P2 | ⬜ |
| H3 | Harmonies review on the board: tap hexes, highlights until answered, one option per score-equivalent stack | H2 | ⬜ |
| H4 | Harmonies Crescendo: Whispers, and the module switches | H3 | ⬜ |
| H5 | Harmonies Crescendo: board sides C and D (layouts need verifying) | H4 | ⬜ |
| H6 | Harmonies Crescendo: Sanctuaries, entered by their 2 colors | H5 | ⬜ |
| X3 | Database on Neon: SQL driver instead of supabase-js, API-side access checks with RLS backstop, local Postgres | X2 | ⬜ |
| X4 | Sign-in with Neon Auth: Google via Neon Auth, Supabase removed | X3 | ⬜ |
| W1 | CI checks: typecheck, lint, commits, unit tests and build on every push and PR | - | ✅ |
| W2 | Prose rules become lint rules, with a baseline that only shrinks | W1 | ⬜ |
| W3 | Repo checks: rule ids have tests, migrations immutable, forbidden files, spec ownership | W1 | ⬜ |
| W4 | PR workflow: protected `main`, `/build` opens PRs, `/merge` merges them | W1, W3 | ⬜ |
| W5 | `/harden`: turn a correction into a check | W2 | ⬜ |
| W6 | Effects only through named hooks; raw `useEffect` banned | W2 | ⬜ |
| W7 | CI database jobs: API integration and e2e tests in CI | W1, X3 | ⬜ |
| W8 | Property-based tests for scorers and contracts | W1 | ⬜ |
| W9 | CV accuracy gate in CI | W1 | ⬜ |
| W10 | Screen map and screenshots on every PR | W7 | ⬜ |
| W11 | Review bots: Claude on request, Antigravity from a local script | W4 | ⬜ |
| W12 | Groomer loop and workflow metrics | W2, W4 | ⬜ |
| W13 | Exploratory QA on previews, filing issues | W4, W10 | ⬜ |
| W14 | Nightly factory: issues to PRs, auto-merge by policy | W7, W11, W12 | ⬜ |

## Next

Workflow before features; direction in `docs/AUTOMATION.md`.

1. W1.
2. W2 and W3 in parallel.
3. W4, so everything after goes through PRs.
4. W5, W6, W8, W9 and X3, in any order.
5. W7, then W10 and W11.
6. W12, W13, then W14.

Product slices can run alongside from step 3 on; they then get the new checks for free.

## Later

- Azul chocolate box and foundry line detection (A2): deferred, see `docs/slices/A2-azul-detection.md`.
- **My Shelf.** Signed-in users pick which supported games they own, and the home page shows only those (with a way to see all supported games). Guests still see everything.
- Ask the rules assistant about a saved score breakdown ("why didn't this building score?").
- Harmonies heights from an angled photo.
- Harmonies Crescendo in the rules assistant (a second rulebook per game) and photo reading of sides C and D.
- More games behind the same module interface: Vale of Eternity, Flamecraft, Splendor.
- Streaming rules answers.
- Head-to-head records between regular opponents.
