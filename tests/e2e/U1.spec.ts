import { expect, test, type Page } from '@playwright/test';

const TOOL = '/tools/first-player';

type Box = { x: number; y: number; width: number; height: number };

/** Points in each direction (degrees, 0 is right, 90 is down) from the table's center. */
function seats(box: Box, degrees: readonly number[]) {
  const radius = box.width * 0.38;
  return degrees.map((degree) => {
    const angle = (degree * Math.PI) / 180;
    return {
      x: box.x + box.width / 2 + radius * Math.cos(angle),
      y: box.y + box.height / 2 + radius * Math.sin(angle),
    };
  });
}

async function tableBox(page: Page): Promise<Box> {
  const box = await page.getByTestId('first-player-table').boundingBox();
  if (!box) throw new Error('first-player table not visible');
  return box;
}

/** Taps the table where players at these directions sit, and returns the tap points. */
async function tapSeats(page: Page, degrees: readonly number[]) {
  const points = seats(await tableBox(page), degrees);
  for (const point of points) await page.mouse.click(point.x, point.y);
  return points;
}

/** The player number of the wedge under each point (markers sit on top, so look through them). */
async function wedgesUnder(page: Page, points: { x: number; y: number }[]) {
  return page.evaluate(
    (pts) =>
      pts.map((point) => {
        const wedge = document
          .elementsFromPoint(point.x, point.y)
          .find((element) => element.getAttribute('data-testid') === 'wedge');
        return wedge?.getAttribute('data-player') ?? null;
      }),
    points,
  );
}

/** Records whether any wedge is ever highlighted mid-spin. */
async function watchSpinSteps(page: Page) {
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="wedge"][data-active]')) {
        (window as unknown as { tkSpinStepSeen: boolean }).tkSpinStepSeen = true;
      }
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });
}

const spinStepSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { tkSpinStepSeen?: boolean }).tkSpinStepSeen === true);

test('players tap where they sit, the roulette spins and lands on one', async ({ page }) => {
  await watchSpinSteps(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /Who Goes First/ }).click();
  await expect(page).toHaveURL(new RegExp(`${TOOL}$`));
  await page.waitForLoadState('networkidle');

  const status = page.getByTestId('first-player-status');
  const table = page.getByTestId('first-player-table');
  await expect(table.getByText('Each player taps where they sit.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Spin' })).toHaveCount(0);

  // One player: the spin button shows, disabled.
  const [first] = await tapSeats(page, [90]);
  await expect(page.getByRole('button', { name: 'Spin' })).toBeDisabled();
  await expect(status).toHaveText('1 player. Spin needs at least 2.');

  // Two more on the other sides: three wedges, each under its own tap.
  const rest = await tapSeats(page, [210, 330]);
  await expect(table.getByTestId('wedge')).toHaveCount(3);
  await expect(table.getByRole('button', { name: /^Remove Player / })).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Spin' })).toBeEnabled();
  if (!first) throw new Error('no first tap');
  expect(await wedgesUnder(page, [first, ...rest])).toEqual(['1', '2', '3']);

  // Tapping a marker removes it; tapping again adds it back as player 3.
  await page.getByRole('button', { name: 'Remove Player 2' }).click();
  await expect(table.getByTestId('wedge')).toHaveCount(2);
  await tapSeats(page, [210]);
  await expect(table.getByTestId('wedge')).toHaveCount(3);

  // A tap too close to someone is refused and says why.
  const box = await tableBox(page);
  await page.mouse.click(box.x + box.width / 2 + 6, box.y + box.height - 10);
  await expect(status).toHaveText('Too close to player 1. Tap nearer your own seat.');
  await expect(table.getByTestId('wedge')).toHaveCount(3);

  await page.getByRole('button', { name: 'Spin' }).click();
  await expect(status).toHaveText('Spinning.');
  await expect(page.getByRole('button', { name: 'Spin' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'New Players' })).toHaveCount(0);

  await expect(page.getByRole('button', { name: 'Spin Again' })).toBeVisible({ timeout: 10_000 });
  expect(await spinStepSeen(page)).toBe(true);
  const announced = await status.textContent();
  const winner = /^Player ([1-3]) goes first\.$/.exec(announced ?? '')?.[1];
  expect(winner, `announcement: ${announced}`).toBeDefined();
  // The status line is a live region, so screen readers hear the winner.
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toBeVisible();
  await expect(table.locator('[data-testid="wedge"][data-winner]')).toHaveAttribute(
    'data-player',
    winner ?? '',
  );

  await page.getByRole('button', { name: 'New Players' }).click();
  await expect(table.getByText('Each player taps where they sit.')).toBeVisible();
  await expect(table.getByTestId('wedge')).toHaveCount(0);
});

test('with reduced motion the winner shows without the spin', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await watchSpinSteps(page);
  await page.goto(TOOL, { waitUntil: 'networkidle' });

  await tapSeats(page, [0, 120, 240]);
  await page.getByRole('button', { name: 'Spin' }).click();
  await expect(page.getByTestId('first-player-status')).toHaveText('Picking.');
  await expect(page.getByTestId('first-player-status')).toHaveText(/^Player [1-3] goes first\.$/);
  await expect(page.getByRole('button', { name: 'Spin Again' })).toBeEnabled();
  expect(await spinStepSeen(page)).toBe(false);
});

test('opens from inside a game and keeps working offline', async ({ page, context }) => {
  await page.goto('/games/azul/score', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Who Goes First' }).click();
  await expect(page).toHaveURL(new RegExp(`${TOOL}$`));
  await page.waitForLoadState('networkidle');

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));

  await tapSeats(page, [45, 225]);
  await page.getByRole('button', { name: 'Spin' }).click();
  await expect(page.getByTestId('first-player-status')).toHaveText(/^Player [12] goes first\.$/, {
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Spin Again' }).click();
  await expect(page.getByTestId('first-player-status')).toHaveText(/^Player [12] goes first\.$/, {
    timeout: 10_000,
  });
  await context.setOffline(false);
});
