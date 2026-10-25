import { createHash, randomInt } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

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
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env missing; playwright.config.ts fills it.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let createdRulebook: string | null = null;

test.beforeAll(async () => {
  const db = service();
  const { data } = await db.from('rulebooks').select('id').eq('game_id', GAME).maybeSingle();
  if (data) return;
  // No ingested rulebook (a fresh database): load a one-section stand-in for this test.
  const created = await db.rpc('replace_rulebook', {
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
  if (created.error) throw created.error;
  createdRulebook = created.data as string;
});

test.afterAll(async () => {
  const db = service();
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from('llm_usage')
    .delete()
    .match({ subject_type: 'ip', subject_key: subjectKey })
    .select('requests, input_tokens, output_tokens');
  const used = data?.[0];
  if (used) {
    await db.rpc('llm_record_tokens', {
      p_subject_type: 'global',
      p_subject_key: 'global',
      p_input: -used.input_tokens,
      p_output: -used.output_tokens,
    });
    const global = await db
      .from('llm_usage')
      .select('requests')
      .match({ subject_type: 'global', subject_key: 'global', day })
      .maybeSingle();
    if (global.data) {
      await db
        .from('llm_usage')
        .update({ requests: Math.max(0, global.data.requests - used.requests) })
        .match({ subject_type: 'global', subject_key: 'global', day });
    }
  }
  if (createdRulebook) await db.from('rulebooks').delete().eq('id', createdRulebook);
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
