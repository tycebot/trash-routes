// @vitest-environment node
import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('production PWA', () => {
  it('emits installable files with base-relative references', async () => {
    const html = await readFile('dist/index.html', 'utf8');
    expect(html).toContain('manifest.webmanifest');
    expect(html).not.toMatch(/(?:src|href)="\/(?:assets|manifest)/);
    await access('dist/manifest.webmanifest');
    await access('dist/sw.js');
    const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
    expect(manifest).toMatchObject({
      name: 'Route Review',
      display: 'standalone',
      start_url: './',
      scope: './',
    });
  });
});
