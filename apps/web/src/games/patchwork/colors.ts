import type { PatchworkBoard } from '@tablekeeper/core';

/** The two box boards, sampled from the empty references (docs/games/patchwork.md → Boards). */
export const BOARD_COLORS: Record<PatchworkBoard, { space: string; frame: string; line: string }> =
  {
    red: { space: '#a8456a', frame: '#6c2440', line: '#83304f' },
    gray: { space: '#c7cacf', frame: '#8e9299', line: '#a5a9b0' },
  };

/** A chocolate piece covering a space. */
export const CHOCOLATE = { piece: '#5a3526', shine: '#8a5a3c' };

export const BOARD_NAMES: Record<PatchworkBoard, string> = { red: 'Red', gray: 'Gray' };

/**
 * The edge drawn inside a piece read from the photo: its own color darkened (or lightened, for a
 * dark piece), so neighboring pieces stay apart and a covered space never looks like bare board.
 */
export function pieceEdge(hex: string): string {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luma = 0.299 * (rgb[0] ?? 0) + 0.587 * (rgb[1] ?? 0) + 0.114 * (rgb[2] ?? 0);
  const toward = luma > 90 ? 0 : 255;
  return `#${rgb
    .map((c) =>
      Math.round(c + (toward - c) * 0.35)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/**
 * Chocolate hatching over a piece whose photo color looks like the empty board: covered, but
 * likely misread.
 */
export const LOOKS_EMPTY_HATCH = `repeating-linear-gradient(45deg, ${CHOCOLATE.piece} 0 2px, transparent 2px 6px)`;
