import type { AzulColor } from '@tablekeeper/core';

/** Tile colors on screen (docs/games/azul.md → Wall: how they look). */
export const TILE_FILL: Record<AzulColor, string> = {
  teal: '#7cc4cf',
  brown: '#b88a5e',
  white: '#f1e6d2',
  black: '#3b2219',
  red: '#b8203f',
};

/** Spoken and written color names. */
export const TILE_NAME: Record<AzulColor, string> = {
  teal: 'teal',
  brown: 'brown',
  white: 'white',
  black: 'black',
  red: 'red',
};

/** The chocolate box tray and the edge of a tile. */
export const BOX_FILL = '#5a3a2a';
export const TILE_EDGE = '#2b1a12';
