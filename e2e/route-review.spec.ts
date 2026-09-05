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
  await expect(page.getByText('20 stops')).toBeVisible();
  await expect(page.getByRole('button', { name: 'View' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Draw' }).click();
  await page.getByRole('button', { name: 'Start sequencing' }).click();
  await expect(page.getByRole('button', { name: 'Save route' })).toBeDisabled();
  await expect(page.getByText('Select all 20 stops before saving.')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('button', { name: 'Start new order' })).toBeVisible();
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

test('supports map controls, 2D/3D state, and PWA metadata', async ({ page, browserName }) => {
  await openMonday(page);
  await expect(page.getByTestId('route-map')).toHaveAttribute('data-map-ready', 'true');
  await page.locator('.maplibregl-ctrl-zoom-in').click();
  await page.locator('.maplibregl-ctrl-zoom-in').click();
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');

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
