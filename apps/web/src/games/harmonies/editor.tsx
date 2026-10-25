'use client';

import {
  emptyHarmoniesState,
  HARMONIES_LAYOUTS,
  HarmoniesStateSchema,
  hexKey,
  stackName,
  type HarmoniesPiece,
  type HarmoniesState,
  type HexCell,
} from '@tablekeeper/core';
import { useState } from 'react';

import { HexGridEditor, hexPolygon } from '@/components/hex-grid-editor';
import { Button } from '@/components/ui/button';

import type { EditorProps } from '../types';

import { CardList } from './card-list';
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

/** The board side, the hex grid with a stack sheet per space, and the card lists. */
export function Editor({ state, onChange, confidence }: EditorProps<unknown>) {
  const board = asState(state);
  const layout = HARMONIES_LAYOUTS[board.side];
  const [editing, setEditing] = useState<HexCell | null>(null);
  const [showLabels, setShowLabels] = useState(false);
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
