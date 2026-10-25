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
