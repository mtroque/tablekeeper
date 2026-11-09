# Tablekeeper

**Your games stay physical. Tablekeeper takes away the friction around them.**

A phone companion for game night: rules answers cited from the official rulebook, scoring for every game, and a history of your games and campaigns. It supports **Patchwork**, **Azul**, **Harmonies** and **Dorfromantik: The Board Game**, and is built for a phone on the table, so on desktop it shows as a phone-width column.

**Try it** at [tablekeeper-beryl.vercel.app](https://tablekeeper-beryl.vercel.app):

1. Open a game and ask a question in the Rules tab. The answer cites the rulebook page.
2. Score a game by hand in the Score tab, and see where every point came from.
3. Sign in with Google, save a game, then find it in History.

Everything except saving works without signing in.

## Features

- **Rules assistant** for every game. An agent reads the rulebook like a person (contents, whole sections, keyword search) instead of vector search ([how](docs/ARCHITECTURE.md#rules-assistant)). Citations cover only what it actually read, and daily limits cap AI costs.
- **Scoring** for every game, by hand, with a breakdown of where each point came from.
- **Photo scoring** for Patchwork and Harmonies: the app finds the board, reads it in the browser, and shows a draft to confirm. Azul is manual only on purpose (D-017 in [`docs/DECISIONS.md`](docs/DECISIONS.md)).
- **Dorfromantik campaign:** the scoresheet shows only what you've unlocked, and the app tracks unlocks and your rank.
- **Accounts:** guest mode, Google sign-in, saved history and personal bests.

What's built and what's next: [`docs/ROADMAP.md`](docs/ROADMAP.md). What the app does and for whom: [`docs/PRODUCT.md`](docs/PRODUCT.md).

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
pnpm test:build                 # production build of the web app, then S4's e2e test against it
pnpm db:types                   # regenerate Supabase types after a migration
pnpm eval:cv <gameId>           # board-reading accuracy on labeled photos (--calibrate to rebuild the profile)
pnpm rules:smoke <gameId> "<question>"   # one real rules-assistant call
scripts/worktrees.sh status|sync|clean|launch   # parallel Claude Code sessions (AGENTS.md)
```

## Docs

Start with [`AGENTS.md`](AGENTS.md): it's the contributor guide (features are built in slices by Claude Code agents, in parallel worktrees) and lists which doc covers what.

## Acknowledgements

Patchwork © Lookout Games · Azul © Next Move / Plan B Games · Harmonies © Libellud · Dorfromantik: The Board Game © Pegasus Spiele, under license from Toukana Interactive. Tablekeeper is an unofficial fan project, not affiliated with these publishers.
