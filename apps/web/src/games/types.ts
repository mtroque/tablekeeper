import type { Detector, GameId, ScoreBreakdown } from '@tablekeeper/core';
import type * as React from 'react';

/** The web side of a game (docs/ARCHITECTURE.md → Game modules). Game slices fill in the rest. */
export interface GameUiModule<State = unknown> {
  /** Small SVG drawn from the game's geometry and colors (docs/UX.md → Visuals). */
  Motif: React.FC<MotifProps>;
  /** Manual entry and draft review. */
  Editor?: React.FC<EditorProps<State>>;
  Breakdown?: React.FC<BreakdownProps<State>>;
  /** Lazy-loaded inside the CV worker. */
  detector?: () => Promise<Detector<State>>;
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
