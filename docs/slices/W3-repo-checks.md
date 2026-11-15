# W3: Repo checks

**Status:** ⬜ · **Depends on:** W1

**Goal:** One `pnpm check:repo` command, run in CI and partly in a pre-commit hook, for rules that aren't about code syntax: rule ids have tests, migrations stay immutable, forbidden files stay out, and a branch only edits what its spec owns. The ownership check is what makes parallel agent PRs safe to merge without reading every diff.

## Owns
- `scripts/check-repo.ts` and `scripts/lib/check-repo/` with tests, `package.json` (`check:repo` script, pre-commit hook in `simple-git-hooks`)
- `.github/workflows/ci.yml` (add the step), `README.md` → Commands, `docs/AUTOMATION.md` → Enforcement map (W3 rows)
- `docs/slices/_TEMPLATE.md` (if `## Owns` needs a machine-readable format)

## Scope (must cover)
- **Rule ids:** every id defined in `docs/games/*.md` appears in some test name, and every id cited in a test name exists in a game doc.
- **Migrations:** files under the migrations folder that exist on `main` are unchanged on the branch (path from config so X3's move needs one edit).
- **Forbidden files:** no `.env*` except `.env.example`, no PDFs, no files under `data/rulebooks/`, no image over 2MB. Also as a pre-commit hook on staged files.
- **Ownership:** for a branch, the changed files must match the `## Owns` globs of the specs it changes, plus the additive-wiring files from `AGENTS.md` → Parallel sessions (where only added lines are allowed). On `main` and for W slices that own shared files, it reports and doesn't fail. Decide the exact `## Owns` format (paths and globs in backticks) and update the template.
- Output: one line per failure with the file and what to do.

## Acceptance criteria
- [ ] Each check has unit tests with a passing and a failing fixture
- [ ] `pnpm check:repo` passes on `main` (or lists real problems found, fixed or reported)
- [ ] A branch that edits a file outside its spec's Owns fails, and one that only adds a registry line passes
- [ ] Committing a 3MB image is refused by the hook

## Out of scope

## Open questions
- Should game docs mark ⚠️/VERIFY rules as exempt from "has a test"?

## Decisions

## Shared change requests
