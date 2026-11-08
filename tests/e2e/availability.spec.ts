import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'America/Los_Angeles' });

test('гость выбирает московский день и полный интервал или видит пустой день', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:8080/__e2e/reset');
  await request.post('http://127.0.0.1:8080/meeting-types', {
    data: { name: 'Знакомство', description: 'Встреча', durationMinutes: 45 },
  });
  await page.goto('/booking');
  await page.getByRole('button', { name: 'Выбрать', exact: true }).click();
  await expect(page.getByText('Europe/Moscow')).toBeVisible();
  await page.getByLabel('День').selectOption('2026-12-31');
  await expect(page.getByText('На этот день свободного времени нет')).toBeVisible();
  await page.getByLabel('День').selectOption('2027-01-01');
  await page.getByRole('button', { name: '09:00–09:45' }).click();
  await expect(
    page.getByText('Выбрано: Знакомство, 45 минут, 2027-01-01, 09:00–09:45 (Europe/Moscow)'),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Типы встреч' })).toBeVisible();
});

test('ошибка доступности позволяет повторить запрос выбранного дня', async ({ page, request }) => {
  await request.post('http://127.0.0.1:8080/__e2e/reset');
  await request.post('http://127.0.0.1:8080/meeting-types', {
    data: { name: 'Встреча', description: 'Описание', durationMinutes: 30 },
  });
  await page.goto('/booking');
  await page.getByRole('button', { name: 'Выбрать', exact: true }).click();
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/availability?*', async (route) => {
    await held;
    await route.abort();
  });
  await page.getByLabel('День').selectOption('2027-01-01');
  await expect(page.getByText('Загрузка доступности…')).toBeVisible();
  release?.();
  await expect(page.getByRole('alert')).toHaveText('Не удалось загрузить доступность');
  await page.unroute('**/availability?*');
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByRole('button', { name: '09:00–09:30' })).toBeVisible();
});
