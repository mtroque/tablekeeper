import { describe, expect, it } from 'vitest';

import {
  changedShots,
  MAX_EMBEDDED,
  renderComment,
  renderIndex,
  SCREENS_COMMENT_MARKER,
  type ShotInfo,
} from './screens-report';

const shot = (id: string, hash = id): ShotInfo => ({ id, screen: '/', state: 'default', hash });
const base = {
  rawBase: 'https://raw.example/pr-1/abc',
  folderUrl: 'https://tree.example/pr-1/abc',
  sha: 'abcdef1234',
  missing: [],
};

describe('changedShots', () => {
  it('keeps shots whose hash differs from main or that main lacks', () => {
    const baseline = new Map([
      ['a', 'a'],
      ['b', 'old'],
    ]);
    expect(changedShots([shot('a'), shot('b'), shot('c')], baseline).map((s) => s.id)).toEqual([
      'b',
      'c',
    ]);
    expect(changedShots([shot('a')], null)).toHaveLength(1);
  });
});

describe('renderComment', () => {
  it('embeds only the changed shots, two to a row, under the marker', () => {
    const body = renderComment({
      ...base,
      shots: [shot('a'), shot('b'), shot('c')],
      baseline: new Map([['a', 'a']]),
    });
    expect(body.startsWith(SCREENS_COMMENT_MARKER)).toBe(true);
    expect(body).toContain('2 of 3 screens differ from `main`.');
    expect(body).toContain('[All 3 screens](https://tree.example/pr-1/abc) at abcdef1.');
    expect(body).toContain('<img src="https://raw.example/pr-1/abc/b.png"');
    expect(body).not.toContain('/a.png');
    expect(body.split('\n').filter((line) => line.startsWith('| **'))).toHaveLength(1);
  });

  it('says when nothing changed, when there is no baseline, and which entries failed', () => {
    expect(
      renderComment({ ...base, shots: [shot('a')], baseline: new Map([['a', 'a']]) }),
    ).toContain('No screen differs from `main`.');
    const first = renderComment({ ...base, shots: [shot('a')], baseline: null, missing: ['z'] });
    expect(first).toContain('No `main` set to compare with yet');
    expect(first).toContain('**Not reached** (see the job log): `z`');
  });

  it('links the changed shots beyond the embed limit', () => {
    const shots = Array.from({ length: MAX_EMBEDDED + 2 }, (_, i) => shot(`s${String(i)}`));
    const body = renderComment({ ...base, shots, baseline: null });
    expect(body).toContain(`Also changed: [s${String(MAX_EMBEDDED)}](`);
    expect(body).not.toContain(
      `<img src="https://raw.example/pr-1/abc/s${String(MAX_EMBEDDED)}.png"`,
    );
  });
});

describe('renderIndex', () => {
  it('lists every shot with relative image paths', () => {
    expect(renderIndex([shot('a'), shot('b'), shot('c')], 'abcdef1234')).toContain(
      '<img src="./c.png"',
    );
  });
});
