import { describe, expect, it } from 'vitest';

import { ReviewFileSchema, toLoadArgs } from './review-file.ts';
import { RULEBOOK_LAYOUTS } from './rulebook-layouts.ts';
import { formatPrinted, splitNumber, splitSections, titleCase } from './sections.ts';

const pages = [
  { page: 1, width: 600, height: 800 },
  { page: 2, width: 600, height: 800 },
];
const run = (page, x, y, text, size = 10, font = 'body') => ({
  page,
  x,
  y,
  width: text.length * size * 0.5,
  size,
  font,
  text,
});
const layout = {
  columns: 2,
  headings: [
    { level: 1, minSize: 15, fonts: ['head'] },
    { level: 2, minSize: 12, maxSize: 13, fonts: ['head'] },
  ],
  printedPage: (page) => page + 1,
};

describe('splitSections', () => {
  it('reads each column top to bottom and nests level 2 headings', () => {
    const runs = [
      // Column 2 is listed first in the stream; reading order still starts with column 1.
      run(1, 320, 700, 'END OF THE GAME', 16, 'head'),
      run(1, 320, 680, 'The game ends after the last round.'),
      run(1, 20, 700, 'Setup', 16, 'head'),
      run(1, 20, 680, 'Each player takes a board'),
      run(1, 20, 668, 'and 5 pralines.'),
      run(1, 20, 600, 'A. Choose a Piece', 12, 'head'),
      run(1, 20, 580, 'Pick one of three.'),
    ];
    const sections = splitSections(runs, pages, layout);
    expect(sections.map((s) => [s.key, s.parentKey, s.number, s.title])).toEqual([
      ['s1', null, null, 'Setup'],
      ['s2', 's1', 'A', 'Choose a Piece'],
      ['s3', null, null, 'End of the Game'],
    ]);
    expect(sections[0]?.body).toBe('Each player takes a board and 5 pralines.');
    expect(sections[2]).toMatchObject({ pdfPageStart: 1, pdfPageEnd: 1, printedPages: '2' });
  });

  it('continues a section onto the next page and records both pages', () => {
    const runs = [
      run(1, 20, 700, 'Scoring', 16, 'head'),
      run(1, 20, 680, 'Count your pralines.'),
      run(2, 20, 700, 'Subtract 2 per empty space.'),
    ];
    const [section] = splitSections(runs, pages, layout);
    expect(section).toMatchObject({ pdfPageStart: 1, pdfPageEnd: 2, printedPages: '2 and 3' });
    expect(section?.body).toBe('Count your pralines.\n\nSubtract 2 per empty space.');
  });

  it('joins a heading set over two lines and keeps text that shares its baseline', () => {
    const runs = [
      run(1, 20, 700, 'GOAL', 16, 'head'),
      run(1, 20, 686, 'OF THE GAME', 15, 'head'),
      run(1, 20, 600, 'CREDITS', 16, 'head'),
      run(1, 120, 600, 'Illustrations: Someone'),
    ];
    const sections = splitSections(runs, pages, layout);
    expect(sections.map((s) => s.title)).toEqual(['Goal of the Game', 'Credits']);
    expect(sections[1]?.body).toBe('Illustrations: Someone');
  });

  it('puts text before the first heading in an introduction and skips small text', () => {
    const runs = [
      run(1, 20, 760, 'Welcome to the chocolate factory.'),
      run(1, 20, 740, 'B1 B2', 3),
      run(1, 20, 700, 'Setup', 16, 'head'),
      run(1, 20, 680, 'Take a board.'),
    ];
    const sections = splitSections(runs, pages, { ...layout, minTextSize: 5 });
    expect(sections.map((s) => [s.title, s.body])).toEqual([
      ['Introduction', 'Welcome to the chocolate factory.'],
      ['Setup', 'Take a board.'],
    ]);
  });

  it('ignores labels and digits in heading fonts', () => {
    const runs = [
      run(1, 20, 700, 'Setup', 16, 'head'),
      run(1, 20, 680, '12', 16, 'head'),
      run(1, 20, 660, 'Center of', 16, 'head'),
      run(1, 20, 640, 'Take a board.'),
    ];
    const sections = splitSections(runs, pages, { ...layout, ignoreHeadings: [/^center of$/i] });
    expect(sections).toHaveLength(1);
    expect(sections[0]?.body).toBe('12 Center of Take a board.');
  });
});

describe('printed pages', () => {
  it('formats single pages, spreads and ranges', () => {
    expect(formatPrinted([])).toBeNull();
    expect(formatPrinted([4, 4])).toBe('4');
    expect(formatPrinted([5, 4])).toBe('4 and 5');
    expect(formatPrinted([5, 7, 6])).toBe('5 to 7');
  });

  it('follows each game note in docs/games', () => {
    const { azul, harmonies, patchwork, dorfromantik } = RULEBOOK_LAYOUTS;
    expect(azul.printedPage(1, 0.2)).toBe(2);
    expect(azul.printedPage(5, 0.2)).toBe(6);
    expect(azul.printedPage(6, 0.2)).toBe(1);
    expect(harmonies.printedPage(1, 0.5)).toBe(1);
    expect(harmonies.printedPage(2, 0.2)).toBe(2);
    expect(harmonies.printedPage(2, 0.8)).toBe(3);
    expect(harmonies.printedPage(6, 0.8)).toBe(11);
    expect(harmonies.printedPage(7, 0.8)).toBe(12);
    expect(patchwork.printedPage(1, 0.5)).toBeNull();
    expect(dorfromantik.printedPage(4, 0.5)).toBe(4);
  });
});

describe('titles', () => {
  it('title cases all-caps headings and splits step numbers', () => {
    expect(titleCase("NATURE'S SPIRIT CARDS")).toBe("Nature's Spirit Cards");
    expect(titleCase('Object of the game')).toBe('Object of the game');
    expect(splitNumber('B: Take and Place a Piece')).toEqual({
      number: 'B',
      title: 'Take and Place a Piece',
    });
    expect(splitNumber('Take 1 Animal card')).toEqual({
      number: null,
      title: 'Take 1 Animal card',
    });
  });
});

describe('review file', () => {
  const file = {
    gameId: 'azul',
    sourceVersion: 'abc',
    rulebook: { edition: 'E', title: 'T', publisherUrl: 'https://example.com/r.pdf' },
    sections: [
      {
        key: 's1',
        parentKey: null,
        ordinal: 1,
        number: null,
        title: 'Setup',
        pdfPageStart: 1,
        pdfPageEnd: 1,
        printedPages: '2',
        body: 'b',
      },
      {
        key: 's2',
        parentKey: 's1',
        ordinal: 2,
        number: 'A',
        title: 'Step',
        pdfPageStart: 1,
        pdfPageEnd: 2,
        printedPages: null,
        body: 'c',
      },
    ],
  };

  it('accepts a valid file and maps it to the load arguments', () => {
    const args = toLoadArgs(ReviewFileSchema.parse(file));
    expect(args.p_rulebook).toMatchObject({ game_id: 'azul', source_version: 'abc' });
    expect(args.p_sections[1]).toMatchObject({ key: 's2', parent_key: 's1', pdf_page_end: 2 });
  });

  it('rejects a parent listed after its child, and pages out of order', () => {
    const [a, b] = file.sections;
    expect(ReviewFileSchema.safeParse({ ...file, sections: [b, a] }).success).toBe(false);
    expect(
      ReviewFileSchema.safeParse({ ...file, sections: [{ ...a, pdfPageStart: 3 }] }).success,
    ).toBe(false);
  });
});
