// The reviewable sections file, data/rulebooks/<gameId>.sections.json (gitignored).
import { z } from 'zod';

const SectionSchema = z
  .object({
    key: z.string().min(1),
    parentKey: z.string().min(1).nullable(),
    ordinal: z.number().int().positive(),
    number: z.string().min(1).nullable(),
    title: z.string().trim().min(1),
    pdfPageStart: z.number().int().positive(),
    pdfPageEnd: z.number().int().positive(),
    printedPages: z.string().trim().min(1).nullable(),
    body: z.string(),
  })
  .refine((s) => s.pdfPageEnd >= s.pdfPageStart, 'pdfPageEnd is before pdfPageStart');

export const ReviewFileSchema = z
  .object({
    gameId: z.string(),
    sourceVersion: z.string().min(1),
    rulebook: z.object({ edition: z.string(), title: z.string(), publisherUrl: z.url() }),
    sections: z.array(SectionSchema).min(1),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    const ordinals = new Set<number>();
    for (const [i, section] of file.sections.entries()) {
      if (section.parentKey !== null && !seen.has(section.parentKey)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sections', i, 'parentKey'],
          message: `parent ${section.parentKey} must come earlier in the list`,
        });
      }
      if (seen.has(section.key) || ordinals.has(section.ordinal)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sections', i],
          message: 'key and ordinal must be unique',
        });
      }
      seen.add(section.key);
      ordinals.add(section.ordinal);
    }
  });
export type ReviewFile = z.infer<typeof ReviewFileSchema>;

/** The arguments of the `replace_rulebook` database function. */
export function toLoadArgs(file: ReviewFile) {
  return {
    p_rulebook: {
      game_id: file.gameId,
      edition: file.rulebook.edition,
      title: file.rulebook.title,
      publisher_url: file.rulebook.publisherUrl,
      source_version: file.sourceVersion,
    },
    p_sections: file.sections.map((s) => ({
      key: s.key,
      parent_key: s.parentKey,
      ordinal: s.ordinal,
      number: s.number,
      title: s.title,
      pdf_page_start: s.pdfPageStart,
      pdf_page_end: s.pdfPageEnd,
      printed_pages: s.printedPages,
      body: s.body,
    })),
  };
}
