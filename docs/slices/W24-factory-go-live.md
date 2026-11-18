# W24: Factory go-live

**Status:** ⬜ · **Depends on:** none

**Goal:** The factory, review loop and metrics actually run on GitHub, and every live acceptance criterion W11, W12 and W14 left unchecked is verified. Those slices were finished with unit tests only (PR #13), so as of 2026-11-18 no factory, review or metrics workflow has ever run for real.

## Owns
- `.github/workflows/factory.yml`, `.github/workflows/review.yml`, `.github/workflows/metrics.yml`, `.github/factory/config.json`
- `scripts/factory/` (Project access, dry run), `scripts/review/`, `scripts/metrics.ts` with tests
- `docs/AUTOMATION.md` (Accounts and setup; the factory's first-run record), `README.md` (Factory section)

## Scope
- **Project access:** `scripts/factory/project.ts` reads the "Factory" Project through the GitHub App installation token. GitHub Apps generally can't read Projects owned by a personal account, so the first run will likely fail to read the queue.
  - Verify with a dry run first.
  - If it fails, read the Project with a separate classic token that has only `read:project` (secret `FACTORY_PROJECT_TOKEN`). Keep the App token for everything else.
  - Record the result either way.
- **Dry run:** a `workflow_dispatch` input `dry_run` that picks the next issue and prints why each earlier one was skipped, without building, labeling or opening anything. It's the first thing to run, and the safe way to check the queue later.
- **Models:** the config names `claude-sonnet-4-6` for builder and reviewer, which is out of date. Set current models (builder `claude-opus-5-5`, reviewer `claude-sonnet-5-5`, as a starting point the owner can change) and record the choice.
- **Live verification of the carried-over criteria:**
  - **W14:** with two `agent-ready` issues in the Project, a manual run builds the top one and opens a PR with `Closes #n` and its session id, and that PR triggers `review.yml`. Dragging the second issue above the first changes the next pick. `FACTORY_ENABLED=false` makes the next run exit before picking. A session artifact can't be read without the key and is restored by `session.ts` in another job, where `claude --resume` continues it. A slice that stops on ⏸ leaves its issue labeled `needs-human` with the reason.
  - **W11:** a factory PR with a planted bug gets a blocking finding, the resumed builder session (same id) fixes it, and the next review is clean. A PR still blocked after `maxRounds` gets `needs-human`. Rerunning on the same head commit posts no second review. An owner PR labeled `review` gets findings and no fix round.
  - **W12:** a manual `metrics.yml` run updates the pinned "Factory metrics" issue.
- **First real task:** a small, low-risk issue (for example a docs fix or one W22 item) as the first `agent-ready` issue, so a failure costs little.

## Acceptance criteria
- [ ] A dry run lists the queue in Project order with skip reasons (link the run)
- [ ] Every carried-over W14, W11 and W12 criterion above is verified, each with a run or PR link
- [ ] The config names current models, and the first real factory PR records them in its body

## Tests
- Dry run: picks without side effects (no label, branch or PR calls), prints skip reasons.
- Project access: falls back to the read-only token when the App token is refused, with a clear error when neither works.

## Out of scope
- Merge authority (W19). Raising `tasksPerRun`.

## Open questions

## Decisions

## Corrections

## Shared change requests
