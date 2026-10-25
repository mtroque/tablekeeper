# Tablekeeper

## About This Submission

Tablekeeper is a phone companion for physical board games. It answers rules questions from the official rulebook, scores a finished game, and keeps a history of games and campaigns. It supports four games from my own shelf (Patchwork, Azul, Harmonies, Dorfromantik), and is built for a phone on the table, so on desktop it shows as a phone-width column.

**Try it** at [tablekeeper-beryl.vercel.app](https://tablekeeper-beryl.vercel.app):

1. Open a game and ask a question in the Rules tab. The answer cites the rulebook page.
2. Score a game by hand in the Score tab, and see where every point came from.
3. Sign in with Google, save a game, then find it in History.

Everything except saving works without signing in. An ad blocker can block the health check and show "Couldn't reach the server."; the app still works.

**How it was built.** In a 2-hour timebox with Claude Code, several AI coding agents worked in parallel, each on its own copy of the repo (git worktrees). Before the timer I prepared the product, architecture and UX docs, feature specs, game rule docs checked against the official rulebooks, labeled board photos for testing photo scoring, and the agent workflow (`AGENTS.md`, `.claude/commands`). After the timer I deployed it on Vercel (web), Render (API) and Supabase (database and Google sign-in).

### What Works

- **Rules assistant** for every game, using [agentic RAG](docs/ARCHITECTURE.md#rules-assistant) instead of vector search.
- **Agentic RAG** means an AI agent reads the rulebook like a person: contents, full sections, keyword search.
- **Citations** cover only what the agent actually read, and daily limits cap AI costs.
- **Scoring** for every game, entered by hand, with a breakdown of where each point came from.
- **Accounts:** guest mode, Google sign-in, saved history and personal bests.

### Incomplete and Next

- **Photo scoring** (photograph the board, confirm a filled-in scoresheet) doesn't work yet.
- **Photo groundwork** is built: finding the board, reading each space, an accuracy check, labeled photos.
- **Photo gaps:** each game's reader, and a fix so photo reading runs in the deployed app.
- **Azul** was ruled out for photos on purpose ([why](docs/DECISIONS.md)).
- **Campaigns:** Dorfromantik games count toward a campaign, but its unlocks page isn't built.
- **Server status:** stop showing the false "Couldn't reach the server." message.
- **More games:** each game is a self-contained module, so a new game only adds its name to a few shared lists ([how](docs/ARCHITECTURE.md#game-modules)).
- **My Shelf:** signed-in users pick the games they own, and the home page shows only those.

### How to Run

See [Run locally](#run-locally) below.

### Where to Look

- [`docs/PRODUCT.md`](docs/PRODUCT.md): what the app does and why
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how it's built
- [`docs/ROADMAP.md`](docs/ROADMAP.md): feature status
- [`docs/DECISIONS.md`](docs/DECISIONS.md): key choices and why
- [`AGENTS.md`](AGENTS.md): how the AI agents were directed

**Your games stay physical. Tablekeeper takes away the friction around them.**

A phone companion for game night: rules answers cited from the official rulebook, scoring for every game (photo scoring is planned), and a history of your games and campaigns. For **Patchwork**, **Azul**, **Harmonies** and **Dorfromantik: The Board Game**; details in [`docs/PRODUCT.md`](docs/PRODUCT.md), progress in [`docs/ROADMAP.md`](docs/ROADMAP.md).

TypeScript throughout: Next.js + Tailwind + shadcn/ui (Vercel), Express 5 (Render), Supabase (Postgres, Google sign-in), opencv.js in a Web Worker, and the Anthropic API.

## Run locally

Needs Node LTS (`.nvmrc`), pnpm, Docker and the Supabase CLI.

```bash
pnpm install
cp .env.example .env.local      # fill in Google OAuth, Anthropic and IP_HASH_SALT; Supabase keys are detected
pnpm db:start                   # local Supabase in Docker
pnpm db:reset                   # migrations + seed
pnpm dev                        # web + API on the first free ports from 3000 / 4000; prints the URLs
```

Everything works as a guest. Google sign-in needs an OAuth client (`docs/DEPLOYMENT.md`). The rules assistant needs `ANTHROPIC_API_KEY` and ingested rulebooks; `LLM_PROVIDER=fake` shows the UI without a key.

### Rulebooks

The PDFs aren't in this repo. Download the official ones (URLs at the top of each `docs/games/<gameId>.md`), save them as `data/rulebooks/<gameId>.pdf`, then:

```bash
pnpm ingest <gameId>            # extract and write a review file
pnpm ingest <gameId> --load     # load the reviewed sections
```

### Commands

```bash
pnpm typecheck
pnpm lint                       # includes the UI copy rules
pnpm lint:commits               # Conventional Commits check for this branch
pnpm test                       # unit + API integration (needs local Supabase)
pnpm test:e2e                   # Playwright
pnpm db:types                   # regenerate Supabase types after a migration
pnpm eval:cv <gameId>           # board-reading accuracy on labeled photos (--calibrate to rebuild the profile)
pnpm rules:smoke <gameId> "<question>"   # one real rules-assistant call
scripts/worktrees.sh status|sync|clean|launch   # parallel Claude Code sessions (AGENTS.md)
```

## Docs

Start with [`AGENTS.md`](AGENTS.md): it's the contributor guide and lists which doc covers what.

## Acknowledgements

Patchwork © Lookout Games · Azul © Next Move / Plan B Games · Harmonies © Libellud · Dorfromantik: The Board Game © Pegasus Spiele, under license from Toukana Interactive. Tablekeeper is an unofficial fan project, not affiliated with these publishers.
