# S6: Type a number in any counter

**Status:** 🟨 · **Depends on:** S1

**Goal:** Players can type a counter's value directly as well as stepping it with − / +, so large numbers (Dorfromantik task points, Harmonies animal cards, Patchwork praline chits) take one entry instead of many taps.

## Owns
- `apps/web/src/components/counter.tsx` and its tests (`apps/web/src/components/counter.test.ts`)
- `docs/UX.md` → Key interactions → Review / editor (the counter and running total lines) and → Components (`Counter`)
- `tests/e2e/S6.spec.ts`
- The lines in older e2e specs that reach a counter's value through the old "Hold to type a number." button: `tests/e2e/D1.spec.ts`, `tests/e2e/D2.spec.ts`, `tests/e2e/H1.spec.ts`, `tests/e2e/S1.spec.ts`, `tests/e2e/X3.spec.ts` (only those lines; nothing else in them changes)

## Scope
- The value between − and + is always a visible number field (`<input type="text" inputMode="numeric">`), labeled by the counter's visible label (a `<label>`, so its accessible name is the label, e.g. "Forest"). The long press and its "Hold to type a number." button go away. Tapping the label also focuses the field.
- `type="text"` rather than `type="number"`: no spinner arrows, no wheel changes, no `e` or `.` accepted, and the value is ours to sanitize.
- On focus the whole value is selected, so typing replaces it (`select()` on focus, and the first mouse up after focus doesn't clear the selection).
- Typing keeps only digits, plus a leading minus when `min < 0`. "abc" leaves the field as it was.
- **When the value applies (open question resolved):** on every keystroke that gives a whole number in range, so the running total stays live as it is for − / + and grid taps. A number that more digits can only push further out of range (over `max` when positive, under `min` when negative) is clamped at once and the field shows the clamped value. A number that more digits could still bring into range (under a positive `min`, or a lone "-") waits for the commit. Reason: iOS Safari doesn't blur a field when a button is tapped, so a value applied only on blur would be lost when the player types 37 and taps "Finish Game" or "See Score" straight away.
- Commit on blur and on Enter (Enter also blurs, closing the keyboard): a valid number is clamped to `min` / `max`; empty or invalid input restores the value from before editing started. Escape restores the value from before editing started and blurs.
- − / + step by 1 within `min` / `max` as before. Pressing one while the field is focused drops the draft so the field shows the stepped value.
- The `uncertain` dashed warning outline stays on the field; focus shows the accent border.
- Every scorer uses this one component (Patchwork chits, Harmonies card lists, Dorfromantik scoresheet and unlock picker, the `_example` campaign), so no game file changes. The component's props don't change.

## UI states
- Counter field: idle (value, 1px `--line` border), focused (accent border, value selected), uncertain (dashed `--warn` outline, also when focused), at `min` (− disabled), at `max` (+ disabled).

## Acceptance criteria
- [ ] Tapping a counter's value focuses a field with the numeric keyboard (`inputMode="numeric"`) and the value selected; typing "37" then Enter, or tapping away, sets 37.
- [ ] The running total updates as a valid number is typed (decided above).
- [ ] − / + still step by 1 and respect `min` / `max`.
- [ ] Clearing the field and leaving it restores the previous value; "abc" can't be entered; Escape restores the value from before editing.
- [ ] Typing over `max` sets `max`; typing under a positive `min` and leaving sets `min`; a minus sign is only accepted when `min < 0`.
- [ ] The `uncertain` style stays on the field, and the field's accessible name is the counter's label.
- [ ] Works the same in every game that uses `Counter`: one unit test file for the component, one e2e on a Dorfromantik scoresheet row, and the existing D1, D2, H1, S1, X3, P1, P2, P3, H2 e2e tests pass with the new field.

## Tests
- `apps/web/src/components/counter.test.ts`: the pure input rules (sanitize, live value, commit value) and the rendered markup (`renderToStaticMarkup`, as `server-status.test.ts` does).
- `tests/e2e/S6.spec.ts`: a Dorfromantik scoresheet row, typing, Enter, blur, clear, "abc", over `max`, Escape, − / +, and the live total.

## Out of scope
- Changing any game's `min` / `max` or labels.

## Open questions
None left (commit timing resolved under Scope).

## Decisions
- The value applies on every valid keystroke, with clamping as soon as more digits can't bring it back into range; empty or invalid input restores on commit. (iOS Safari doesn't blur the field when a button is tapped.)
- The field is `type="text"` with `inputMode="numeric"`, not `type="number"`.
- Owns widened to the counter lines of the older e2e specs, since the old accessible name ("Forest: 0. Hold to type a number.") is gone; no other slice running now owns those files.

## Corrections

## Shared change requests
