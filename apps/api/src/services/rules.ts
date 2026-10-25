import { getGame, type Citation, type RulesAnswer, type RulesTurn } from '@tablekeeper/core';

import type { Config } from '../config';
import type { Db } from '../db/client';
import type { Subject } from '../db/quota';
import { findRulebook, listSections, readSection, searchSections } from '../db/rules';
import { notFound } from '../errors';
import type { Gateway } from '../llm/gateway';
import type { QuotaStore } from '../llm/quota-store';
import { runRulesAgent } from '../rules/agent';

import { getQuota } from './quota';

/** docs/ARCHITECTURE.md → Rules assistant → Limits. */
export const RULES_TIMEOUT_MS = 30_000;

export type RulesDeps = { config: Config; service: Db; gateway: Gateway; quotas: QuotaStore };

/** The backstop for the prompt's no-dash rule: ranges become "to", other dashes commas. */
export function removeDashes(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2')
    .replace(/\s*[–—]\s*/g, ', ')
    .replace(/,\s*([.,;:!?])/g, '$1')
    .replace(/^,\s*/, '');
}

/** The publisher PDF opened at a page. */
export function pageUrl(publisherUrl: string, pdfPage: number): string {
  return `${publisherUrl.split('#')[0] ?? publisherUrl}#page=${pdfPage}`;
}

export async function askRules(
  deps: RulesDeps,
  input: { gameId: string; question: string; history: RulesTurn[]; subject: Subject },
): Promise<RulesAnswer> {
  const game = getGame(input.gameId);
  if (!game?.features.rules) throw notFound('That game');
  const rulebook = await findRulebook(deps.service, game.id);
  if (!rulebook) throw notFound(`The ${game.name} rulebook`);

  const result = await deps.gateway.run(
    { purpose: 'rules', subject: input.subject, limits: { timeoutMs: RULES_TIMEOUT_MS } },
    (model) =>
      runRulesAgent({
        model,
        source: {
          list: () => listSections(deps.service, rulebook.id),
          read: (id) => readSection(deps.service, rulebook.id, id),
          search: (query) => searchSections(deps.service, rulebook.id, query),
        },
        game: { name: game.name, edition: game.edition },
        question: input.question,
        history: input.history,
        maxToolCalls: deps.config.llm.rulesMaxToolCalls,
        maxOutputTokens: deps.config.llm.rulesMaxOutputTokens,
      }),
  );

  const citations: Citation[] = result.cited.map((section) => ({
    sectionId: section.id,
    title: section.title,
    printedPages: section.printedPages,
    pdfPage: section.pdfPageStart,
    url: pageUrl(rulebook.publisherUrl, section.pdfPageStart),
  }));
  return {
    answer: removeDashes(result.answer),
    notCovered: result.notCovered,
    citations,
    quota: await getQuota(deps.config, deps.quotas, input.subject),
  };
}
