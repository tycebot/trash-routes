import { expect, test, type Page } from '@playwright/test';

const testStyle = {
  version: 8,
  name: 'Route Review test style',
  sources: {},
  glyphs: 'https://example.test/fonts/{fontstack}/{range}.pbf',
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#dce6dd' } }],
};

async function installDeterministicMap(page: Page) {
  await page.route('https://tiles.openfreemap.org/styles/liberty', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(testStyle),
  }));
}

test.beforeEach(async ({ page }) => {
  await installDeterministicMap(page);
  page.on('dialog', (dialog) => dialog.accept());
});

test('route review draw, edit, and persistence walkthrough', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('100 stops')).toBeVisible();
  await expect(page.getByRole('button', { name: 'View' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Draw' }).click();
  await page.getByRole('button', { name: 'Start drawing' }).click();
  const map = page.getByTestId('route-map');
  const box = await map.boundingBox();
  if (!box) throw new Error('map has no layout box');
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.78, box.y + box.height * 0.72, { steps: 14 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Save route' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save route' }).click();
  await expect(page.getByText('Saved locally')).toBeVisible();
  const savedMileage = await page.locator('.status-bar span').nth(1).textContent();

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Redraw' }).click();
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.68, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Cancel drawing' }).click();
  await expect(page.locator('.status-bar span').nth(1)).toHaveText(savedMileage ?? '');

  await page.getByRole('button', { name: 'Redraw' }).click();
  await page.mouse.move(box.x + box.width * 0.56, box.y + box.height * 0.64);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.78, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Save route' }).click();

  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('100 stops')).toBeVisible();

  await page.getByText('Actions').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  const exportedPath = await download.path();
  if (!exportedPath) throw new Error('export download has no path');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByLabel('Import').setInputFiles(exportedPath);
  await expect(page.getByText('100 stops')).toBeVisible();
});

test('supports zoom controls and exposes install metadata', async ({ page, browserName }) => {
  await page.goto('./');
  await expect(page.locator('.maplibregl-ctrl-zoom-in')).toBeVisible();
  await page.locator('.maplibregl-ctrl-zoom-in').click();
  await page.locator('.maplibregl-ctrl-zoom-in').click();
  await expect(page.getByTestId('route-map')).toBeVisible();

  const manifestResponse = await page.request.get('./manifest.webmanifest');
  expect(manifestResponse.ok()).toBeTruthy();
  expect(await manifestResponse.json()).toMatchObject({ name: 'Route Review', display: 'standalone' });
  if (browserName === 'webkit') {
    const registration = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const ready = await Promise.race([
        navigator.serviceWorker.ready.then(() => 'ready'),
        new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 5000)),
      ]);
      return ready;
    });
    expect(['ready', 'unsupported']).toContain(registration);
  }
});

test('selects a stop and keeps overlays after camera changes', async ({ page }) => {
  await page.goto('./');
  const map = page.getByTestId('route-map');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  const box = await map.boundingBox();
  if (!box) throw new Error('map has no layout box');
  // Probe a small grid around the fixture stop nearest the initial camera center.
  const detail = page.getByText(/Stop \d+ of 100/);
  for (let y = -24; y <= 24 && await detail.count() === 0; y += 4) {
    for (let x = -20; x <= 20 && await detail.count() === 0; x += 4) {
      await page.mouse.click(box.x + box.width / 2 - 6.3 + x, box.y + box.height / 2 - 12.3 + y);
    }
  }
  await expect(detail).toBeVisible();
  await expect(page.getByText(/38\.\d{4}, -121\.\d{4}/)).toBeVisible();
  await page.getByRole('button', { name: '3D' }).click();
  await expect(detail).toBeVisible();
});

test('live OpenFreeMap smoke', async ({ page }) => {
  test.skip(process.env.RUN_LIVE_MAP !== '1', 'Set RUN_LIVE_MAP=1 for the live map smoke test.');
  await page.unroute('https://tiles.openfreemap.org/styles/liberty');
  await page.goto('./');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
});
