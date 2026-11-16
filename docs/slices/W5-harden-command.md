# W5: /harden

**Status:** 🟨 · **Depends on:** W2

**Goal:** A command that promotes a repeated correction to a check: given a pattern from `docs/CORRECTIONS.md`, it adds the lint rule or repo check that prevents it, cleans up existing occurrences (or baselines them), and updates the enforcement map and the log. This is principle 2 of `docs/AUTOMATION.md`, as one step.

## Owns
- `.agents/skills/harden/SKILL.md`, `docs/CORRECTIONS.md` (statuses), `AGENTS.md` (point promotion at `/harden`), `docs/AUTOMATION.md` (mention in Principles and Enforcement map)
- Checks added by running `/harden` on the two initial patterns: `commitlint.config.js`, `scripts/lint-commits.test.ts`, `docs/CONVENTIONS.md` (Git scopes and user-facing note rule)

## Scope
- **Skill** (`.agents/skills/harden/SKILL.md`): tool-neutral Agent Skill (read by Antigravity directly and by Claude Code via `.claude/skills`).
  - **Input:** a pattern tag from `docs/CORRECTIONS.md` → Log. With no argument, list every pattern logged twice or more (across all sources, including `trace`) whose status is neither `promoted:` nor `dismissed:`, and wait for the user to choose one.
  - **Guardrail on 1-occurrence patterns:** refuse a pattern with only one occurrence unless it meets the high-stakes rule in `docs/CORRECTIONS.md` → When a pattern becomes a check (leaked secrets, lost or corrupted user data, wrong saved score, or a game rule guessed instead of read from `docs/games/`), in which case explain why it qualifies and ask the user first before proceeding.
  - **Hardening steps:**
    1. Find every existing occurrence in the repository.
    2. Choose the strongest fix per `docs/AUTOMATION.md` → Principles (design change → lint rule → repo check → test → prose-only only when no check is possible) and state why.
    3. Implement the check with unit tests (passing and failing cases) and a one-line fix-naming error message linking the relevant doc.
    4. Fix existing occurrences directly, or record them in `eslint-rules/baseline.json` when the backlog is too large for one pass.
    5. Add or update the row in `docs/AUTOMATION.md` → Enforcement map.
    6. Set all matching rows in `docs/CORRECTIONS.md` → Log to `promoted: <check>` (or `promoted: <doc> (prose: <why no check is possible>)`).
    7. Run the relevant checks and commit with the right Conventional Commit scope.
- **Docs:** update `AGENTS.md` (point repeated-correction promotion at `/harden`) and `docs/AUTOMATION.md` (link `/harden` in Principles).
- **Initial `/harden` runs** on the two open 2-occurrence patterns in `docs/CORRECTIONS.md`:
  - `commit-msg-recovery`: add `docs` to `scope-enum` in `commitlint.config.js`, enforce `require-scope-except-merge` so agents cannot silently drop the scope when a hook rejects a bad scope, add `scripts/lint-commits.test.ts`, update `docs/CONVENTIONS.md` → Git and `docs/AUTOMATION.md` → Enforcement map, and promote both rows.
  - `overstated-user-notes`: no deterministic check can judge semantic contradictions or over-explanation in prose; add a concise prose rule to `docs/CONVENTIONS.md` and `docs/AUTOMATION.md` → Review policy (for W11 reviewers), and promote both rows with the prose-only reason.

## UI states
None.

## Acceptance criteria
- [ ] Run on two real patterns logged twice (`commit-msg-recovery` is one); both end with a passing check that would have caught them and promoted log rows
- [ ] Run on a single-occurrence pattern; it declines and explains

## Tests
- `scripts/lint-commits.test.ts` testing `commitlint.config.js` (`docs` scope, `require-scope-except-merge`, `header-max-length`, and `docs: merge <branch>` exemption).

## Out of scope
- Automatic session grading (`trace` generation, W16) and bot review prompts (W11).

## Open questions
Resolved:
- **`overstated-user-notes` has no deterministic check:** `docs/CORRECTIONS.md` already notes `(no check possible)`. Per the skill's prose-only fallback, it promotes to `docs/CONVENTIONS.md` + `docs/AUTOMATION.md` → Review policy with the reason recorded in the log row.

## Decisions

## Corrections

## Shared change requests
None.
