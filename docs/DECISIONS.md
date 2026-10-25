# Tablekeeper: Decisions

Why things are the way they are. Add new entries and supersede old ones rather than rewriting them; git history records when. Details live in the docs each entry points to.

| ID | Decision | Why |
|---|---|---|
| D-001 | Board reading uses classic CV (opencv.js) in the browser, not a vision LLM | Fixed, known layouts make it a per-cell classification problem: free, offline, deterministic, measurable. A VLM costs per call and is weak at precise grid positions and counting. |
| D-002 | Every detected value is a draft with confidence; everything is editable; manual entry always available | Photos vary; a 97%-right scorer is useful only if the rest is quick to fix. Corrections are logged to measure real accuracy. |
| D-003 | Rules assistant navigates the rulebook with tools (table of contents, read section, full-text search), no embeddings | Rulebooks are short and structured; whole sections answer better than chunks, citations map to pages, and no vector store is needed. |
| D-004 | Rulebook PDFs stay out of git; extracted text lives in the database; the app links to the official PDF | Respects publishers' copyright in a public repo. |
| D-005 | Separate Express API (Render) and Next.js web (Vercel) sharing `packages/core` | Clear frontend/backend boundary; the API owns secrets, quotas and persistence; scoring is shared so the UI and API agree. Express over Hono for familiarity. Render's free tier sleeps, hence the keep-alive. |
| D-006 | Guests can use everything; sign-in (Google via Supabase) saves it; guest data isn't imported on sign-in | No login wall; one-tap sign-in when it adds value; less to build. |
| D-007 | Layered LLM protection: kill switch, global budget, per-user and per-IP quotas, rate limit, per-call caps, provider spend limit | The app is public; nobody should be able to exhaust the API budget. |
| D-008 | Games are modules in their own folders, pre-registered; shared code never branches on game id | Adding a game touches only its folders, which also lets one session build each game in parallel. |
| D-009 | Dorfromantik: the player reports unlocks; the advancement track isn't modeled | Unlock conditions differ per item and the track involves choices; asking is simpler and never wrong. |
| D-010 | One phone layout on every screen size, with a QR side note on desktop | It's a table-side companion; one layout halves UI work. A fake phone frame would read as a mockup. |
| D-011 | Each photo game ships sample photos ("Try Sample Photo") | Most visitors don't own the game. |
| D-012 | Tailwind + shadcn/ui over Material UI | The key screens are custom board editors; owned component code is easy to edit; avoids a Material look. |
| D-013 | Parallel work uses Claude Code's built-in worktrees, automatic ports and five generic commands; the definition of done lives in AGENTS.md | Less tooling to maintain; the same workflow works for any future slice. |
| D-014 | UI text and visuals follow written "look and voice" rules (no dashes, emoji, filler or AI branding; short Title Case labels; drawn game motifs; flat warm styling), with the mechanical ones linted | The app should read as made by a player, not generated from a template. |
| D-015 | Conventional Commits are part of the definition of done, enforced by a commit-msg hook and a branch check | Readable history and scoped commits make parallel merges and reviews easier. |
| D-016 | Patchwork supports the red and gray boards; the board color is detected and switchable; each cell is compared against that board's empty references at all four rotated positions, so the board's orientation isn't needed | The boards have printed shading that varies by position, and a nearly full board doesn't show enough empty cells to tell which way it's turned. Details: `docs/games/patchwork.md` → Boards, `docs/slices/P2-patchwork-board-detection.md`. |
| D-017 | Azul photo detection (A2) is deferred; Azul is a manual round-by-round tracker (A1); its fixtures are still labeled for a later attempt | The Master Chocolatier wall prints each chocolate's image on its space, so empty and occupied spaces look alike in a photo. Details: `docs/games/azul.md` → Board, `docs/slices/A2-azul-detection.md`. |
