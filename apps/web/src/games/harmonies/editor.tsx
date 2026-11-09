'use client';

import {
  emptyHarmoniesState,
  HARMONIES_LAYOUTS,
  HarmoniesStateSchema,
  hexKey,
  stackName,
  type HarmoniesPiece,
  type HarmoniesSide,
  type HarmoniesState,
  type HexCell,
  type Quad,
} from '@tablekeeper/core';
import { useState } from 'react';

import { HexGridEditor, hexPolygon } from '@/components/hex-grid-editor';
import { photoPixels } from '@/components/score-flow/photo';
import { useFlow } from '@/components/score-flow/use-flow';
import { Button } from '@/components/ui/button';

import type { EditorProps } from '../types';

import { CardList } from './card-list';
import { HeightPrompts } from './height-prompts';
import { SPACE_FILL, StackTokens } from './pieces';
import { SideSwitch } from './side-switch';
import { StackSheet } from './stack-sheet';

function asState(state: unknown): HarmoniesState {
  const parsed = HarmoniesStateSchema.safeParse(state);
  return parsed.success ? parsed.data : emptyHarmoniesState();
}

/** "Column 2, Space 3": the column from the left and the space down it, both from 1. */
export function spaceName({ q, r }: HexCell): string {
  return `Column ${q + 1}, Space ${r + Math.floor(q / 2) + 1}`;
}

/**
 * Confidence key a photo draft gives a space whose height it couldn't see (the detector's
 * `heightKey`, kept here so the editor doesn't load the detector).
 */
const heightKey = (key: string) => `${key}:height`;

/**
 * The board side, the hex grid with a stack sheet per space, the heights a photo couldn't see,
 * and the card lists.
 */
export function Editor({ state, onChange, confidence }: EditorProps<unknown>) {
  const board = asState(state);
  const layout = HARMONIES_LAYOUTS[board.side];
  const [editing, setEditing] = useState<HexCell | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const flow = useFlow('harmonies');
  const photoFlow = flow.flow?.source === 'photo' && flow.flow.photo && flow.flow.corners;

  /** "Reread Photo as Side X": reads the same photo at the same corners as the other side. */
  const reread = async (side: HarmoniesSide): Promise<boolean> => {
    const current = flow.flow;
    if (!current?.photo || !current.corners) return false;
    try {
      const [pixels, detection] = await Promise.all([
        photoPixels(current.photo),
        import('@tablekeeper/cv/games/harmonies'),
      ]);
      const draft = detection.rereadAsSide(pixels, current.corners as Quad, side);
      const { spiritCards } = board;
      flow.setFlow({
        ...current,
        state: {
          ...draft.state,
          animalCards: board.animalCards,
          ...(spiritCards ? { spiritCards } : {}),
        },
        draft: { state: draft.state, confidence: draft.confidence },
      });
      return true;
    } catch (error) {
      console.error('Rereading the photo failed', error);
      return false;
    }
  };
  const stackAt = (cell: HexCell): HarmoniesPiece[] => board.stacks[hexKey(cell.q, cell.r)] ?? [];

  const setStack = (cell: HexCell, stack: HarmoniesPiece[]) => {
    const key = hexKey(cell.q, cell.r);
    const { [key]: _old, ...rest } = board.stacks;
    onChange({ ...board, stacks: stack.length > 0 ? { ...rest, [key]: stack } : rest });
  };

  return (
    <div className="flex flex-col gap-4">
      <SideSwitch
        side={board.side}
        boardEmpty={Object.keys(board.stacks).length === 0}
        onSwitch={(side) => {
          onChange({ ...board, side, stacks: {} });
        }}
        onReread={photoFlow ? reread : undefined}
      />
      <HexGridEditor
        key={board.side}
        layout={layout}
        label={`Board, Side ${board.side}`}
        confidence={confidence}
        cellLabel={(cell) => `${spaceName(cell)}: ${stackName(stackAt(cell)).toLowerCase()}`}
        renderCell={(cell, { cx, cy, size }) => (
          <>
            <polygon points={hexPolygon(cx, cy, size)} fill={SPACE_FILL} />
            <StackTokens stack={stackAt(cell)} cx={cx} cy={cy} size={size} showLabel={showLabels} />
          </>
        )}
        onTap={(ref) => {
          if (ref.kind === 'hex') setEditing({ q: ref.q, r: ref.r });
        }}
      />
      <Button
        variant="quiet"
        size="small"
        className="self-start"
        aria-pressed={showLabels}
        onClick={() => {
          setShowLabels(!showLabels);
        }}
      >
        {showLabels ? 'Hide Labels' : 'Show Labels'}
      </Button>
      <HeightPrompts
        cells={layout.cells}
        asks={(key) => confidence?.[heightKey(key)] !== undefined}
        stackAt={stackAt}
        spaceName={spaceName}
        onPick={setStack}
      />
      <StackSheet
        space={editing ? spaceName(editing) : null}
        current={editing ? stackAt(editing) : []}
        onPick={(stack) => {
          if (editing) setStack(editing, stack);
          setEditing(null);
        }}
        onClose={() => {
          setEditing(null);
        }}
      />
      <CardList
        title="Animal Cards"
        item="Animal Card"
        empty="Add each animal card you completed with the points it shows."
        cards={board.animalCards}
        onChange={(animalCards) => {
          onChange({ ...board, animalCards });
        }}
      />
      <CardList
        title="Nature's Spirit Cards"
        item="Spirit Card"
        empty="Playing with Nature's Spirit cards? Add each one with the points its rule gives."
        cards={board.spiritCards ?? []}
        onChange={(spiritCards) => {
          const { spiritCards: _old, ...rest } = board;
          onChange(spiritCards.length > 0 ? { ...rest, spiritCards } : rest);
        }}
      />
    </div>
  );
}
