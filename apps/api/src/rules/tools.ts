import { z } from 'zod';

import type { SearchHit, SectionRow, SectionSummary } from '../db/rules';
import type { ToolSpec } from '../llm/types';

/** What the agent reads from: one rulebook. */
export interface RulebookSource {
  list(): Promise<SectionSummary[]>;
  read(sectionId: string): Promise<SectionRow | null>;
  search(query: string): Promise<SearchHit[]>;
}

// Plain JSON Schemas for the model (strict tool use accepts a small subset); arguments are
// validated again with the Zod schemas below.
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

export const RULES_TOOLS: ToolSpec[] = [
  {
    name: 'list_sections',
    description:
      "The rulebook's table of contents: every section's id, number, title and pages, in order.",
    inputSchema: object({}),
  },
  {
    name: 'read_section',
    description: 'The full text of one section, by the id from list_sections or search_rulebook.',
    inputSchema: object({ id: { type: 'string', description: 'Section id' } }),
  },
  {
    name: 'search_rulebook',
    description:
      'Full-text search of the rulebook. Returns up to 5 sections, best match first, each with a short snippet.',
    inputSchema: object({
      query: { type: 'string', description: 'Keywords, using the rulebook terms where known' },
    }),
  },
  {
    name: 'answer',
    description:
      'Your final reply to the player. Call it exactly once, after reading the sections you rely on.',
    inputSchema: object({
      answer: { type: 'string', description: 'The answer, written for the player' },
      citedSectionIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Ids of the sections (read with read_section) the answer relies on',
      },
      notCovered: {
        type: 'boolean',
        description: "True when the rulebook doesn't settle the question",
      },
    }),
  },
];

export const ReadSectionArgsSchema = z.object({ id: z.uuid() }).strict();
export const SearchArgsSchema = z.object({ query: z.string().trim().min(1).max(200) }).strict();
export const ListArgsSchema = z.object({}).strict();
export const AnswerArgsSchema = z
  .object({
    answer: z.string().trim().min(1).max(4000),
    citedSectionIds: z.array(z.string()).max(20),
    notCovered: z.boolean(),
  })
  .strict();
export type AnswerArgs = z.infer<typeof AnswerArgsSchema>;

function pdfPages(section: { pdfPageStart: number; pdfPageEnd: number }): string {
  return section.pdfPageStart === section.pdfPageEnd
    ? String(section.pdfPageStart)
    : `${section.pdfPageStart} to ${section.pdfPageEnd}`;
}

/** Tool output shapes from docs/ARCHITECTURE.md → Rules assistant. */
export const toolOutput = {
  list: (sections: SectionSummary[]) =>
    sections.map((s) => ({
      id: s.id,
      number: s.number,
      title: s.title,
      printedPages: s.printedPages,
      pdfPages: pdfPages(s),
    })),
  read: (s: SectionRow) => ({
    id: s.id,
    title: s.title,
    printedPages: s.printedPages,
    pdfPages: pdfPages(s),
    body: s.body,
  }),
  search: (hits: SearchHit[]) =>
    hits.map((h) => ({
      id: h.id,
      title: h.title,
      printedPages: h.printedPages,
      pdfPages: pdfPages(h),
      snippet: h.snippet,
    })),
};
