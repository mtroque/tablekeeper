---
name: harden
description: Promote a repeated correction pattern from docs/CORRECTIONS.md to a lint rule, repo check, or test
argument-hint: [pattern tag from docs/CORRECTIONS.md]
disable-model-invocation: true
---
Promote a correction pattern from `docs/CORRECTIONS.md` → Log into an automated check (principle 2 of `docs/AUTOMATION.md`).

1. **Read the log:** read `docs/CORRECTIONS.md` → Log. Count rows per `Pattern` across every `Source` (`user`, `review`, `self`, `trace`).
   - If no pattern is given with this command: list every pattern with **2 or more rows** whose status is neither `promoted:` nor `dismissed:` (include count, sources, and a one-line summary), and wait for the user to pick one. If none qualify, say so and stop.
   - If a pattern is given: find all matching rows. If none exist, or all are already `promoted:` or `dismissed:`, report that and stop.
2. **Enforce the threshold:**
   - If the pattern has **only 1 occurrence**, refuse by default and explain that single corrections stay in the log so the codebase does not fill with one-off rules (`docs/CORRECTIONS.md` → When a pattern becomes a check).
   - Exception: if it meets the high-stakes rule (leaked secrets, lost or corrupted user data, a wrong saved score, or a game rule guessed instead of read from `docs/games/`), explain why it qualifies and **ask the user first** before continuing.
3. **Find existing occurrences:** search the repository for every instance of the mistake.
4. **Choose the strongest fix** (`docs/AUTOMATION.md` → Principles 1), in order of preference, and state why you chose it:
   - **Design change** (types, APIs, folder boundaries)
   - **Lint rule** (`eslint-rules/rules.js` or `eslint.config.js`)
   - **Repo check** (`scripts/lib/check-repo/` or `commitlint.config.js`)
   - **Test**
   - **Prose-only rule** only when no deterministic check is possible; state why no check is possible and record that reason in the log row.
5. **Implement with tests:**
   - Write the check with unit tests covering both failing and passing cases.
   - Give every new lint, commit, or repo check a one-line error message that names what to do instead and links the relevant doc section.
6. **Clean up or baseline:** fix existing occurrences directly, or add them to `eslint-rules/baseline.json` when the backlog is too large to clean in one pass (`docs/AUTOMATION.md` → Principles 3).
7. **Update docs and statuses:**
   - Add or update the row in `docs/AUTOMATION.md` → Enforcement map (status `✅` for an automated check).
   - Set every matching row's `Status` in `docs/CORRECTIONS.md` → Log to `promoted: <check>` (or `promoted: <doc> (prose: <why no check is possible>)` for prose-only).
8. **Verify and commit:** run `pnpm fix` and `pnpm verify --full` and commit with Conventional Commits using the matching scope (e.g. `workflow` for tooling/skills/docs).
