import { createHash, randomInt } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { createDb } from '../../apps/api/src/db/client';
import { findRulebook, replaceRulebook } from '../../apps/api/src/db/rules';

// The API runs with LLM_PROVIDER=fake (playwright.config.ts): it searches the rulebook, reads
// the best section and cites it. Each run asks from its own forwarded IP, so the guest quota
// starts at zero; the usage it creates is removed afterwards.
const GAME = 'azul';
const LIMIT = Number(process.env.LLM_GUEST_DAILY_REQUESTS || 5);
const ip = `198.51.100.${randomInt(1, 255)}`;
const subjectKey = createHash('sha256')
  .update(`${process.env.IP_HASH_SALT || 'change-me'}:${ip}`)
  .digest('hex');

function service() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing; playwright.config.ts fills it.');
  return createDb(url);
}

let createdRulebook: string | null = null;

test.beforeAll(async () => {
  const db = service();
  if (await findRulebook(db, GAME)) return;
  // No ingested rulebook (a fresh database): load a one-section stand-in for this test.
  createdRulebook = await replaceRulebook(db, {
    p_rulebook: {
      game_id: GAME,
      edition: 'Test',
      title: 's3 e2e rulebook',
      publisher_url: 'https://example.com/s3-e2e.pdf',
      source_version: 's3-e2e',
    },
    p_sections: [
      {
        key: 's1',
        parent_key: null,
        ordinal: 1,
        number: null,
        title: 'End of the game',
        pdf_page_start: 5,
        pdf_page_end: 5,
        printed_pages: '6',
        body: 'The game ends right after the round in which a player completes a line.',
      },
    ],
  });
});

test.afterAll(async () => {
  const db = service();
  const day = new Date().toISOString().slice(0, 10);
  const [used] = await db<{ requests: number; input_tokens: number; output_tokens: number }>`
    delete from public.llm_usage
    where subject_type = 'ip' and subject_key = ${subjectKey}
    returning requests, input_tokens, output_tokens
  `;
  if (used) {
    await db`
      select public.llm_record_tokens(
        'global',
        'global',
        ${-used.input_tokens},
        ${-used.output_tokens}
      )
    `;
    const [global] = await db<{ requests: number }>`
      select requests
      from public.llm_usage
      where subject_type = 'global' and subject_key = 'global' and day = ${day}::date
    `;
    if (global) {
      await db`
        update public.llm_usage
        set requests = ${Math.max(0, global.requests - used.requests)}
        where subject_type = 'global' and subject_key = 'global' and day = ${day}::date
      `;
    }
  }
  if (createdRulebook) {
    await db`delete from public.rulebooks where id = ${createdRulebook}`;
  }
});

test('ask a starter question, get a cited answer, then run out of questions', async ({ page }) => {
  // Added after the browser's CORS checks, so the API sees it without a preflight change.
  await page.route(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/v1/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': ip } }),
  );
  await page.goto(`/games/${GAME}/rules`);

  await expect(page.getByTestId('rulebook-link')).toHaveAttribute('href', /\.pdf$/);
  await expect(page.getByTestId('quota-pill')).toHaveText(`${LIMIT} left today`);
  await expect(page.getByTestId('rules-empty')).toBeVisible();

  await page.getByRole('button', { name: 'When does the game end?' }).click();
  const answer = page.getByTestId('answer');
  await expect(answer.getByRole('heading', { name: 'From the Rulebook' })).toBeVisible();
  const chip = answer.getByTestId('citation-chip').first();
  await expect(chip).toContainText(/^§ .+ · p\. \d/);
  await expect(chip).toHaveAttribute('href', /#page=\d+$/);
  await expect(chip).toHaveAttribute('target', '_blank');
  await expect(page.getByTestId('quota-pill')).toHaveText(`${LIMIT - 1} left today`);

  // An off-topic question is answered as not in the rulebook, with no citations.
  const box = page.getByRole('textbox', { name: 'Your question' });
  await box.fill('What is the capital of France?');
  await box.press('Enter');
  const notCovered = page.getByTestId('answer-not-covered');
  await expect(notCovered.getByRole('heading', { name: 'Not in the Rulebook' })).toBeVisible();
  await expect(notCovered.getByTestId('citation-chip')).toHaveCount(0);

  for (let left = LIMIT - 2; left > 0; left--) {
    await box.fill('How does box confection score?');
    await page.getByRole('button', { name: 'Ask' }).click();
    await expect(page.getByTestId('quota-pill')).toHaveText(`${left - 1} left today`);
  }

  const quota = page.getByTestId('rules-quota');
  await expect(quota).toContainText('No questions left today.');
  await expect(quota.getByRole('button', { name: 'Sign In with Google' })).toBeVisible();
  await expect(box).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Ask' })).toBeDisabled();
});
