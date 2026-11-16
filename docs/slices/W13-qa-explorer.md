# W13: Exploratory QA

**Status:** ⬜ · **Depends on:** W7, W10

**Goal:** An agent uses the app like a player, walking W10's screen map and then exploring, and files GitHub issues for what it finds, each with steps and a screenshot. It doesn't fix anything; the owner decides which findings go into W14's queue.

## Owns
- `.agents/skills/qa/SKILL.md`, `.github/workflows/qa.yml`, `.github/qa-mcp.json` (CI-only MCP config), `scripts/qa/` (issue filing and dedup) with tests
- `.github/ISSUE_TEMPLATE/qa.md`, `README.md`, `docs/AUTOMATION.md` (QA in Agents and budget)

## Scope
- **Target:** the app started inside the job, in the same environment as W7's `E2E` job (local Postgres, `LLM_PROVIDER=fake`, test JWTs), not a Vercel preview. Previews have no database or secrets by design (production-only env vars, X2), so they can't show signed-in screens. Guest and seeded test users only; never real accounts or production.
- **Agent:** Claude Code headless with the `reviewer` model from `.github/factory/config.json` (W14), driving a browser through the Playwright MCP server, configured only in `.github/qa-mcp.json` and passed with `--mcp-config` (so interactive sessions don't change). Phone viewport 390×844.
- **Walk:** every W10 map entry first, checking console errors, failed requests, layout overflow at 390px, copy against `docs/UX.md` → Look and voice, and that each shared state looks as `docs/UX.md` → Screen states describes. Then free exploration of the main flows (score a game by hand, rules question, history, campaign) within the step budget.
- **Budget:** at most 150 tool calls and 30 minutes per run; it stops cleanly and reports what it covered. Runs weekly (Wednesday) and on demand.
- **Issues:** one per distinct problem, from `.github/ISSUE_TEMPLATE/qa.md`: what's wrong, steps, expected, actual, route and state, screenshot embedded from the orphan `screens` branch under `qa/<date>/` (as in W10). Labeled `qa`, not `agent-ready`: the owner triages and adds `agent-ready` to send one to the factory.
- **Dedup:** each issue carries a hidden marker `<!-- qa:<route>:<state>:<kind> -->`; `scripts/qa/` skips a finding whose marker matches an open `qa` issue and comments "still seen on <date>" instead.

## Acceptance criteria
- [ ] A manual run files real issues (or reports none) with steps and a screenshot (link them)
- [ ] A second run straight after files no duplicates and comments on the issues it sees again
- [ ] The run stops within its budget and lists what it covered in the job summary

## Tests
- Dedup: same marker skipped, different state filed, closed issue doesn't block a new one.
- Issue body built from a finding matches the template.

## Out of scope
- Fixing (W14 once the owner labels an issue). Production monitoring.

## Open questions

## Decisions
- Runs against the app inside CI, not Vercel previews: previews can't reach a database by design.
- Depends on W7 (its environment) instead of W4, which is done.

## Corrections

## Shared change requests
