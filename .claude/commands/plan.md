---
description: Turn an idea into a planned slice (spec stub + roadmap row)
argument-hint: <what you want to build>
---
Plan a new slice for: $ARGUMENTS

1. Read docs/PRODUCT.md, docs/ARCHITECTURE.md, docs/ROADMAP.md and the specs it might touch. Check it fits the product and the existing patterns; if it needs shared-code changes, consider splitting off a shared slice.
2. Ask me at most 3 questions, only if the scope is genuinely unclear.
3. Pick the next free id (an existing prefix if it extends that area, e.g. P4; otherwise X1, X2…), its dependencies and what it owns.
4. Write `docs/slices/<id>-<short-name>.md` from docs/slices/_TEMPLATE.md as a stub (goal, Owns, Must cover, draft acceptance criteria, open questions), add its row to docs/ROADMAP.md (removing it from "Later" if listed), and commit `docs(roadmap): plan <id>`.
5. Reply in a few lines: the plan, a rough size (small / medium / large), and which unstarted slices it could run in parallel with.
