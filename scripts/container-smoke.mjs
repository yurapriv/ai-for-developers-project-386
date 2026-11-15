// Builds and checks the real image. Requires Docker and the Playwright Chromium installation.
import { execFileSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const image = 'calendar-booking-smoke';
let container;
let browser;
try {
  docker('build', '-t', image, '.');
  browser = await chromium.launch();
  for (const internalPort of [8080, 18080]) {
    const env = internalPort === 8080 ? [] : ['-e', `PORT=${internalPort}`];
    container = docker('run', '-d', '--rm', ...env, '-p', `127.0.0.1::${internalPort}`, image);
    const port = docker('port', container, `${internalPort}/tcp`).split(':').at(-1);
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 50 && !ready; attempt++) {
      try {
        ready = (await fetch(`${base}/api/health`)).ok;
      } catch {
        await delay(200);
      }
    }
    assert(ready, 'container did not become ready');
    const root = await fetch(base);
    assert.equal(root.status, 200, 'root healthcheck');
    assert(root.headers.get('content-type')?.includes('text/html'));
    assert.deepEqual(await (await fetch(`${base}/api/meeting-types`)).json(), []);
    for (const path of ['/api/not-an-operation', '/assets/missing.js']) {
      const response = await fetch(base + path, { headers: { accept: 'text/html' } });
      assert.equal(response.status, 404, path);
      assert(!response.headers.get('content-type')?.includes('text/html'), path);
    }
    const invalid = await fetch(`${base}/api/meeting-types`, { method: 'POST' });
    assert(!invalid.ok && !invalid.headers.get('content-type')?.includes('text/html'));

    const page = await browser.newPage();
    for (const path of ['/', '/booking', '/admin', '/unknown-client-route']) {
      const response = await page.goto(base + path);
      assert.equal(response.status(), 200, path);
      await page.reload();
    }
    assert(await page.getByText('Страница не найдена').isVisible());
    await page.goto(`${base}/admin`);
    await page.getByLabel('Название', { exact: true }).fill('Контейнерная встреча');
    await page.getByLabel('Описание', { exact: true }).fill('Проверка настоящего API');
    await page.getByLabel('Длительность', { exact: true }).fill('30');
    await page.getByRole('button', { name: 'Создать тип встречи' }).click();
    await page.getByRole('status').filter({ hasText: 'Тип встречи создан' }).waitFor();
    await page.goto(`${base}/booking`);
    await page.getByRole('listitem').filter({ hasText: 'Контейнерная встреча' }).waitFor();
    const catalog = await (await fetch(`${base}/api/meeting-types`)).json();
    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].name, 'Контейнерная встреча');
    await page.close();
    docker('stop', container);
    container = undefined;
    console.log(`Container smoke passed on port ${internalPort}`);
  }
} finally {
  if (browser) await browser.close();
  if (container) docker('stop', container);
}
