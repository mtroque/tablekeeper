# Unlogged corrections

**Criterion:** Did the user correct the agent (a `U:` turn that says it did something wrong, an interruption followed by new direction, a rejected tool call), and is each correction logged? A correction is logged when the trace shows a write adding a corrections row (`+ corrections rows: <tag>`) or the corrections index lists a row for it.

**Labels:**
- `none`: the user did not correct the agent.
- `logged`: every correction has a row.
- `unlogged`: at least one correction has no row; say what kind of mistake it was in the note.

**Pass:** `none` or `logged`.
