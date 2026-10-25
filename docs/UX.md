# Tablekeeper: UX

Screens, routes, states and interactions.

## Principles

1. **One phone layout.** A single column, 360-430px wide, on every screen size (see Desktop). No content breakpoints.
2. **Uncertain first.** Low-confidence values are highlighted and reviewed first; manual entry is always one tap away.
3. **Explain, don't just add.** Every score has a breakdown; tapping a category highlights where its points came from.
4. **No dead ends.** Every failure (no board found, API asleep, quota used up) offers a next step.
5. **Sign-in only when it pays off:** offered at the moment of saving, history or syncing, never as a wall.

## Desktop

- The column is centered (max 430px) on the page background; nothing reflows.
- From 900px wide, a quiet side note appears beside the column: "Made for Your Phone", with a QR code that opens the current URL on a phone. Hidden on narrow screens.
- No fake phone frame around the column.

## Routes

| Route | Screen |
|---|---|
| `/` | Game library |
| `/games/[gameId]` | Redirects to the game's first tab (`score`, or `rules` if no scorer) |
| `/games/[gameId]/score` | Score home: photo / upload / manual |
| `/games/[gameId]/score/capture` | Photo + corner adjustment |
| `/games/[gameId]/score/review` | Editor with draft (or empty for manual) |
| `/games/[gameId]/score/result` | Breakdown + save |
| `/games/azul/score/[sessionId]` | Azul game in progress, round by round, entered by tap (no photo) |
| `/games/dorfromantik/score` | Dorfromantik scoresheet → unlock prompt |
| `/games/[gameId]/rules` | Rules assistant |
| `/games/[gameId]/history` | History list |
| `/games/[gameId]/history/[sessionId]` | Saved game, read-only board + breakdown |
| `/games/dorfromantik/campaign` | Campaign overview |
| `/auth/callback` | OAuth return; resumes any pending save |

Games with their own flow (Azul, Dorfromantik) render their `ScoreFlow` under `/score`; see `docs/ARCHITECTURE.md` → Game modules.

## Game hub tabs

Every game uses one tab bar built from `GameDefinition.features`, in this order: **Score · Campaign · Rules · History**. Tabs for unsupported features are not shown. Dorfromantik shows all four; the others show Score, Rules, History.

## Screen states

Every screen implements these, plus any listed in its slice spec.

| State | Treatment |
|---|---|
| Loading | Skeletons matching the layout, never a lone spinner for more than 300ms |
| API waking up (Render cold start) | "Waking up the server." with a progress hint; game library still renders from the local registry |
| Empty | Explains what goes here and offers the action that fills it |
| Error | Plain-language message + retry; never raw error codes |
| Guest | Persistence features show a sign-in prompt in place of content |
| Offline | Scorers and CV still work; saving and rules show "You're offline." |

## Key interactions

### Photo capture
- Inputs: camera (`<input type="file" accept="image/*" capture="environment">`) or gallery.
- Per-game tip banner (Patchwork: praline chits spread beside the box board; Harmonies: shoot from directly above).
- Corners are detected automatically and shown as four draggable handles on the photo, with a magnifier while dragging.
- If no board is found: default corners and a warning. The user can still continue.
- **"Try Sample Photo"** button under the inputs: loads one of the game's sample photos (`apps/web/public/samples/<gameId>/`) and runs the real pipeline, so people without the game can try photo scoring.

### Review / editor
- Low-confidence values are outlined in the warning color; a banner counts them.
- Square grid: tap toggles a cell. Hex grid (adjacency matters, so the board is always drawn as hexes, with each stack shown as its round tokens): tap opens a bottom sheet to edit the stack (bottom to top), with only valid stacks offered.
- Counters use − / + steppers with direct numeric entry on long-press.
- The running total updates live.
- "See Score" is always enabled: low-confidence values are a prompt to check, not a blocker.

### Board side switch (Harmonies)
- Empty board: switch immediately.
- Board from a photo: sheet with "Reread Photo as Side X" · "Clear Board" · "Cancel".
- Board filled manually: "Clear Board" · "Cancel".

### Board color switch (Patchwork)
- A "Red" / "Gray" switch above the grid; the grid is drawn in the chosen board's color (boards per `docs/games/patchwork.md` → Boards).
- Both boards share one layout, so the switch never needs a sheet. Board filled manually: switch immediately. Board from a photo: switch and reread the cells against the other board's references (`docs/slices/P2-patchwork-board-detection.md`).
- A low-confidence detected color is outlined like any other uncertain value.

### Breakdown
- Total in large type; one row per category with points; negative points in the error color.
- Tapping a row highlights its cells on a miniature of the board; notes explain non-obvious results.
- Save: signed in → save; guest → "Sign In with Google" (saves after the redirect) or "Don't Save".

### Rules assistant
- Official rulebook link pinned at the top of the page (opens the publisher PDF in a new tab).
- Quota pill in the header ("4 left today").
- Empty chat shows the game's starter questions.
- Answers render citation chips with the page number printed in the rulebook (`§ Section · p. 4`, or `p. 4 and 5` for a spread), or the PDF page when the rulebook prints none (Patchwork). Tapping a chip opens the official PDF at the citation's `pdfPage` (`docs/ARCHITECTURE.md` → Rules assistant).
- "Not in the Rulebook" answers use a distinct muted style and suggest the publisher FAQ.

### Dorfromantik
- Scoresheet: base fields always, unlocked rows only, each with its hint from the paper sheet (fields in `docs/games/dorfromantik.md`).
- "Finish Game" → total, rank title and "Cross off N circles on your campaign sheet." → "Any Unlocks?" picker listing every campaign-sheet item by name.
- Unlocks can be removed from the campaign page if picked by mistake.

## Design tokens

Defined as CSS variables (Tailwind theme reads them), light and dark.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f6f1e9` | `#171311` | Page |
| `--surface` | `#fffdf8` | `#221c19` | Cards, sheets |
| `--ink` | `#2b211c` | `#f1e9df` | Text |
| `--muted` | `#7a6a5f` | `#a8988b` | Secondary text |
| `--line` | `#e5dccf` | `#3a312b` | Borders |
| `--accent` | `#1f6f6b` | `#5bb5ad` | Primary actions, focus |
| `--accent-soft` | `#d7ebe8` | `#1d3533` | Info banners, chips |
| `--warn` | `#c2681b` | `#e39a55` | Low-confidence outlines |
| `--warn-soft` | `#fbe8d3` | `#3b2a1b` | Warning banners |
| `--danger` | `#c2463a` | `#e07468` | Negative points, errors |

Game piece colors live in each game's UI module.

Type via `next/font`: **Fraunces** for headings and score totals, **Atkinson Hyperlegible** for everything else (readable at arm's length on a table, and not the default template font). Scores and counts use tabular figures (`font-variant-numeric: tabular-nums`). Radius: 6px controls, 10px cards, 16px sheets; nothing is pill-shaped except the quota and status chips. Touch targets at least 44×44px.

## Components (shared, `apps/web/src/components`)

Built on shadcn/ui primitives (Button, Sheet, Dialog, Tabs, Toast, Skeleton) styled with the tokens above.

| Component | Purpose |
|---|---|
| `AppShell` | Header (title, sign-in/avatar), max-width column |
| `GameCard` | Library card with feature tags |
| `GameTabs` | Tab bar from `GameDefinition.features` |
| `PhotoCapture` | Camera/gallery input, preview |
| `CornerEditor` | Draggable quad over a photo |
| `SquareGridEditor` | N×M grid; cell renderer and tap handler supplied by the game |
| `HexGridEditor` | Hex layout from a game layout; same contract |
| `ConfidenceOutline` | Shared visual for low-confidence cells |
| `Counter` | − / + stepper |
| `BreakdownList` | Categories, totals, highlight selection |
| `BoardMiniature` | Read-only board with highlights |
| `SignInPrompt` | Contextual sign-in card |
| `ChatThread`, `CitationChip` | Rules assistant |

## Accessibility

- All interactive cells are buttons with labels ("Row 3, column 5: covered").
- Color is never the only signal: low confidence also gets a dashed outline; Harmonies cells show a letter on request ("Show Labels" toggle).
- Respect `prefers-reduced-motion`; keyboard operable on desktop.

## Look and voice

The app should feel made by someone who plays these games, not generated from a template. These are requirements; `pnpm lint` enforces the ones marked (lint).

### Words

- **No em or en dashes in any user-facing text (lint).** Use a period, comma, colon or parentheses. Ranges use "to" ("2 to 4 players").
- **No emoji in the interface (lint).** Meaning comes from words, icons from one set (Lucide, 1.5px stroke), and only where an icon helps recognition.
- **Short labels in Title Case.** Buttons, tabs, screen titles, section headings, chips and menu items are 1 to 3 words in Title Case (small words like "a", "to", "of" stay lowercase): "Save Game", "Review Board", "Any Unlocks?". Full sentences are only for messages and body text, and stay short. No exclamation marks.
- **Say the specific thing.** "3 spaces to check.", not "Some items need your attention". "Couldn't reach the server. Try again." not "Oops! Something went wrong."
- **Buttons name the action:** "Save Game", "Confirm Round", "Read Board". Never "Submit", "Continue" or "Get Started".
- **The players' words:** each edition's own terms, from its rulebook (the vocabulary tables in `docs/games/<gameId>.md`): the box board, spaces, chocolate pieces, pralines and petits fours in Patchwork: Valentine's Day; the chocolate box, foundry line and starting player marker in Azul: Master Chocolatier; task markers in Dorfromantik. Numbers as numerals.
- **Don't advertise the machinery.** No "AI", "smart", "magic", "powered by", sparkles or "✨". The rules tab is called "Rules"; answers are labeled "From the Rulebook".
- **Banned filler** (lint, case-insensitive): "seamless", "effortless", "elevate", "unlock the power", "dive in", "let's get started", "oops", "you're all set", "game-changer", "supercharge", "in just a few clicks".
- Rules-assistant answers follow the same style (enforced in its prompt, `docs/ARCHITECTURE.md` → Rules assistant).

| Instead of | Write |
|---|---|
| Welcome to Tablekeeper! 🎲 | Your Games |
| Snap a pic and let AI do the rest ✨ | Take Photo |
| Let's review what we found | Review Board |
| Oops! We couldn't detect your board. | Couldn't find the board edges. Drag the corners into place. |
| Your score is ready! | 36 Points |
| Unlock achievements as you play | Any Unlocks? |
| Great question! Here's what the rulebook says — | Yes. You collect pralines each time your heart token moves past a praline symbol, whichever action you take. |

### Visuals

- **Each game has its own look, drawn not borrowed.** Publisher art can't be used, so every game card and header gets a small SVG motif drawn from its geometry in that game's own colors: a Valentine's chocolate box of pralines for Patchwork, a chocolate box of square chocolates for Azul: Master Chocolatier, round tokens sitting on a hex grid for Harmonies, and landscape hexes for Dorfromantik. Patchwork and Azul share a chocolate palette (dark, milk and white chocolate, caramel, Valentine's pink). No gradient placeholders, no stock illustrations.
- **The board is the hero.** Editors and breakdowns get the screen width; chrome stays thin.
- **Flat and bordered.** 1px `--line` borders separate things. Shadows only on things that float (sheets, the dragged corner handle). No glassmorphism, glows, blurred blobs or gradient text.
- **Warm palette from the tokens.** No purple or indigo, no blue-to-purple gradients, no neon accents.
- **Left-aligned text.** Centered text only for the big score total and empty states.
- **No card inside a card.** A screen is a column of sections, not a stack of boxes.
- **Restyle shadcn**, don't ship its defaults: tokens, radii and focus ring from this file.
- **Calm motion:** 150 to 200ms ease-out for sheets and highlights; no bouncing, confetti or count-up animations (a Dorfromantik unlock gets one short highlight, nothing more). Respect `prefers-reduced-motion`.
- **Empty states are one plain sentence and the action that fills them**, not an illustration.
