import { expect, test, type Page, type TestInfo } from '@playwright/test';

const SCORE = '/games/patchwork/score';
const FLOW_KEY = 'tk:v1:flow:patchwork';

/** Opens a sample photo, reads the board and lands on review. */
async function readSample(page: Page, name: string): Promise<void> {
  await page.goto(SCORE);
  await page.getByRole('button', { name }).click();
  await expect(page).toHaveURL(/\/score\/capture$/);
  // The first read loads opencv in the worker; give it time.
  const read = page.getByRole('button', { name: 'Read Board' });
  await expect(read).toBeVisible({ timeout: 60_000 });
  await read.click();
  await expect(page).toHaveURL(/\/score\/review$/, { timeout: 30_000 });
}

const grid = (page: Page) => page.getByRole('group', { name: /Box Board$/ });
const photoFill = (page: Page) => grid(page).locator('[data-fill="photo"]');
const plainFill = (page: Page) => grid(page).locator('[data-fill="plain"]');

/** The grid as drawn, kept with the test's output for checking by eye. */
async function shoot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await grid(page).screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

test('each sample draws its covered spaces in the photo colors', async ({ page }, testInfo) => {
  for (const name of ['Try Sample Photo 1', 'Try Sample Photo 2', 'Try Sample Photo 3']) {
    await readSample(page, name);
    // The reading itself is P2's to test; every space it read as covered gets a photo color.
    const empty = Number.parseInt((await page.getByTestId('empty-count').textContent()) ?? '', 10);
    expect(empty).toBeGreaterThan(0);
    await expect(photoFill(page)).toHaveCount(81 - empty, { timeout: 10_000 });
    await expect(plainFill(page)).toHaveCount(0);
    // Not one flat color: the pieces differ.
    const fills = await photoFill(page).evaluateAll((spans) =>
      spans.map((span) => getComputedStyle(span).backgroundColor),
    );
    expect(new Set(fills).size).toBeGreaterThan(20);
    await shoot(page, testInfo, name.replaceAll(' ', '-').toLowerCase());
    await page.getByRole('button', { name: 'Start Over' }).click();
    await expect(page).toHaveURL(new RegExp(`${SCORE}$`));
  }
});

test('tapping covers with the plain fill and uncovers to the board', async ({ page }) => {
  await readSample(page, 'Try Sample Photo 1');
  await expect(photoFill(page)).toHaveCount(67, { timeout: 10_000 });

  // Row 1, column 1 is empty in the photo: covered by hand, it is drawn plain.
  await page.getByRole('button', { name: 'Row 1, column 1: empty' }).click();
  const byHand = page.getByRole('button', { name: 'Row 1, column 1: covered' });
  await expect(byHand.locator('[data-fill="plain"]')).toHaveCount(1);
  await expect(page.getByTestId('empty-count')).toHaveText('13 empty spaces');

  // Row 1, column 3 is a piece in the photo: uncovered, it shows the board.
  const piece = page.getByRole('button', { name: 'Row 1, column 3: covered' });
  await expect(piece.locator('[data-fill="photo"]')).toHaveCount(1);
  await piece.click();
  const bare = page.getByRole('button', { name: 'Row 1, column 3: empty' });
  await expect(bare.locator('[data-fill]')).toHaveCount(0);
  // Covered again, the photo's color comes back.
  await bare.click();
  await expect(piece.locator('[data-fill="photo"]')).toHaveCount(1);
});

test('a covered space that looks like the empty board is hatched', async ({ page }) => {
  await readSample(page, 'Try Sample Photo 1');
  await expect(photoFill(page)).toHaveCount(67, { timeout: 10_000 });
  // As if the photo had misread every empty space as covered.
  await page.evaluate((key) => {
    const flow = JSON.parse(sessionStorage.getItem(key) ?? '{}') as {
      state: { grid: boolean[] };
      draft: { state: { grid: boolean[] } };
    };
    flow.state.grid = flow.state.grid.map(() => true);
    flow.draft.state.grid = flow.draft.state.grid.map(() => true);
    sessionStorage.setItem(key, JSON.stringify(flow));
  }, FLOW_KEY);
  await page.reload();

  await expect(photoFill(page)).toHaveCount(81, { timeout: 10_000 });
  const hatched = grid(page).locator('[data-looks-empty]');
  // 14 spaces are empty in this photo; most of them look it (8 in Node at the found corners),
  // and no piece does.
  await expect.poll(() => hatched.count()).toBeGreaterThanOrEqual(5);
  expect(await hatched.count()).toBeLessThanOrEqual(14);
  await expect(
    page.getByRole('button', { name: /: covered, looks empty in the photo$/ }),
  ).toHaveCount(await hatched.count());
});

test('a board entered by hand is drawn plain', async ({ page }) => {
  await page.goto(SCORE);
  await page.getByRole('button', { name: 'Enter by Hand' }).click();
  await expect(page).toHaveURL(/\/score\/review$/);
  await page.getByRole('button', { name: 'All Covered' }).click();
  await expect(plainFill(page)).toHaveCount(81);
  await expect(photoFill(page)).toHaveCount(0);
});
