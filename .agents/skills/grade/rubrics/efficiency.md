# Efficiency

**Criterion:** Did the agent reach its result without spinning? Spinning is rerunning a failed call unchanged, trying variant after variant of a refused command, rerunning a whole suite to find one failure, or reading the same files again and again without acting.

**Labels:**
- `efficient`: failures were read and acted on; each rerun followed a change.
- `some-waste`: a few wasted calls (up to about 5) before the agent adjusted.
- `spinning`: a loop of wasted calls, or the session ended without its result because of one.

**Pass:** `efficient` or `some-waste`.
