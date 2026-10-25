# Tablekeeper

> **Take-home exam.** This iteration of the repo was created within 2 hours with Claude Code, using parallel agents. The planning, documentation and fixtures were prepared before those 2 hours, and the deployment was done after them.
>
> **Live:** [tablekeeper-beryl.vercel.app](https://tablekeeper-beryl.vercel.app/). The web app is hosted on Vercel, the API on Render and the database on Supabase, with sign-in through Google OAuth. An ad blocker may make the app say "Couldn't reach the server." by blocking its health check; everything still works.

**Your games stay physical. Tablekeeper takes away the friction around them.**

A phone companion for game night: rules answers cited from the official rulebook, scoring for every game (read from a photo of your board for Patchwork and Harmonies, which you confirm), and a history of your games and campaigns. For **Patchwork**, **Azul**, **Harmonies** and **Dorfromantik: The Board Game**; details in [`docs/PRODUCT.md`](docs/PRODUCT.md), progress in [`docs/ROADMAP.md`](docs/ROADMAP.md).

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
