// How each rulebook PDF is laid out, read from the PDFs themselves (none has an outline).
// Font ids are pdf.js's names for the fonts embedded in that exact file; a new rulebook
// version may need new values (the ingest output shows what was found).
// Printed page numbers follow the "Page numbers" note in docs/games/<gameId>.md.
import type { GameId } from '../../packages/core/src/kit/types';

import type { RulebookLayout } from './sections';

export const RULEBOOK_LAYOUTS: Record<GameId, RulebookLayout> = {
  // Two sides of one folded sheet, three panels each. No page numbers are printed.
  patchwork: {
    columns: 3,
    headings: [
      { level: 2, minSize: 13.5, maxSize: 14.5, fonts: ['g_d0_f6'] },
      { level: 1, minSize: 13.5, maxSize: 14.5, fonts: ['g_d0_f1'] },
    ],
    printedPage: () => null,
  },
  // Printed pages 2 to 6 are PDF pages 1 to 5; the cover (printed p. 1) is PDF page 6.
  azul: {
    columns: 2,
    headings: [
      { level: 1, minSize: 18.5, maxSize: 20.4, fonts: ['g_d0_f3'] },
      { level: 2, minSize: 13.5, maxSize: 14.5, fonts: ['g_d0_f2'] },
    ],
    demoteHeadings: [/^first turns example$/i],
    skipPages: [6],
    printedPage: (pdfPage) => (pdfPage <= 5 ? pdfPage + 1 : 1),
  },
  // Cover, then two-page spreads (printed 2 and 3 to 10 and 11), then the player aid (12).
  harmonies: {
    // Four columns per spread; the player aid (PDF page 7) is a single page.
    columns: (pdfPage) => (pdfPage === 7 ? 2 : 4),
    headings: [
      { level: 1, minSize: 16.5, maxSize: 20.5, fonts: ['g_d0_f1'] },
      { level: 2, minSize: 14.5, maxSize: 15.5, fonts: ['g_d0_f1'] },
    ],
    // The third step of a turn is set as large as the section headings.
    demoteHeadings: [/^place 1 animal cube$/i],
    skipPages: [1],
    printedPage: (pdfPage, xFraction) => {
      if (pdfPage === 1) return 1;
      if (pdfPage === 7) return 12;
      return xFraction < 0.5 ? pdfPage * 2 - 2 : pdfPage * 2 - 1;
    },
  },
  // Printed page numbers match PDF pages.
  dorfromantik: {
    columns: 2,
    headings: [
      { level: 1, minSize: 15.5, maxSize: 16.5, fonts: ['g_d0_f1'] },
      { level: 2, minSize: 13.5, maxSize: 14.5, fonts: ['g_d0_f14'] },
    ],
    // Drops the tiny labels of the reproduced score sheet and campaign sheet.
    minTextSize: 7,
    printedPage: (pdfPage) => pdfPage,
  },
};
