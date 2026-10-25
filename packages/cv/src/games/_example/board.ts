import type { GridBoard } from '../../pipeline/board-pipeline';
import { squareGridLayout } from '../../pipeline/cells';
import { getCv, type Mat } from '../../pipeline/opencv';
import { seededRandom } from '../../pipeline/synthetic';

// The S1 example game's board as drawn for synthetic photos: a cream square with a dark frame
// and a 3×3 grid; a covered space holds a red token.

export const SIZE = 300;
export const FRAME = 18;
export const CELL = (SIZE - 2 * FRAME) / 3;

export const exampleBoard: GridBoard = {
  layout: squareGridLayout({
    rows: 3,
    cols: 3,
    origin: { x: FRAME, y: FRAME },
    cellWidth: CELL,
    cellHeight: CELL,
  }),
  canonical: { width: SIZE, height: SIZE },
  aspect: { min: 1, max: 1.35 },
  features: ['L', 'a', 'b', 'spreadL', 'edge'],
  inset: 0.25,
  minAreaRatio: 0.08,
};

const CREAM = [232, 220, 196, 255];
const FRAME_COLOR = [70, 48, 36, 255];
const LINE = [150, 120, 90, 255];
const MOTIF = [205, 186, 155, 255];
const TOKEN = [178, 58, 58, 255];
const TOKEN_EDGE = [130, 36, 36, 255];

/** Renders the canonical board (RGB, SIZE × SIZE): rows top to bottom, `true` covered. */
export function renderExampleBoard(cells: boolean[][], seed = 1): Mat {
  const cv = getCv();
  const random = seededRandom(seed);
  const board = new cv.Mat(SIZE, SIZE, cv.CV_8UC3, FRAME_COLOR);
  cv.rectangle(
    board,
    { x: FRAME, y: FRAME },
    { x: SIZE - FRAME - 1, y: SIZE - FRAME - 1 },
    CREAM,
    -1,
  );
  for (let i = 1; i < 3; i++) {
    const at = Math.round(FRAME + i * CELL);
    cv.rectangle(board, { x: at - 1, y: FRAME }, { x: at + 1, y: SIZE - FRAME }, LINE, -1);
    cv.rectangle(board, { x: FRAME, y: at - 1 }, { x: SIZE - FRAME, y: at + 1 }, LINE, -1);
  }
  cells.forEach((row, r) => {
    row.forEach((covered, c) => {
      const x = FRAME + c * CELL;
      const y = FRAME + r * CELL;
      // Every space has a faint printed ring.
      cv.circle(board, { x: x + CELL / 2, y: y + CELL / 2 }, CELL * 0.3, MOTIF, 2, cv.LINE_AA);
      if (!covered) return;
      const jitter = () => (random() - 0.5) * 8;
      const pad = 10;
      const p1 = { x: x + pad + jitter(), y: y + pad + jitter() };
      const p2 = { x: x + CELL - pad + jitter(), y: y + CELL - pad + jitter() };
      cv.rectangle(board, p1, p2, TOKEN_EDGE, -1, cv.LINE_AA);
      cv.rectangle(
        board,
        { x: p1.x + 3, y: p1.y + 3 },
        { x: p2.x - 3, y: p2.y - 3 },
        TOKEN,
        -1,
        cv.LINE_AA,
      );
    });
  });
  return board;
}
