# Dorfromantik: The Board Game

**Official rulebook:** https://cdn.pegasus.de/public/media/14/0f/e2/1717757209/4250231735486_en-min.pdf?ts=1752574415 (English rulebook v1.1, Pegasus Spiele; their download page also lists the score pad and campaign pad). The rulebook reproduces the scoresheet and campaign sheet.

**Page numbers:** printed page numbers match PDF pages (8 pages, cover is p. 1).

## What the app replaces

- **Scoresheet** (one per game): base fields + section E rows for unlocked components.
- **Campaign sheet**: high-score list, unlock checklist. The advancement track (crossing off circles) stays on paper; the app tells the player how many circles to cross off and asks what they unlocked.

## Scoresheet

| ID | Field (sheet label) | Input | Points |
|---|---|---|---|
| DOR-A | Game number | In the game state: the campaign's games played + 1 | - |
| DOR-F | Player names | In the game state (`players`), optional | - |
| DOR-G | Date | The session's `played_at`, not part of the game state | - |
| DOR-B1..B5 | Completed tasks: Forest, Grain, Village, Track, Stream | Sum of completed task marker values per type | As entered |
| DOR-S1 | Tasks subtotal | - | B1 + … + B5 |
| DOR-C1..C3 | Flags: green (forest), yellow (grain), red (village) | Sum of tile counts of **closed** territories containing a flag of that color | As entered |
| DOR-D1, D2 | Longest track, longest stream | Tiles in the longest unbroken track / stream | As entered |
| DOR-S2 | Flags + longest subtotal | - | C1 + C2 + C3 + D1 + D2 |
| DOR-E | Unlocked components (rows below), only rows for unlocked items are shown | per row | - |
| DOR-S3 | Unlocked components subtotal | - | Sum of E rows |
| DOR-H | Total | - | S1 + S2 + S3 |

Task markers have values 4, 5, 6 (5 per color: one 4, two 5s, two 6s). Value-7 task markers are unlocked later: Box 3's component card lists "3 value 7 Task markers & 3 wooden Red Hearts", and the Castle, Deer and Farm achievements each add one.

### Section E rows (scoresheet hint in quotes)

Each row's input is a count; points = count × multiplier (Circus is a yes/no worth 10).

| ID | Row | Sheet hint | Input | × |
|---|---|---|---|---|
| DOR-E-GOLDHEART | Golden Heart | "2/matching edge" | matching edges | 2 |
| DOR-E-BALLOON | Balloon Launch Site | "2/distance" | distance | 2 |
| DOR-E-CONSTRUCTION | Construction Site | "per territory 7+ = 7" | territories of 7+ tiles | 7 |
| DOR-E-HILL | Hill | "at distance 2 = 2/Task tile" | task tiles at distance 2 | 2 |
| DOR-E-SHEPHERDESS | Shepherdess | "1/Sheep" | sheep | 1 |
| DOR-E-SIGNALMAN | Signalman | "2/Grade Crossing" | grade crossings | 2 |
| DOR-E-CIRCUS | Circus | "completely surrounded = 10" | yes / no | 10 |
| DOR-E-REDHEARTS | Red Hearts | "1/matching edge" | matching edges (all red hearts) | 1 |
| DOR-E-HARBOR | Harbor | "closed off = 1/tile" | tiles | 1 |
| DOR-E-TRAINSTATION | Train Station | "closed off = 1/tile" | tiles | 1 |
| DOR-E-SHIP | Ship | "(task) Tasks" | value of task markers scored again | 1 |
| DOR-E-LOCOMOTIVE | Locomotive | "(task) Tasks" | value of task markers scored again | 1 |
| DOR-E-WATCHTOWER | Watchtower | "(task) Tasks" | value of task markers scored again | 1 |
| DOR-E-HARVEST | Harvest Festival | "(task) Tasks" | value of task markers scored again | 1 |
| DOR-E-CABIN | Forest Cabin | "(task) Tasks" | value of task markers scored again | 1 |

Full rules for each component are on its achievement card.

## Campaign sheet unlockables

| ID | Item | Section on sheet | Adds a scoresheet row |
|---|---|---|---|
| DOR-U-BOX1, BOX2 | Open Box 1, Open Box 2 | Advancement track (green hexes 1, 2) | - |
| DOR-U-CASTLE | Castle | Achievements (Box 3) | - (value-7 task) |
| DOR-U-CIRCUS | Circus | Achievements | Circus |
| DOR-U-CLOUDS | Clouds | Achievements | - |
| DOR-U-DEER | Deer | Achievements | - (value-7 task) |
| DOR-U-FARM | Farm | Achievements | - (value-7 task) |
| DOR-U-FTUNNEL | Forest Tunnel | Achievements | - |
| DOR-U-GTUNNEL | Grain Tunnel | Achievements | - |
| DOR-U-HILL | Hill | Achievements | Hill |
| DOR-U-SHEPHERDESS | Shepherdess | Achievements | Shepherdess |
| DOR-U-SIGNALMAN | Signalman | Achievements | Signalman |
| DOR-U-VTUNNEL | Village Tunnel | Achievements | - |
| DOR-U-WAREHOUSE | Warehouse | Achievements | - |
| DOR-U-BALLOON | Balloon Launch Site | Boxes | Balloon Launch Site |
| DOR-U-CONSTRUCTION | Construction Site | Boxes | Construction Site |
| DOR-U-FLAGFEST | Flag Festival | Boxes | - |
| DOR-U-CABIN | Forest Cabin | Boxes | Forest Cabin |
| DOR-U-GOLDHEART | Golden Heart | Boxes | Golden Heart |
| DOR-U-HARBOR | Harbor | Boxes | Harbor |
| DOR-U-HARVEST | Harvest Festival | Boxes | Harvest Festival |
| DOR-U-HEARTSDESIRE | Heart's Desire | Boxes | - |
| DOR-U-LOCOMOTIVE | Locomotive | Boxes | Locomotive |
| DOR-U-ROAD | On the Road to Success | Boxes | - |
| DOR-U-REDHEART | Red Hearts | Boxes (one checkbox) | Red Hearts (from the first heart) |
| DOR-U-SHIP | Ship | Boxes | Ship |
| DOR-U-TRAINSTATION | Train Station | Boxes | Train Station |
| DOR-U-WATCHTOWER | Watchtower | Boxes | Watchtower |

- **Boxes:** the first green hex on the advancement track opens Box 1, the second opens Box 2, and every other green hex unlocks a named achievement card from Box 3. Boxes 4 and 5 are opened through achievement cards (an unlocked card says, for example, "You may now open Box 4").
- **Red Hearts:** the campaign sheet has one "Red Hearts" checkbox, but up to 3 wooden hearts. Each comes from crossing off one of 3 marked white circles on the advancement track (the hearts are stored in Box 3). The first heart ticks the checkbox and adds the scoresheet row; every heart then scores on that row.

## High-score table

After each game, round the total down to the table row; the player crosses off that many circles on the paper advancement track.

| Score from | Title | Circles |
|---|---|---|
| 0 | Vagabond | 1 |
| 100 | Newsboy | 2 |
| 110 | Fisherwoman | 3 |
| 120 | Coachman | 3 |
| 130 | Night Watchman | 4 |
| 140 | Actress | 4 |
| 150 | Landlady | 5 |
| 160 | Forest Ranger | 5 |
| 170 | Farmer's Wife | 6 |
| 180 | Engineer | 6 |
| 190 | Ringmaster | 7 |
| 200 | Captain | 7 |
| 210 | Harbormaster | 8 |
| 220 | Station Master | 8 |
| 230 | Photographer | 9 |
| 240 | Merchant | 9 |
| 250 | Architect | 10 |
| 260 | Inventor | 10 |
| 270 | Astronomer | 11 |
| 280 | Doctor | 11 |
| 290 | Diplomat | 12 |
| 300 | Balloonist | 12 |
| 310 | Manufacturer | 13 |
| 320 | Mayor | 13 |
| 330 | Councilor | 14 |
| 340 | Magnate | 14 |
| 350 | Baroness | 15 |
| 375 | Crown Prince | 15 |
| 400 | Empress | 15 |

## Worked examples (use as tests)

| Input | Expected |
|---|---|
| Rulebook example: tasks total 42, yellow flag 5, longest track 8, longest stream 5, nothing unlocked | S1 42, S2 18, total **60** |
| Total 128 | row 120 → Coachman, 3 circles |
| Total 142 | Actress, 4 circles |
| Total 99 | Vagabond, 1 circle |
| Circus unlocked, surrounded: yes | E +10 |
| Red Hearts unlocked, 6 matching edges | E +6 |

## State

- Campaign: `{ unlocked: UnlockId[], redHearts: 0..3, unlockLog: Array<{ id, gameNumber }>, games: Array<{ sessionId, gameNumber, total }> }`. `redHearts` counts the hearts from the advancement track; `DOR-U-REDHEART` is in `unlocked` once it's 1 or more.
- Game: `{ gameNumber, tasks: {forest, grain, village, track, stream}, flags: {green, yellow, red}, longest: {track, stream}, extras: Partial<Record<ExtraRowId, number | boolean>>, players?: string[] }`.
