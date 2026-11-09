# S6: Type a number in any counter

**Status:** ⬜ · **Depends on:** S1

**Goal:** Players can type a counter's value directly as well as stepping it with − / +, so large numbers (Dorfromantik task points, Harmonies animal cards, Patchwork praline chits) take one entry instead of many taps.

## Owns
- `apps/web/src/components/counter.tsx` and its tests
- `docs/UX.md` → Key interactions → Review / editor (the "long-press" line) and → Components (`Counter`)
- `tests/e2e/S6.spec.ts`

## Scope (must cover)
- Today typing is behind a long press (500ms) on the value (`counter.tsx`), which nobody finds. Make the value a visible number field you can tap and type into, with − / + kept on either side.
- Every scorer uses this one component (Patchwork chits, Harmonies card lists, Dorfromantik scoresheet and unlock picker, the `_example` campaign), so no game file changes.
- Phone: numeric keyboard (`inputMode="numeric"`), select the whole value on focus so typing replaces it, commit on blur and Enter, Escape restores.
- Invalid or empty input restores the last value; out-of-range input clamps to `min` / `max`. Negative numbers only where `min` allows them.
- The `uncertain` style stays on the field. Labels keep the Accessibility rules (`docs/UX.md`).
- The running total updates on commit, not on every keystroke (or on every valid keystroke; decide in the spec).

## Acceptance criteria (draft)
- [ ] Tapping a counter's value opens the numeric keyboard and typing "37" then Enter or tapping away sets 37.
- [ ] − / + still step by 1 and respect `min` / `max`.
- [ ] Clearing the field and leaving it restores the previous value; "abc" can't be entered.
- [ ] Typing over `max` sets `max`.
- [ ] Works the same in every game that uses `Counter` (one unit test for the component, one e2e on a Dorfromantik scoresheet row).

## Open questions
- Commit while typing (live total) or on blur only?

## Decisions

## Shared change requests
