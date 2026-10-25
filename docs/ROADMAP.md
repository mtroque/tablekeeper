# Tablekeeper: Roadmap

Status: ⬜ not started · 🟨 in progress · ✅ done · ⏸ blocked. This table changes only on `main`; live status is in each spec (`/status` shows it across worktrees).

## Slices

| ID | Slice | Depends on | Status |
|---|---|---|---|
| S0 | Foundation: monorepo, all tables, auth + guest mode, app shell, registries, shared types | - | ✅ |
| S1 | Score flow: sessions API, SessionStore, capture → review → result → history, grid editors, breakdown | S0 | ✅ |
| S2 | CV toolkit: worker, pipeline stages, calibration, eval harness | S0 | ✅ |
| S3 | Rules assistant: ingestion, LLM gateway and quotas, agent, chat UI | S0 | ✅ |
| D1 | Dorfromantik scoresheet | S1 | ⬜ |
| D2 | Dorfromantik campaign and unlocks | D1 | ⬜ |
| P1 | Patchwork manual scorer | S1 | ✅ |
| P2 | Patchwork board detection | P1, S2 | ⬜ |
| P3 | Patchwork token detection | P2 | ⬜ |
| A1 | Azul manual round tracker | S1 | ⬜ |
| H1 | Harmonies manual scorer | S1 | ⬜ |
| H2 | Harmonies photo detection | H1, S2 | ⬜ |

## Suggested runs

| Step | Command |
|---|---|
| 1 | `/build S0` in the main checkout |
| 2 | `/parallel S1 \| S2 \| S3` |
| 3 | `/parallel D1 D2 \| P1 P2 P3 \| A1 \| H1 H2` (vision slices wait for S2 to be merged; start step 3 after S1 if S2 is still running, and leave P2+, H2 for later) |

## Priority

Most value first:

1. S0, S1, S3: rules for four games plus saved scores.
2. D1, P1, A1, H1: every game has a scorer.
3. S2, P2: photo-to-draft shown on one game.
4. D2, H2, P3.

## Later

- Azul chocolate box and foundry line detection (A2): deferred, see `docs/slices/A2-azul-detection.md`.
- **My Shelf.** Signed-in users pick which supported games they own, and the home page shows only those (with a way to see all supported games). Guests still see everything.
- Ask the rules assistant about a saved score breakdown ("why didn't this building score?").
- Harmonies heights from an angled photo.
- More games behind the same module interface: Vale of Eternity, Flamecraft, Splendor.
- Streaming rules answers.
- Head-to-head records between regular opponents.
