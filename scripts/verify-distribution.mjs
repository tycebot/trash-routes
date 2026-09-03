import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const includesAll = (text, values, label) => {
  for (const value of values) assert.ok(text.includes(value), `${label} must include ${value}`);
};

const [pages, verify, windows, tauriText] = await Promise.all([
  read('.github/workflows/pages.yml'),
  read('.github/workflows/verify.yml'),
  read('.github/workflows/windows-release.yml'),
  read('src-tauri/tauri.conf.json'),
]);

includesAll(pages, [
  'pages: write',
  'id-token: write',
  'actions/configure-pages',
  'actions/upload-pages-artifact',
  'actions/deploy-pages',
], 'Pages workflow');
includesAll(verify, [
  'npm ci',
  'npm run lint',
  'npm test',
  'npm run build',
  'playwright install chromium',
  '--project=chromium-desktop',
], 'Verify workflow');
includesAll(windows, [
  'v*',
  'windows-latest',
  'npm ci',
  'tauri-apps/tauri-action',
], 'Windows workflow');

const tauri = JSON.parse(tauriText);
assert.equal(tauri.build.frontendDist, '../dist');
assert.equal(tauri.productName, 'Route Review');
assert.ok(tauri.bundle.targets.includes('nsis'));

console.log('Distribution structure verified.');
