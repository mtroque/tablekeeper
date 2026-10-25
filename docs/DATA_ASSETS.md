# Tablekeeper: Data assets

What the app needs that isn't code, and where it goes.

## Rulebooks

Save each official PDF as `data/rulebooks/<gameId>.pdf` (gitignored, and copied into worktrees by `.worktreeinclude`). Record its publisher URL at the top of `docs/games/<gameId>.md`. Editions: Patchwork: Valentine's Day (Lookout Games), Azul: Master Chocolatier, Harmonies: Base Game (Libellud), Dorfromantik: The Board Game, Base Game, in English (Pegasus Spiele).

## Fixtures (labeled photos for CV)

```
data/fixtures/<gameId>/
  images/           photos, JPEG, longest side ≤ 1600px, ≤ 2MB each
  references/       empty-board photo(s), side references, token crops
  labels.json       ground truth (format below)
```

Fixtures are committed (they're your own photos). Keep each set small: 10-15 photos per game.

### Photo guidelines
- Phone camera, normal room lighting, no flash. Vary lighting (daylight, warm lamp) and angle (up to ~25° from straight down) across the set.
- Whole board in frame with a margin; no fingers over it.
- Patchwork: praline chits spread out next to the box board, face up, not touching; special tile with them if held. The boards are glossy, so avoid lights directly overhead. Include some photos with mild glare, some nearly full boards, and photos taken from different sides of the board.
- Azul: player board only, with the foundry line visible.
- Harmonies: straight down, whole board visible.

### `labels.json` format

Common envelope:

```json
{
  "gameId": "patchwork",
  "accuracyThreshold": 0.97,
  "items": [
    { "image": "images/01-daylight.jpg", "corners": [[x,y],[x,y],[x,y],[x,y]], "label": { } }
  ]
}
```

Labels are written with a separate local labeling tool, which computes any derived values (such as Patchwork's `expectedScore`); they are never typed by hand.

`corners` (optional) are the board's outer frame corners in original-image pixels, ordered top-left, top-right, bottom-right, bottom-left as seen in the photo, used to measure corner-finding error. Harmonies and Azul differ: their corners are in the board's own orientation (Harmonies: the board rectangle's, `docs/games/harmonies.md` → Board rectangle and grid placement; Azul: the board's outer corners, `docs/games/azul.md` → Board). `label` per game:

**Patchwork**: `grid` is 9 rows top to bottom, `#` covered, `.` empty, as the board appears in the photo after flattening (row 0 at the top), whichever way the board is turned. The whole file, with example values:
```json
{
  "gameId": "patchwork",
  "accuracyThreshold": 0.97,
  "items": [
    {
      "image": "images/01-red-white-table.jpg",
      "corners": [[395, 241], [1150, 244], [1148, 1003], [398, 1003]],
      "label": {
        "board": "red",
        "grid": ["#########", "##.######", "#########", "#####.###", "####.####", "#########", ".########", "######.##", "########."],
        "tokens": { "one": 6, "five": 3, "ten": 2, "twenty": 0 },
        "specialTile": true,
        "expectedScore": 36
      }
    }
  ]
}
```
- `tokens`: praline chits by value (1, 5, 10, 20), per `PAT-SCORE-4`.
- `expectedScore`: 1 × one + 5 × five + 10 × ten + 20 × twenty + 7 if `specialTile` − 2 × empty spaces (`PAT-SCORE-1`).

**Azul**: no score is computed, since a photo is a single round and round scores depend on the previous round. Azul has no photo detection (D-017); the labels are kept for a later attempt. The whole file, with example values:
```json
{
  "gameId": "azul",
  "accuracyThreshold": 0.98,
  "items": [
    {
      "image": "images/01-early-wall-3-first-player.jpg",
      "corners": [[x, y], [x, y], [x, y], [x, y]],
      "label": {
        "wall": ["##...", ".##..", "..#..", ".....", "#...#"],
        "floorCount": 2
      }
    }
  ]
}
```
- `wall`: the chocolate box, 5 rows top to bottom in the board's own orientation; `#` a placed tile, `.` empty.
- `floorCount`: occupied foundry line slots, 0 to 7; the starting player marker counts as a tile.
- `corners`: required; the board's 4 outer corners, top-left first and clockwise, in the board's own orientation (`docs/games/azul.md` → Board), in original-image pixels.

**Harmonies**: no score is computed. Codes are from `docs/games/harmonies.md` → Pieces, and every key is a `"q,r"` space in that side's layout, in the board's own orientation, not the photo's (`docs/games/harmonies.md` → Board layouts):
```json
{ "side": "A", "tops": { "0,0": "L", "1,0": "W" }, "stacks": { "0,0": "TTL" }, "cubes": ["0,0"], "occluded": ["2,0"] }
```
- `tops`: the visible top token of every non-empty space whose top color can be seen. A space missing from both `tops` and `occluded` is empty.
- `stacks` (optional): full stacks, bottom to top, for spaces whose stack is known. Each must be a valid stack (`HAR-STACK-*`) ending in that space's `tops` entry.
- `cubes` (optional): spaces with an animal cube on them. Cubes are translucent, so a space can be in `cubes` and still have a `tops` entry; a cube's space is in `tops` or `occluded`, never empty.
- `occluded`: spaces whose top color can't be seen at all; they have no `tops` entry.

### References
- `patchwork/references/empty-red-1.jpg` to `empty-red-3.jpg`, `empty-gray-1.jpg` to `empty-gray-3.jpg`: 3 photos of each box board, empty.
- `patchwork/references/token-1-a.jpg`, `token-1-b.jpg`, `token-5-a.jpg` to `token-20-b.jpg`, `special-tile-a.jpg`, `special-tile-b.jpg`: 2 close-ups per praline chit value (1, 5, 10, 20) and of the special tile.
- `patchwork/images/`: finished boards with their praline chits in the photo, on both boards.
- `azul/references/empty-board.jpg`: the empty board.
- `azul/images/`: boards at different stages of a game, named `NN-<description>.jpg`.
- `harmonies/references/side-a.jpg`, `side-b.jpg`: one empty board per side.
- `harmonies/images/`: finished boards on both sides, named `NN-<side>-<description>.jpg`.

## Sample photos (in-app "Try Sample Photo")

2-3 fixture photos per photo game, downscaled to ≤ 1200px, in `apps/web/public/samples/<gameId>/` and listed in the game's UI module `samples`.
