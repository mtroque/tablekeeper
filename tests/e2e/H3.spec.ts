import { expect, test, type Page } from '@playwright/test';

const SCORE = '/games/harmonies/score';
/** Below this a value is outlined and counted (apps/web/src/components/confidence-outline.tsx). */
const LOW_CONFIDENCE = 0.75;

/** Sample photo 1 (side A, pink table) through capture to the review screen. */
async function reviewSample(page: Page) {
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Try Sample Photo 1' }).click();
  await expect(page).toHaveURL(/\/score\/capture$/);
  // The first run compiles the worker and loads opencv in next dev.
  const read = page.getByRole('button', { name: 'Read Board' });
  await expect(read).toBeVisible({ timeout: 150_000 });
  await read.click();
  await expect(page).toHaveURL(/\/score\/review$/, { timeout: 30_000 });
}

/** The draft's confidence as the flow stores it, to know how many banner values a space holds. */
async function draftConfidence(page: Page): Promise<Record<string, number>> {
  const raw = await page.evaluate(() => sessionStorage.getItem('tk:v1:flow:harmonies'));
  const flow = JSON.parse(raw ?? 'null') as { draft: { confidence: Record<string, number> } };
  return flow.draft.confidence;
}

const lowValues = (confidence: Record<string, number>, key: string) =>
  [key, `${key}:height`].filter((k) => (confidence[k] ?? 1) < LOW_CONFIDENCE).length;

test('H3: a sample photo is reviewed on the board until nothing is left to check', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await reviewSample(page);

  const cell = (key: string) => page.locator(`[data-cell="${key}"]`);
  const highlighted = page.locator('[data-cell][data-low-confidence]');
  const banner = page.getByRole('status').filter({ hasText: 'to check.' });
  const bannerCount = async () =>
    (await banner.count()) === 0 ? 0 : Number(/\d+/.exec((await banner.textContent()) ?? '')?.[0]);

  // No list of prompts under the board: the spaces needing a height are outlined on it.
  await expect(page.getByText('Set Heights')).toHaveCount(0);
  // From data/fixtures/harmonies/labels.json: a mountain at (2,-1), leaves at (0,1), a trunk at
  // (1,1) and a roof at (1,2).
  for (const key of ['2,-1', '0,1', '1,1', '1,2']) {
    await expect(cell(key)).toHaveAttribute('data-low-confidence', 'true');
  }

  // Each top opens on the stacks it leaves open; "Something Else" shows the full list.
  const choicesFor = async (key: string) => {
    await cell(key).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('button', { name: 'Something Else' })).toBeVisible();
    const labels = await sheet.locator('[data-stack]').allInnerTexts();
    return { sheet, labels: labels.map((label) => label.trim()) };
  };
  const close = async () => {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  };
  expect((await choicesFor('2,-1')).labels).toEqual(['1', '2', '3']);
  await close();
  expect((await choicesFor('0,1')).labels).toEqual(['Leaves Only', '1 Trunk', '2 Trunks']);
  await close();
  expect((await choicesFor('1,2')).labels).toEqual(['Lone Roof', 'Building']);
  await close();
  const brown = await choicesFor('1,1');
  expect(brown.labels).toEqual(['Trunks']);
  await brown.sheet.getByRole('button', { name: 'Something Else' }).click();
  const all = await brown.sheet.locator('[data-stack]').allInnerTexts();
  expect(all).toHaveLength(12);
  expect(all).toContain('Building');
  expect(all).not.toContain('2 Trunks');
  await close();
  // Closing without a pick answers nothing.
  await expect(cell('1,1')).toHaveAttribute('data-low-confidence', 'true');

  // Answer every outlined space with the stack it already has: each one leaves the outline and
  // the banner, which drops by that space's values (1 for a confident color waiting for a height).
  let left = await bannerCount();
  expect(left).toBeGreaterThan(0);
  const before = await page.getByTestId('running-total').textContent();
  while ((await highlighted.count()) > 0) {
    const key = (await highlighted.first().getAttribute('data-cell')) ?? '';
    const drop = lowValues(await draftConfidence(page), key);
    await cell(key).click();
    await page.getByRole('dialog').locator('[data-stack][aria-pressed="true"]').click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(cell(key)).not.toHaveAttribute('data-low-confidence', 'true');
    left -= drop;
    await expect.poll(bannerCount).toBe(left);
  }
  await expect(banner).toHaveCount(0);
  // Confirming the draft changes no stack, so the score is the photo's.
  await expect(page.getByTestId('running-total')).toHaveText(before ?? '');

  // A space can still be changed after it was answered.
  await cell('2,-1').click();
  await page.getByRole('button', { name: 'Mountain, Height 3', exact: true }).click();
  await expect(cell('2,-1')).toHaveAttribute('aria-label', 'Column 3, Space 1: mountain, height 3');

  await page.getByRole('link', { name: 'See Score' }).click();
  await expect(page).toHaveURL(/\/score\/result$/);
  await expect(page.getByText('Mountains', { exact: true })).toBeVisible();
});

test('H3: entering by hand highlights nothing and opens the full list', async ({ page }) => {
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Enter by Hand' }).click();
  await expect(page).toHaveURL(/\/score\/review$/);
  await expect(page.locator('[data-cell][data-low-confidence]')).toHaveCount(0);
  await page.locator('[data-cell="2,-1"]').click();
  await page.getByRole('button', { name: 'Mountain, Height 1', exact: true }).click();
  await page.locator('[data-cell="2,-1"]').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('[data-stack]')).toHaveCount(12);
  await expect(sheet.getByRole('button', { name: 'Something Else' })).toHaveCount(0);
});
