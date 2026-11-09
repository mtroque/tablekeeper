import type { GameId, ScoreBreakdown } from '@tablekeeper/core';
import type * as React from 'react';

/** The web side of a game (docs/ARCHITECTURE.md → Game modules). Game slices fill in the rest. */
export interface GameUiModule<State = unknown> {
  /** Small SVG drawn from the game's geometry and colors (docs/UX.md → Visuals). */
  Motif: React.FC<MotifProps>;
  /** Manual entry and draft review. */
  Editor?: React.FC<EditorProps<State>>;
  Breakdown?: React.FC<BreakdownProps<State>>;
  /** Replaces the default capture → review → result flow. */
  ScoreFlow?: React.FC<ScoreFlowProps>;
  Campaign?: React.FC;
  /** Paths under /samples/<gameId>/. */
  samples?: string[];
}

export type MotifProps = { className?: string };

export type EditorProps<State> = {
  state: State;
  onChange: (state: State) => void;
  /** Confidence per cell or field key from a photo draft; absent for manual entry. */
  confidence?: Record<string, number>;
  /**
   * Reads the photo again at the same corners with a game-specific hint, replacing the board and
   * its draft. Resolves false when the reading fails. Absent without a photo (manual entry).
   */
  reread?: (hints: Record<string, string>) => Promise<boolean>;
};

export type BreakdownProps<State> = {
  state: State;
  breakdown: ScoreBreakdown;
  /** The category whose cells are highlighted. */
  selectedKey?: string;
};

export type ScoreFlowProps = {
  gameId: GameId;
  /** Path segments under /games/<gameId>/score. */
  slug: string[];
};
