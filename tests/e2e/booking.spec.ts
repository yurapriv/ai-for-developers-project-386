import { expect, test } from '@playwright/test';
import { unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const clockFile = resolve('test-results', 'server-clock.txt');

test('устаревший слот и сдвиг окна используют часы сервера', async ({ browser, request }) => {
  const context = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
  const page = await context.newPage();
  try {
    await writeFile(clockFile, '2026-12-31T20:59:59Z');
    await request.post('http://127.0.0.1:8080/__e2e/reset');
    await request.post('http://127.0.0.1:8080/meeting-types', {
      data: { name: 'Встреча', description: 'Описание', durationMinutes: 30 },
    });
    await page.goto('http://127.0.0.1:4173/booking');
    await page.getByRole('button', { name: 'Выбрать', exact: true }).click();
    await page.getByLabel('День').selectOption('2027-01-01');
    await page.getByRole('button', { name: '09:00–09:30' }).click();
    await page.getByLabel('Имя').fill('Гость');
    await page.getByLabel('Email').fill('guest@example.test');

    await writeFile(clockFile, '2027-01-01T21:00:00Z');
    await page.getByRole('button', { name: 'Записаться' }).click();
    await expect(page.getByText('Выберите допустимое время в окне записи')).toBeVisible();
    await expect(page.getByLabel('День')).toHaveValue('');
    await expect(page.getByRole('option', { name: '2027-01-01' })).toHaveCount(0);
    await expect(page.getByRole('option', { name: '2027-01-15' })).toHaveCount(1);
    await page.getByLabel('День').selectOption('2027-01-02');
    await page.getByRole('button', { name: '09:00–09:30' }).click();
    await expect(page.getByLabel('Имя')).toHaveValue('Гость');
    await expect(page.getByLabel('Email')).toHaveValue('guest@example.test');

    await writeFile(clockFile, '2027-01-02T06:00:00Z');
    await page.getByRole('button', { name: 'Записаться' }).click();
    await expect(page.getByText('Выберите допустимое время в окне записи')).toBeVisible();
    await expect(page.getByRole('button', { name: '09:00–09:30' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '09:30–10:00' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.getByRole('button', { name: '09:30–10:00' }).click();
    await expect(page.getByLabel('Имя')).toHaveValue('Гость');
    await page.getByRole('button', { name: 'Записаться' }).click();
    await expect(page.getByRole('heading', { name: 'Запись подтверждена' })).toBeVisible();
  } finally {
    await unlink(clockFile).catch(() => {});
    await context.close();
  }
});

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

test('два гостя разрешают конфликт без потери данных', async ({ browser, request }) => {
  await request.post('http://127.0.0.1:8080/__e2e/reset');
  await request.post('http://127.0.0.1:8080/meeting-types', {
    data: { name: 'Встреча', description: 'Описание', durationMinutes: 30 },
  });
  const first = await browser.newPage();
  const second = await browser.newPage();
  for (const page of [first, second]) {
    await page.goto('/booking');
    await page.getByRole('button', { name: 'Выбрать', exact: true }).click();
    await page.getByLabel('День').selectOption('2027-01-01');
    await page.getByRole('button', { name: '10:00–10:30' }).click();
    await page.getByLabel('Имя').fill('Гость');
    await page.getByLabel('Email').fill('guest@example.test');
  }
  await first.getByRole('button', { name: 'Записаться' }).click();
  await expect(first.getByRole('heading', { name: 'Запись подтверждена' })).toBeVisible();
  await second.getByRole('button', { name: 'Записаться' }).click();
  await expect(
    second.getByText('Это время уже занято. Выберите другой свободный слот'),
  ).toBeVisible();
  await expect(second.getByRole('button', { name: '10:00–10:30' })).toHaveCount(0);
  await expect(second.getByRole('button', { name: '10:30–11:00' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await second.getByRole('button', { name: '10:30–11:00' }).click();
  await expect(second.getByLabel('Имя')).toHaveValue('Гость');
  await expect(second.getByLabel('Email')).toHaveValue('guest@example.test');
  await second.getByRole('button', { name: 'Записаться' }).click();
  await expect(second.getByRole('heading', { name: 'Запись подтверждена' })).toBeVisible();
  await first.close();
  await second.close();
});

test('потерянное после создания подтверждение не вызывает повторной отправки', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:8080/__e2e/reset');
  await request.post('http://127.0.0.1:8080/meeting-types', {
    data: { name: 'Встреча', description: 'Описание', durationMinutes: 30 },
  });
  await page.goto('/booking');
  await page.getByRole('button', { name: 'Выбрать', exact: true }).click();
  await page.getByLabel('День').selectOption('2027-01-01');
  await page.getByRole('button', { name: '10:00–10:30' }).click();
  await page.getByLabel('Имя').fill('Гость');
  await page.getByLabel('Email').fill('guest@example.test');
  let creates = 0;
  page.on('request', (outgoing) => {
    if (outgoing.method() === 'POST' && new URL(outgoing.url()).pathname.endsWith('/bookings'))
      creates++;
  });
  await page.route('**/bookings', async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    await route.abort();
  });
  await page.getByRole('button', { name: 'Записаться' }).click();
  await expect(page.getByText('Не удалось получить подтверждение записи')).toBeVisible();
  await expect(page.getByLabel('Имя')).toHaveValue('Гость');
  await expect(page.getByLabel('Email')).toHaveValue('guest@example.test');
  await expect(page.getByRole('heading', { name: 'Запись подтверждена' })).toHaveCount(0);
  expect(creates).toBe(1);
  const availability = await request.get(
    'http://127.0.0.1:8080/availability?meetingTypeId=1&day=2027-01-01',
  );
  expect(
    (await availability.json()).slots.map((slot: { start: string }) => slot.start),
  ).not.toContain('2027-01-01T10:00:00+03:00');
  await page.route('**/availability?*', (route) => route.abort());
  await page.getByLabel('День').selectOption('2027-01-02');
  await expect(page.getByText('Не удалось загрузить доступность')).toBeVisible();
  await page.unroute('**/availability?*');
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByRole('button', { name: '09:00–09:30' })).toBeVisible();
  expect(creates).toBe(1);
  await page.getByRole('button', { name: '09:00–09:30' }).click();
  await expect(page.getByLabel('Имя')).toHaveValue('Гость');
  await expect(page.getByLabel('Email')).toHaveValue('guest@example.test');
  await page.getByLabel('День').selectOption('2027-01-01');
  await expect(page.getByRole('button', { name: '10:00–10:30' })).toHaveCount(0);
  const retry = await request.post('http://127.0.0.1:8080/bookings', {
    data: {
      meetingTypeId: 1,
      start: '2027-01-01T10:00:00+03:00',
      name: 'Гость',
      email: 'guest@example.test',
    },
  });
  expect(retry.status()).toBe(409);
  expect(creates).toBe(1);
});
