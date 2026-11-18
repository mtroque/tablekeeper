# Tablekeeper: Roadmap

Status: ⬜ not started · 🟨 in progress · ✅ done · ⏸ blocked. Each slice sets its own row to ✅ in its finish commit, on its branch, so this table changes on `main` when its PR merges; live status before then is in the spec (`/status` shows it across worktrees). The same commit moves the spec's lasting facts to their home docs and removes it; git history keeps it.

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
| X3 | Database on Neon: SQL driver instead of supabase-js, API-side access checks with RLS backstop, local Postgres | X2 | ✅ |
| X4 | Sign-in with Neon Auth: Google via Neon Auth, Supabase removed | X3 | ✅ |
| W1 | CI checks: typecheck, lint, commits, unit tests and build on every push and PR | - | ✅ |
| W2 | Prose rules become lint rules, with a baseline that only shrinks | W1 | ✅ |
| W3 | Repo checks: rule ids have tests, migrations immutable, forbidden files, spec ownership | W1 | ✅ |
| W4 | PR workflow: protected `main`, `/build` opens PRs, merged in GitHub | W1, W3 | ✅ |
| W5 | `/harden`: turn a correction into a check | W2 | ✅ |
| W6 | Effects only through named hooks; raw `useEffect` banned | W2 | ✅ |
| W7 | CI database jobs: API integration and e2e tests in CI | W1, X3 | ✅ |
| W8 | Property-based tests for scorers and contracts | W1 | ✅ |
| W9 | CV accuracy gate in CI | W1 | ✅ |
| W10 | Screen map and screenshots on every PR | W7, W15 | ⬜ |
| W11 | Review loop: every factory PR reviewed, findings resumed into the builder's session | W14 | ✅ |
| W12 | Groomer loop and workflow metrics | W2, W4 | ✅ |
| W13 | Exploratory QA: an agent walks the screen map in CI and files issues | W7, W10 | ⬜ |
| W14 | Factory runner: Claude Code on Actions every 5 hours, Project-ordered issue queue | W4, W7 | ✅ |
| W15 | Local screenshots: `pnpm shot` for agents checking screen states | - | ✅ |
| W16 | Session grading: silent failures in transcripts become `trace` corrections and metrics | W12, W14 | ⬜ |
| W17 | Trace follow-ups: Antigravity transcript paths, per-session `.scratch/` | - | ✅ |
| W18 | Factory plan: runner, review loop and merge authority replanned; W specs expanded; docs cleanup | - | ✅ |
| W19 | Merge authority: reviewer verdict plus fixed rules, shadow mode first, per-area policy file | W7, W11, W12 | ⬜ |
| W20 | Trace pass 2: every Antigravity session read, fixes specced as W21 to W26 | - | ✅ |
| W21 | Dependency security: patch advisories on the sign-in path and Next.js, `pnpm audit` required in CI | - | ✅ |
| W22 | Agent commands: `pnpm verify` with short output, `pnpm fix`, dev servers that clean up | - | ✅ |
| W23 | Antigravity environment: pnpm, git and Docker in the sandbox, a checked-in permission profile, `gh` upgrade | - | ⬜ |
| W24 | Factory go-live: dry run, Project access, current models, the live checks W11, W12 and W14 left open | - | ⬜ |
| W25 | Finish gate: `check:repo` refuses to fold a spec with unchecked criteria | - | ✅ |
| W26 | Production safety: issuer contract test, post-deploy smoke, approved migration workflow | W7 | ⬜ |

## Next

Workflow before features; direction in `docs/AUTOMATION.md`. Done so far: W1 to W9, W11, W12, W14, W15, W17, W18, W20, W21, W22, W25.

1. W24: the factory's first live runs, starting with a dry run. W23 alongside (mostly owner setup on the machine).
2. W26's remaining parts: post-deploy smoke, `migrate.yml`, `Audit` required on `main`, and the owner's sign-in check after W21 deploys (the issuer test and production rule are done).
3. W10 (screen map), then W13 (QA).
4. W16 (session grading) and W19 (merge authority).

Product slices can run alongside; they get the new checks for free.

## Later

- Azul chocolate box and foundry line detection (A2): deferred, see `docs/slices/A2-azul-detection.md`.
- **My Shelf.** Signed-in users pick which supported games they own, and the home page shows only those (with a way to see all supported games). Guests still see everything.
- Ask the rules assistant about a saved score breakdown ("why didn't this building score?").
- Harmonies heights from an angled photo.
- Harmonies Crescendo in the rules assistant (a second rulebook per game) and photo reading of sides C and D.
- More games behind the same module interface: Vale of Eternity, Flamecraft, Splendor.
- Streaming rules answers.
- Head-to-head records between regular opponents.
