---
name: parallel
description: Run groups of slices at the same time, one worktree session per group
argument-hint: [<ids> | <ids> | …]   e.g. "S1 | S2 | S3"; empty = suggest groups
disable-model-invocation: true
---
Start parallel work for the groups given with this command.

1. **Preflight** (main checkout): run `pnpm preflight`. It must show `main`, a clean tree and no `MISS` line (for Supabase, run `pnpm db:start`). Don't check `.env.local` yourself; reading it is denied.
2. **Groups** are separated by `|`; one session builds each group's ids in order. With no argument, propose groups from docs/ROADMAP.md (unstarted slices whose dependencies are ✅ on main or earlier in the same group; dependent slices chained into one group) and wait for my OK.
3. **Validate:** every id has a spec; dependencies are met as above; no two groups own overlapping files. Otherwise stop and explain.
4. **Launch** each group with `scripts/worktrees.sh launch <name> <ids…>`, naming it after the game if all its slices belong to one, else the lowercase first id. Names must be new (`git worktree list`).
5. Tell me how to watch the sessions (from the script output); each session opens a PR when done, and `/status` and `/merge` take it from there.
