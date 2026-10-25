---
description: Run groups of slices at the same time, one worktree session per group
argument-hint: [<ids> | <ids> | …]   e.g. "S1 | S2 | S3"; empty = suggest groups
---
Start parallel work for: $ARGUMENTS

1. **Preflight** (main checkout): on `main`, clean tree, `.env.local` present, local Supabase running (`supabase status`, else `pnpm db:start`).
2. **Groups** are separated by `|`; one session builds each group's ids in order. With no argument, propose groups from docs/ROADMAP.md (unstarted slices whose dependencies are ✅ on main or earlier in the same group; dependent slices chained into one group) and wait for my OK.
3. **Validate:** every id has a spec; dependencies are met as above; no two groups own overlapping files. Otherwise stop and explain.
4. **Launch** each group with `scripts/worktrees.sh launch <name> <ids…>`, naming it after the game if all its slices belong to one, else the lowercase first id. Names must be new (`git worktree list`).
5. Tell me how to watch the sessions (from the script output); `/status` and `/merge` take it from there.
