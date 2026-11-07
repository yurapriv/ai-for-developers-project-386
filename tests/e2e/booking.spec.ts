import { expect, test } from '@playwright/test';

test('владелец создаёт тип, гость записывается и возвращается в каталог', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:8080/__e2e/reset');
  await page.goto('/admin');
  await page.getByLabel('Название', { exact: true }).fill('Знакомство');
  await page.getByLabel('Описание', { exact: true }).fill('Тестовая встреча');
  await page.getByLabel('Длительность', { exact: true }).fill('45');
  await page.getByRole('button', { name: 'Создать тип встречи' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Тип встречи создан' })).toBeVisible();
  await page.goto('/booking');
  await page.getByRole('button', { name: 'Выбрать', exact: true }).click();
  await page.getByLabel('День').selectOption('2027-01-01');
  await page.getByRole('button', { name: '10:00–10:45' }).click();
  await page.getByRole('button', { name: 'Записаться' }).click();
  await expect(page.getByText('Введите имя от 1 до 100 символов')).toBeVisible();
  await expect(page.getByText('Введите корректный email')).toBeVisible();
  await page.getByLabel('Имя').fill('Тестовый гость');
  await page.getByLabel('Email').fill('guest@example.test');
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/bookings', async (route) => {
    await held;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Записаться' }).click();
  await expect(page.getByRole('button', { name: 'Отправка…' })).toBeDisabled();
  release?.();
  await expect(page.getByRole('heading', { name: 'Запись подтверждена' })).toBeVisible();
  await expect(page.getByText('Знакомство, 2027-01-01, 10:00–10:45 (Europe/Moscow)')).toBeVisible();
  await expect(page.getByText('Тестовый гость · guest@example.test')).toBeVisible();
  await page.getByRole('button', { name: 'Создать ещё одну запись' }).click();
  await expect(page.getByRole('heading', { name: 'Типы встреч' })).toBeVisible();
});
