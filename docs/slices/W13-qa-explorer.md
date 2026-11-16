# W13: Exploratory QA

**Status:** ⬜ · **Depends on:** W4, W10

**Goal:** An agent uses the app like a player, walking the screen map on a preview deployment, and files GitHub issues for what it finds, each with steps and a screenshot. It doesn't fix anything yet.

## Owns
- `.agents/skills/qa/SKILL.md` (or an `agy` prompt and script), issue template `.github/ISSUE_TEMPLATE/qa.md`, `docs/AUTOMATION.md`

## Scope (must cover)
- Target: a Vercel preview URL for a PR, or production read-only. Uses guest mode and seeded test users only; never real accounts.
- Walks every screen map entry plus free exploration within a step budget; checks copy rules, console errors, broken layouts at 390px.
- Deduplicates against open `qa` issues.
- Budget per run recorded here.

## Acceptance criteria
- [ ] One run on a preview files real issues (or reports none) without duplicates on a second run

## Out of scope
- Fixing (W14).

## Open questions

## Decisions

## Shared change requests
