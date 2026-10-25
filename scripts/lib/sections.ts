// Splits a rulebook's text runs into sections by heading size (docs/ARCHITECTURE.md → Rules
// assistant → Ingestion). Pure, so it is unit tested without a PDF.

export type PageInfo = { page: number; width: number; height: number };

/** One piece of text as pdf.js reports it; `y` grows upward from the page bottom. */
export type TextRun = {
  page: number;
  x: number;
  y: number;
  width: number;
  size: number;
  font: string;
  text: string;
};

export type HeadingRule = {
  level: 1 | 2;
  minSize: number;
  maxSize?: number;
  /** pdf.js font ids that headings use; any font when omitted. */
  fonts?: string[];
};

export type RulebookLayout = {
  /** Text columns per PDF page, read left to right, each top to bottom. */
  columns: number | ((pdfPage: number) => number);
  headings: HeadingRule[];
  /** Headings to ignore (diagram labels set in a heading font). */
  ignoreHeadings?: RegExp[];
  /** Headings set like level 1 that belong under the level 1 heading before them. */
  demoteHeadings?: RegExp[];
  /** Smaller text is dropped (labels inside reproduced score sheets and diagrams). */
  minTextSize?: number;
  /** PDF pages with no rules (cover, credits). */
  skipPages?: number[];
  /** The page number printed at a spot on a PDF page (`xFraction` 0 to 1), or null. */
  printedPage: (pdfPage: number, xFraction: number) => number | null;
};

export type Section = {
  key: string;
  parentKey: string | null;
  ordinal: number;
  number: string | null;
  title: string;
  pdfPageStart: number;
  pdfPageEnd: number;
  printedPages: string | null;
  body: string;
};

type Line = {
  page: number;
  column: number;
  y: number;
  x: number;
  xEnd: number;
  size: number;
  font: string;
  text: string;
  /** The text in the line's largest size, which is the heading if the line is one. */
  headText: string;
  /** The rest of a line that shares a baseline with a heading. */
  restText: string;
  xFraction: number;
};

type Draft = {
  level: 0 | 1 | 2;
  rawTitle: string;
  lines: Line[];
};

const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

/** "GOAL OF THE GAME" → "Goal of the Game"; mixed-case titles are kept. */
export function titleCase(text: string): string {
  if (/[a-z]/.test(text)) return text;
  return text
    .toLowerCase()
    .split(' ')
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word) ? word : word.replace(/^(\p{L})/u, (c) => c.toUpperCase()),
    )
    .join(' ');
}

/** "A. Factory offer" → number "A"; "B: Take and Place a Piece" → number "B". */
export function splitNumber(title: string): { number: string | null; title: string } {
  const match = /^([A-Z0-9]{1,2})[.:]\s+(.+)$/.exec(title);
  return match?.[1] && match[2] ? { number: match[1], title: match[2] } : { number: null, title };
}

/** Printed pages as stored: "4", "4 and 5", "4 to 6". */
export function formatPrinted(pages: number[]): string | null {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first === undefined || last === undefined) return null;
  if (first === last) return String(first);
  if (sorted.length === 2 && last === first + 1) return `${first} and ${last}`;
  return `${first} to ${last}`;
}

function toLines(runs: TextRun[], pages: PageInfo[], layout: RulebookLayout): Line[] {
  const widths = new Map(pages.map((p) => [p.page, p.width]));
  const skip = new Set(layout.skipPages ?? []);
  const groups = new Map<string, TextRun[]>();
  for (const run of runs) {
    if (skip.has(run.page) || run.size < (layout.minTextSize ?? 0)) continue;
    const width = widths.get(run.page) ?? 1;
    const columns = typeof layout.columns === 'number' ? layout.columns : layout.columns(run.page);
    const column = Math.min(columns - 1, Math.floor((run.x / width) * columns));
    const key = `${run.page}:${column}`;
    const list = groups.get(key) ?? [];
    list.push(run);
    groups.set(key, list);
  }

  const lines: Line[] = [];
  for (const [key, list] of groups) {
    const [page = 0, column = 0] = key.split(':').map(Number);
    const width = widths.get(page) ?? 1;
    // Same baseline (within 40% of the text size) is one line, read left to right.
    const sorted = [...list].sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: TextRun[][] = [];
    for (const run of sorted) {
      const row = rows.at(-1);
      const anchor = row?.[0];
      if (row && anchor && Math.abs(anchor.y - run.y) <= Math.max(anchor.size, run.size) * 0.4) {
        row.push(run);
      } else {
        rows.push([run]);
      }
    }
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      const first = row[0];
      if (!first) continue;
      const biggest = row.reduce((a, b) => (b.size > a.size ? b : a), first);
      const isHead = (run: TextRun) => run.size >= biggest.size - 0.3;
      const join = (keep: (run: TextRun) => boolean) => {
        let text = '';
        let end = -Infinity;
        for (const run of row) {
          if (!keep(run)) continue;
          // Skip duplicated runs (some PDFs draw text twice for a stroke effect).
          if (run.x < end - run.size * 0.5 && text.endsWith(run.text.trim())) continue;
          const gap = run.x - end;
          if (text && gap > run.size * 0.15 && !text.endsWith(' ') && !run.text.startsWith(' ')) {
            text += ' ';
          }
          text += run.text;
          end = Math.max(end, run.x + run.width);
        }
        return { text: text.replace(/\s+/g, ' ').trim(), end };
      };
      const all = join(() => true);
      const end = all.end;
      const text = all.text;
      lines.push({
        page,
        column,
        y: first.y,
        x: first.x,
        xEnd: end,
        size: biggest.size,
        font: biggest.font,
        text,
        headText: join(isHead).text,
        restText: join((run) => !isHead(run)).text,
        xFraction: first.x / width,
      });
    }
  }
  return lines
    .filter((line) => line.text !== '')
    .sort((a, b) => a.page - b.page || a.column - b.column || b.y - a.y || a.x - b.x);
}

function headingLevel(line: Line, layout: RulebookLayout): 1 | 2 | null {
  const title = line.headText;
  if ((title.match(/\p{L}/gu) ?? []).length < 3) return null;
  if (layout.ignoreHeadings?.some((pattern) => pattern.test(title))) return null;
  for (const rule of layout.headings) {
    if (line.size < rule.minSize) continue;
    if (rule.maxSize !== undefined && line.size > rule.maxSize) continue;
    if (rule.fonts && !rule.fonts.includes(line.font)) continue;
    if (rule.level === 1 && layout.demoteHeadings?.some((pattern) => pattern.test(title))) {
      return 2;
    }
    return rule.level;
  }
  return null;
}

function joinBody(lines: Line[]): string {
  let body = '';
  let previous: Line | undefined;
  for (const line of lines) {
    if (previous) {
      const sameBlock =
        line.page === previous.page &&
        line.column === previous.column &&
        previous.y - line.y <= Math.max(previous.size, line.size) * 1.8;
      if (!sameBlock) body += '\n\n';
      else if (body.endsWith('-') && /^\p{Ll}/u.test(line.text)) body = body.slice(0, -1);
      else body += ' ';
    }
    body += line.text;
    previous = line;
  }
  return body.trim();
}

/** Sections in reading order; level 2 headings become children of the level 1 before them. */
export function splitSections(
  runs: TextRun[],
  pages: PageInfo[],
  layout: RulebookLayout,
): Section[] {
  const lines = toLines(runs, pages, layout);
  const drafts: Draft[] = [];
  let current: Draft | undefined;
  for (const line of lines) {
    const level = headingLevel(line, layout);
    if (level !== null) {
      const last = current?.lines.at(-1);
      // A heading set over two lines ("GOAL" / "OF THE GAME") is one heading.
      if (
        current &&
        current.level !== 0 &&
        current.lines.length === 1 &&
        last &&
        last.page === line.page &&
        last.column === line.column &&
        last.y - line.y <= Math.max(last.size, line.size) * 1.6
      ) {
        current.rawTitle = `${current.rawTitle} ${line.headText}`;
        current.lines.push({ ...line, text: '' });
        if (line.restText) current.lines.push({ ...line, text: line.restText });
        continue;
      }
      current = { level, rawTitle: line.headText, lines: [{ ...line, text: '' }] };
      if (line.restText) current.lines.push({ ...line, text: line.restText });
      drafts.push(current);
      continue;
    }
    if (!current) {
      current = { level: 0, rawTitle: 'Introduction', lines: [] };
      drafts.push(current);
    }
    current.lines.push(line);
  }

  const sections: Section[] = [];
  let parentKey: string | null = null;
  drafts.forEach((draft, index) => {
    const key = `s${index + 1}`;
    const all = draft.lines;
    const pagesUsed = all.map((line) => line.page);
    const printed = all
      .map((line) => layout.printedPage(line.page, line.xFraction))
      .filter((page): page is number => page !== null);
    const { number, title } = splitNumber(titleCase(draft.rawTitle));
    if (draft.level !== 2) parentKey = null;
    sections.push({
      key,
      parentKey: draft.level === 2 ? parentKey : null,
      ordinal: index + 1,
      number,
      title,
      pdfPageStart: Math.min(...pagesUsed),
      pdfPageEnd: Math.max(...pagesUsed),
      printedPages: formatPrinted(printed),
      body: joinBody(all.filter((line) => line.text !== '')),
    });
    if (draft.level === 1) parentKey = key;
  });
  return sections.filter((section) => section.body !== '' || section.parentKey === null);
}
