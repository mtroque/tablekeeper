'use client';

import {
  initialPatchworkState,
  PATCHWORK_BOARDS,
  PATCHWORK_FIELD_KEYS,
  PATCHWORK_LAYOUT,
  PatchworkStateSchema,
  patchworkPralines,
  PRALINE_CHITS,
  SPECIAL_TILE_POINTS,
  type PatchworkState,
  type SquareCell,
} from '@tablekeeper/core';

import { ConfidenceOutline, isLowConfidence } from '@/components/confidence-outline';
import { Counter } from '@/components/counter';
import { SquareGridEditor } from '@/components/square-grid-editor';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { EditorProps } from '../types';

import { BOARD_COLORS, BOARD_NAMES, CHOCOLATE } from './colors';

function asState(state: unknown): PatchworkState {
  const parsed = PatchworkStateSchema.safeParse(state);
  return parsed.success ? parsed.data : initialPatchworkState();
}

const index = ({ row, col }: SquareCell) => row * 9 + col;

/**
 * The box board (tap a space to cover or uncover it) in the chosen board's color, the praline
 * chits held and the special tile.
 */
export function Editor({ state, onChange, confidence }: EditorProps<unknown>) {
  const current = asState(state);
  const { board, grid, tokens, specialTile } = current;
  const colors = BOARD_COLORS[board];
  const update = (patch: Partial<PatchworkState>) => {
    onChange({ ...current, ...patch });
  };
  const setAll = (covered: boolean) => {
    update({ grid: grid.map(() => covered) });
  };
  const emptyCount = grid.filter((covered) => !covered).length;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold">Box Board</h3>
          <ConfidenceOutline confidence={confidence?.[PATCHWORK_FIELD_KEYS.board]}>
            <div role="group" aria-label="Box Board Color" className="flex gap-1">
              {PATCHWORK_BOARDS.map((option) => (
                <Button
                  key={option}
                  size="small"
                  variant={option === board ? 'primary' : 'secondary'}
                  aria-pressed={option === board}
                  onClick={() => {
                    if (option !== board) update({ board: option });
                  }}
                >
                  <span
                    aria-hidden
                    className="size-3 rounded-[3px] border border-ink/20"
                    style={{ backgroundColor: BOARD_COLORS[option].space }}
                  />
                  {BOARD_NAMES[option]}
                </Button>
              ))}
            </div>
          </ConfidenceOutline>
        </div>
        <div
          className="rounded-card p-1.5"
          style={{ backgroundColor: colors.frame }}
          data-board={board}
        >
          <SquareGridEditor
            layout={PATCHWORK_LAYOUT}
            label={`${BOARD_NAMES[board]} Box Board`}
            className="gap-0.5 [&>button]:min-h-0"
            confidence={confidence}
            cellLabel={(cell) =>
              `Row ${cell.row + 1}, column ${cell.col + 1}: ${grid[index(cell)] ? 'covered' : 'empty'}`
            }
            renderCell={(cell) => (
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center"
                style={{ backgroundColor: colors.space }}
              >
                {grid[index(cell)] && (
                  <span
                    className="size-full border-2"
                    style={{ backgroundColor: CHOCOLATE.piece, borderColor: CHOCOLATE.shine }}
                  />
                )}
              </span>
            )}
            onTap={(ref) => {
              if (ref.kind !== 'square') return;
              const next = [...grid];
              next[index(ref)] = !next[index(ref)];
              update({ grid: next });
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted tabular" data-testid="empty-count">
            {emptyCount} empty {emptyCount === 1 ? 'space' : 'spaces'}
          </p>
          <div className="flex gap-1">
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                setAll(true);
              }}
            >
              All Covered
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                setAll(false);
              }}
            >
              All Empty
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-semibold">Praline Chits</h3>
          <p className="text-sm text-muted tabular" data-testid="pralines-held">
            {patchworkPralines(tokens)} pralines
          </p>
        </div>
        {PRALINE_CHITS.map((chit) => (
          <Counter
            key={chit.key}
            label={`Chits of ${chit.value}`}
            value={tokens[chit.key]}
            max={chit.inBox}
            uncertain={isLowConfidence(confidence?.[PATCHWORK_FIELD_KEYS.token(chit.key)])}
            onChange={(value) => {
              update({ tokens: { ...tokens, [chit.key]: value } });
            }}
          />
        ))}
      </section>

      <section className="border-t border-line pt-4">
        <ConfidenceOutline confidence={confidence?.[PATCHWORK_FIELD_KEYS.specialTile]}>
          <button
            type="button"
            role="switch"
            aria-checked={specialTile}
            className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
            onClick={() => {
              update({ specialTile: !specialTile });
            }}
          >
            <span className="flex flex-col">
              <span className="text-[15px]">Special Tile</span>
              <span className="text-sm text-muted">
                Worth {SPECIAL_TILE_POINTS}. Only the first to fill a 7×7 square holds it.
              </span>
            </span>
            <span
              aria-hidden
              className={cn(
                'relative h-7 w-12 shrink-0 rounded-control border transition-colors duration-150 ease-calm',
                specialTile ? 'border-accent bg-accent' : 'border-line bg-bg',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-5.5 rounded-[4px] bg-surface transition-[left] duration-150 ease-calm',
                  specialTile ? 'left-[calc(100%-1.5rem)]' : 'left-0.5',
                )}
              />
            </span>
          </button>
        </ConfidenceOutline>
      </section>
    </div>
  );
}
