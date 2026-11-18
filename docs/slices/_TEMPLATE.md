# <ID>: <Title>

**Status:** ⬜ · **Depends on:** <ids, or none>

**Goal:** <who gets what, and why it matters, in one or two sentences>

## Owns
<Repo-relative paths, folder prefixes ending in `/`, or globs in backticks (e.g. `` `apps/web/src/components/counter.tsx` ``, `` `packages/core/src/games/<gameId>/` ``), or "The `<gameId>` game folders". Checked by `pnpm check:repo`. Must not overlap with slices running at the same time.>

## Scope
<What to build that isn't already described in ARCHITECTURE, UX or a game doc; link to those instead of restating. A stub has a "must cover" list.>

## UI states
<Only those beyond docs/UX.md → Screen states.>

## Acceptance criteria
- [ ] <observable behavior>
<A criterion that can't be verified in this slice ends with "(moved to <id>)" and is copied into that follow-up spec; `pnpm check:repo` checks it when the spec is removed.>

## Tests
<Anything beyond the standard ones in docs/CONVENTIONS.md → Testing.>

## Out of scope

## Open questions

## Decisions
<Filled while building; copied to docs/DECISIONS.md on main.>

## Corrections
<Rows for docs/CORRECTIONS.md → Log (same columns), for corrections received while building; the finish commit appends them there.>

## Shared change requests
<Changes needed in code this slice doesn't own: what, where, why.>
