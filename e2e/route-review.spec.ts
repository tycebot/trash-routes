import { expect, test, type Page } from '@playwright/test';

const testStyle = {
  version: 8,
  name: 'Route Review test style',
  sources: {},
  glyphs: 'https://example.test/fonts/{fontstack}/{range}.pbf',
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#dce6dd' } }],
};

test.beforeEach(async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/styles/liberty', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(testStyle),
  }));
  await page.route('https://basemap.nationalmap.gov/**', (route) => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lA7KtQAAAABJRU5ErkJggg==', 'base64'),
  }));
  page.on('dialog', (dialog) => dialog.accept());
});

async function openMonday(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Routes' })).toBeVisible();
  await page.getByRole('button', { name: /Lodi Demo Route/ }).click();
  await expect(page.getByRole('heading', { name: 'Route days' })).toBeVisible();
  await page.getByRole('button', { name: /Monday/ }).click();
  await expect(page.getByTestId('route-map')).toBeVisible();
}

test('selects one route day and exposes its workspace modes', async ({ page }) => {
  await openMonday(page);
  await expect(page.getByText('100 stops')).toBeVisible();
  await expect(page.getByRole('button', { name: 'View' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Draw' }).click();
  await page.getByRole('button', { name: 'Start sequencing' }).click();
  await expect(page.getByRole('button', { name: 'Save route' })).toBeDisabled();
  await expect(page.getByText('Select all 100 stops before saving.')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('button', { name: 'Start new order' })).toBeVisible();
});

test('uses a persistent summary beside the map on laptop screens', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop responsive layout only.');
  await openMonday(page);
  const summary = await page.locator('.route-overview').boundingBox();
  const map = await page.locator('.route-map-frame').boundingBox();
  if (!summary || !map) throw new Error('workspace layout boxes are unavailable');
  expect(summary.x + summary.width).toBeLessThanOrEqual(map.x + 1);
  await expect(page.getByText('Route at a glance')).toBeVisible();
  await expect(page.getByText('Start', { exact: true })).toBeVisible();
  await expect(page.getByText('Finish', { exact: true })).toBeVisible();
});

test('navigates route/day selection and exposes iPad install guidance', async ({ page }) => {
  await openMonday(page);
  await page.getByRole('button', { name: 'Change route/day' }).click();
  await expect(page.getByRole('heading', { name: 'Route days' })).toBeVisible();
  await page.getByRole('button', { name: '‹ Routes' }).click();
  await expect(page.getByRole('heading', { name: 'Routes' })).toBeVisible();
  await page.getByRole('button', { name: /Lodi Demo Route/ }).click();
  await page.getByRole('button', { name: /Monday/ }).click();
  await page.getByText('Install on iPad').click();
  await expect(page.getByText('Add Route Review to the Home Screen')).toBeVisible();
  await expect(page.getByText('Add to Home Screen')).toBeVisible();
});

test('uses the detailed raster map without WebGL', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Lodi Demo Route/ }).click();
  await page.getByRole('button', { name: /Monday/ }).click();
  await expect(page.locator('[data-map-engine="leaflet"]')).toBeVisible();
  await expect(page.getByText('Detailed map · 2D')).toBeVisible();
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByText('3D requires WebGL · showing 2D')).toBeVisible();
  await expect(page.getByText('100 stops')).toBeVisible();
  expect(await page.locator('.leaflet-interactive').count()).toBeGreaterThanOrEqual(100);
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Start new order' }).click();
  await expect(page.getByText('Select all 100 stops before saving.')).toBeVisible();

  const map = page.getByTestId('route-map');
  const box = await map.boundingBox();
  if (!box) throw new Error('compatibility map has no layout box');
  const pane = page.locator('.leaflet-map-pane');
  const beforePan = await pane.getAttribute('style');
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 8 });
  await page.mouse.up();
  await expect(pane).not.toHaveAttribute('style', beforePan ?? '');
});

test('supports detailed 2D, aerial 3D, and PWA metadata', async ({ page, browserName }) => {
  await openMonday(page);
  await expect(page.getByText('Detailed map · 2D')).toBeVisible();
  await page.locator('.leaflet-control-zoom-in').click();
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Aerial map · 3D')).toBeVisible();
  await expect(page.getByTestId('route-map')).toHaveAttribute('data-map-ready', 'true');
  await page.locator('.maplibregl-ctrl-zoom-in').click();
  await page.getByRole('button', { name: '2D' }).click();
  await expect(page.getByText('Detailed map · 2D')).toBeVisible();

  const manifestResponse = await page.request.get('./manifest.webmanifest');
  expect(manifestResponse.ok()).toBeTruthy();
  expect(await manifestResponse.json()).toMatchObject({
    name: 'Route Review',
    display: 'standalone',
    start_url: './',
    scope: './',
  });
  if (browserName === 'webkit') {
    const registration = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      return Promise.race([
        navigator.serviceWorker.ready.then(() => 'ready'),
        new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 5000)),
      ]);
    });
    expect(['ready', 'unsupported']).toContain(registration);
  }
});
