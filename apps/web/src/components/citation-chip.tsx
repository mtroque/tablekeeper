import type { Citation } from '@tablekeeper/core';
import { ExternalLink } from 'lucide-react';

/** "§ Scoring · p. 5": the printed page, or the PDF page when the rulebook prints none. */
export function citationLabel(citation: Citation): string {
  return `§ ${citation.title} · p. ${citation.printedPages ?? String(citation.pdfPage)}`;
}

/** Opens the official PDF at the cited page. */
export function CitationChip({ citation }: { citation: Citation }) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="citation-chip"
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-accent-soft px-3 text-sm text-ink transition-colors duration-150 ease-calm hover:border-accent"
    >
      <span>{citationLabel(citation)}</span>
      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 stroke-[1.5] text-muted" />
      <span className="sr-only">(opens the rulebook)</span>
    </a>
  );
}
