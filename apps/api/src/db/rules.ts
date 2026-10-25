import type { Db } from './client';

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

export async function findRulebook(db: Db, gameId: string): Promise<RulebookRow | null> {
  const { data, error } = await db
    .from('rulebooks')
    .select('id, game_id, title, publisher_url')
    .eq('game_id', gameId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { id: data.id, gameId: data.game_id, title: data.title, publisherUrl: data.publisher_url }
    : null;
}

const SUMMARY_COLUMNS = 'id, number, title, parent_id, printed_pages, pdf_page_start, pdf_page_end';

type SummaryRecord = {
  id: string;
  number: string | null;
  title: string;
  parent_id: string | null;
  printed_pages: string | null;
  pdf_page_start: number;
  pdf_page_end: number;
};

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
  const { data, error } = await db
    .from('rulebook_sections')
    .select(SUMMARY_COLUMNS)
    .eq('rulebook_id', rulebookId)
    .order('ordinal');
  if (error) throw error;
  return data.map(toSummary);
}

/** A section of this rulebook, or null (also for a section of another rulebook). */
export async function readSection(
  db: Db,
  rulebookId: string,
  sectionId: string,
): Promise<SectionRow | null> {
  const { data, error } = await db
    .from('rulebook_sections')
    .select(`${SUMMARY_COLUMNS}, body`)
    .eq('rulebook_id', rulebookId)
    .eq('id', sectionId)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...toSummary(data), body: data.body } : null;
}

export async function searchSections(
  db: Db,
  rulebookId: string,
  query: string,
  limit = 5,
): Promise<SearchHit[]> {
  const { data, error } = await db.rpc('search_rulebook_sections', {
    p_rulebook_id: rulebookId,
    p_query: query,
    p_limit: limit,
  });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    number: row.number,
    title: row.title,
    printedPages: row.printed_pages,
    pdfPageStart: row.pdf_page_start,
    pdfPageEnd: row.pdf_page_end,
    snippet: row.snippet,
  }));
}
