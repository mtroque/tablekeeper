---
description: Build one or more slices end to end, unattended
argument-hint: <slice id> [more ids, built in order]
---
Build slice(s) $ARGUMENTS in the order given. If `node_modules` is missing, run `pnpm install` first.

For each id: skip it if its spec is already ✅; otherwise follow AGENTS.md → Workflow through the Definition of done. Work without asking, stopping only for the reasons in AGENTS.md → Workflow.

End with one summary: slices finished, slices blocked and why, anything I need to do.
