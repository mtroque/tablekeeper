import type { Db } from './client';
import type { RulebookSectionsRow, RulebooksRow } from './types';

export type RulebookRow = { id: string; gameId: string; title: string; publisherUrl: string };

export type SectionSummary = {
  id: string;
  number: string | null;
  title: string;
  parentId: string | null;
  printedPages: string | null;
  pdfPageStart: number;
  pdfPageEnd: number;
};

export type SectionRow = SectionSummary & { body: string };

export type SearchHit = Omit<SectionSummary, 'parentId'> & { snippet: string };

type DbRulebook = Pick<RulebooksRow, 'id' | 'game_id' | 'title' | 'publisher_url'>;

export async function findRulebook(db: Db, gameId: string): Promise<RulebookRow | null> {
  const [row] = await db<DbRulebook>`
    select id, game_id, title, publisher_url
    from public.rulebooks
    where game_id = ${gameId}
  `;
  return row
    ? { id: row.id, gameId: row.game_id, title: row.title, publisherUrl: row.publisher_url }
    : null;
}

type SummaryRecord = Pick<
  RulebookSectionsRow,
  'id' | 'number' | 'title' | 'parent_id' | 'printed_pages' | 'pdf_page_start' | 'pdf_page_end'
>;

function toSummary(row: SummaryRecord): SectionSummary {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    parentId: row.parent_id,
    printedPages: row.printed_pages,
    pdfPageStart: row.pdf_page_start,
    pdfPageEnd: row.pdf_page_end,
  };
}

export async function listSections(db: Db, rulebookId: string): Promise<SectionSummary[]> {
  const rows = await db<SummaryRecord>`
    select id, number, title, parent_id, printed_pages, pdf_page_start, pdf_page_end
    from public.rulebook_sections
    where rulebook_id = ${rulebookId}
    order by ordinal
  `;
  return rows.map(toSummary);
}

/** A section of this rulebook, or null (also for a section of another rulebook). */
export async function readSection(
  db: Db,
  rulebookId: string,
  sectionId: string,
): Promise<SectionRow | null> {
  const [row] = await db<SummaryRecord & { body: string }>`
    select id, number, title, parent_id, printed_pages, pdf_page_start, pdf_page_end, body
    from public.rulebook_sections
    where rulebook_id = ${rulebookId} and id = ${sectionId}
  `;
  return row ? { ...toSummary(row), body: row.body } : null;
}

type SearchRecord = Omit<SummaryRecord, 'parent_id'> & { snippet: string };

export async function searchSections(
  db: Db,
  rulebookId: string,
  query: string,
  limit = 5,
): Promise<SearchHit[]> {
  const rows = await db<SearchRecord>`
    select id, number, title, printed_pages, pdf_page_start, pdf_page_end, snippet
    from public.search_rulebook_sections(${rulebookId}, ${query}, ${limit})
  `;
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    title: row.title,
    printedPages: row.printed_pages,
    pdfPageStart: row.pdf_page_start,
    pdfPageEnd: row.pdf_page_end,
    snippet: row.snippet,
  }));
}

export async function replaceRulebook(
  db: Db,
  args: { p_rulebook: unknown; p_sections: unknown },
): Promise<string> {
  const [row] = await db<{ id: string }>`
    select public.replace_rulebook(${db.json(args.p_rulebook)}, ${db.json(args.p_sections)}) as id
  `;
  if (!row) throw new Error('replace_rulebook returned no id');
  return row.id;
}
