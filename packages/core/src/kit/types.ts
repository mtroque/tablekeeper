import type { z } from 'zod';

/** Shared types every slice builds on. Frozen after S0: change through a shared change request. */

export type GameId = 'patchwork' | 'azul' | 'harmonies' | 'dorfromantik';

export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

// ---------- Game modules ----------

export type GameFeatures = { rules: boolean; scorer: boolean; campaign: boolean; photo: boolean };

export interface GameDefinition<State = unknown> {
  id: GameId;
  name: string;
  edition: string;
  rulebook: { publisherUrl: string; sourceKey: string };
  features: GameFeatures;
  /** Starter questions for an empty rules chat. */
  rulesStarters: string[];
  stateSchema: z.ZodType<State>;
  stateVersion: number;
  upgrade?: (state: unknown, fromVersion: number) => unknown;
  initialState: () => State;
  score?: (state: State) => ScoreBreakdown;
  campaign?: { schema: z.ZodType; initialState: () => unknown };
}

export type CellRef =
  | { kind: 'square'; row: number; col: number }
  | { kind: 'hex'; q: number; r: number }
  | { kind: 'slot'; group: string; index: number };

export type ScoreCategory = {
  key: string;
  label: string;
  points: number;
  highlights?: CellRef[];
  note?: string;
};

export type ScoreBreakdown = { total: number; categories: ScoreCategory[] };

// ---------- Vision ----------

export type Point = { x: number; y: number };

/** Corners ordered top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

/** Confidence per cell or field key, 0 to 1. */
export type ConfidenceMap = Record<string, number>;

/** `ImageData`-compatible pixels (RGBA, row-major). */
export type ImageInput = { data: Uint8ClampedArray; width: number; height: number };

export type DetectStage = 'loading-opencv' | 'finding-board' | 'classifying';

export type DetectOptions = {
  /** User-adjusted corners; skips board finding when given. */
  corners?: Quad;
  signal?: AbortSignal;
  onProgress?: (stage: DetectStage) => void;
};

export interface Draft<State> {
  state: State;
  confidence: ConfidenceMap;
  corners: Quad;
  warnings: string[];
}

export interface Detector<State> {
  detect(image: ImageInput, opts?: DetectOptions): Promise<Draft<State>>;
}

// ---------- Sessions and campaigns ----------

export type SessionStatus = 'in_progress' | 'completed';

/** Which detected values the user changed, for measuring real accuracy. */
export type DetectionMeta = {
  /** Keys (as in `ConfidenceMap`) of detected values the user corrected. */
  corrected: string[];
  /** How many values were detected. */
  detected: number;
};

export type Session<State = unknown> = {
  id: string;
  gameId: GameId;
  status: SessionStatus;
  state: State;
  stateVersion: number;
  scoreTotal: number | null;
  breakdown: ScoreBreakdown | null;
  detectionMeta: DetectionMeta | null;
  campaignId: string | null;
  /** ISO 8601. */
  playedAt: string;
};

export type SessionSummary = Pick<Session, 'id' | 'gameId' | 'status' | 'scoreTotal' | 'playedAt'>;

/** What a client sends to save a session; the server recomputes the score. */
export type SessionInput<State = unknown> = {
  gameId: GameId;
  status: SessionStatus;
  state: State;
  stateVersion: number;
  detectionMeta?: DetectionMeta;
  campaignId?: string;
  playedAt?: string;
};

export type Campaign<State = unknown> = {
  id: string;
  gameId: GameId;
  state: State;
  stateVersion: number;
  archived: boolean;
  /** ISO 8601. */
  updatedAt: string;
};
