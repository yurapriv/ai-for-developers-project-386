import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Pacific/Honolulu' });

test('владелец создаёт тип, гость записывается и возвращается в каталог', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:8080/__e2e/reset');
  await page.goto('/admin');
  await expect(page.getByText('Предстоящих встреч пока нет')).toBeVisible();
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
  await page.unroute('**/bookings');
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Обновить список' }).click();
  await expect(page.getByText('Знакомство, 2027-01-01, 10:00–10:45 (Europe/Moscow)')).toBeVisible();
  await expect(page.getByText('Тестовый гость · guest@example.test')).toBeVisible();
  await page.goto('/booking');
  await expect(page.getByRole('heading', { name: 'Типы встреч' })).toBeVisible();
});

test('список встреч показывает ошибку и позволяет повторить загрузку', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:8080/__e2e/reset');
  await page.route('**/bookings', (route) => route.abort());
  await page.goto('/admin');
  await expect(page.getByText('Не удалось загрузить предстоящие встречи')).toBeVisible();
  await page.unroute('**/bookings');
  await page.getByRole('button', { name: 'Повторить загрузку встреч' }).click();
  await expect(page.getByText('Предстоящих встреч пока нет')).toBeVisible();
});

test('загрузка списка видна и обновление доступно с клавиатуры на мобильном экране', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:8080/__e2e/reset');
  await page.setViewportSize({ width: 375, height: 812 });
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/bookings', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/admin');
  await expect(page.getByText('Загрузка встреч…')).toBeVisible();
  release?.();
  await expect(page.getByText('Предстоящих встреч пока нет')).toBeVisible();
  await page.unroute('**/bookings');
  await page.getByRole('button', { name: 'Обновить список' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Предстоящих встреч пока нет')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});
