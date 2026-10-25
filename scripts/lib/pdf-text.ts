// Text runs per PDF page, with position, size and font, read with pdf.js.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

import type { PageInfo, TextRun } from './sections';

export type PdfText = { pages: PageInfo[]; runs: TextRun[]; hasOutline: boolean };

export async function readPdfText(data: Uint8Array): Promise<PdfText> {
  const task = getDocument({ data, verbosity: 0 });
  const doc = await task.promise;
  const pages: PageInfo[] = [];
  const runs: TextRun[] = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const { width, height } = page.getViewport({ scale: 1 });
    pages.push({ page: number, width, height });
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue;
      const [a = 0, b = 0, , , x = 0, y = 0] = item.transform as number[];
      runs.push({
        page: number,
        x,
        y,
        width: item.width,
        size: Math.round(Math.hypot(a, b) * 10) / 10,
        font: item.fontName,
        text: item.str,
      });
    }
  }
  const outline = await doc.getOutline();
  await task.destroy();
  return { pages, runs, hasOutline: (outline as unknown[] | null)?.length ? true : false };
}
