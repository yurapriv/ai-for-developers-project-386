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

test.use({ timezoneId: 'Pacific/Honolulu' });

test('запрос записи блокирует смену слота и повтор после возврата на мобильном экране', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await request.post('http://127.0.0.1:8080/__e2e/reset');
  await request.post('http://127.0.0.1:8080/meeting-types', {
    data: { name: 'Встреча', description: 'Описание', durationMinutes: 30 },
  });
  await page.goto('/booking');
  await page.getByRole('button', { name: 'Выбрать', exact: true }).press('Enter');
  await page.getByLabel('День').selectOption('2027-01-01');
  await page.getByRole('button', { name: '09:00–09:30' }).press('Enter');
  await page.getByLabel('Имя').fill('Гость');
  await page.getByLabel('Email').fill('guest@example.test');
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let creates = 0;
  await page.route('**/bookings', async (route) => {
    if (route.request().method() === 'POST') {
      creates++;
      await held;
    }
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: 'Записаться' }).press('Enter');
    await expect(page.getByLabel('День')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'К типам встреч' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '09:30–10:00' })).toBeDisabled();
    await page.getByRole('link', { name: 'На главную' }).press('Enter');
    await page.getByRole('link', { name: 'Записаться' }).press('Enter');
    await page.getByRole('button', { name: 'Выбрать', exact: true }).press('Enter');
    await expect(page.getByLabel('День')).toBeDisabled();
    expect(creates).toBe(1);
  } finally {
    release?.();
  }
  await expect(page.getByLabel('День')).toBeEnabled();
});

test('дата подтверждения берётся из ответа о записи в московском часовом поясе', async ({
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
  await page.getByRole('button', { name: '09:00–09:30' }).click();
  await page.getByLabel('Имя').fill('Гость');
  await page.getByLabel('Email').fill('guest@example.test');
  // Exercise the authoritative response independently of the selected day.
  await page.route('**/bookings', async (route) => {
    const response = await route.fetch();
    const booking = await response.json();
    booking.start = '2027-01-01T18:00:00-12:00';
    booking.end = '2027-01-01T18:30:00-12:00';
    await route.fulfill({ response, json: booking });
  });
  await page.getByRole('button', { name: 'Записаться' }).click();
  await expect(page.getByText('Встреча, 2027-01-02, 09:00–09:30 (Europe/Moscow)')).toBeVisible();
});

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

test('два гостя разрешают конфликт без потери данных', async ({ browser, request }) => {
  await request.post('http://127.0.0.1:8080/__e2e/reset');
  await request.post('http://127.0.0.1:8080/meeting-types', {
    data: { name: 'Встреча', description: 'Описание', durationMinutes: 30 },
  });
  const first = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const second = await browser.newPage({ viewport: { width: 375, height: 812 } });
  for (const page of [first, second]) {
    await page.goto('/booking');
    await page.getByRole('button', { name: 'Выбрать', exact: true }).press('Enter');
    await page.getByLabel('День').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: '10:00–10:30' }).press('Enter');
    await page.getByLabel('Имя').fill('Гость');
    await page.getByLabel('Email').fill('guest@example.test');
  }
  await first.getByRole('button', { name: 'Записаться' }).press('Enter');
  await expect(first.getByRole('heading', { name: 'Запись подтверждена' })).toBeVisible();
  await second.getByRole('button', { name: 'Записаться' }).press('Enter');
  await expect(
    second.getByText('Это время уже занято. Выберите другой свободный слот'),
  ).toBeVisible();
  await expect(second.getByRole('button', { name: '10:00–10:30' })).toHaveCount(0);
  await expect(second.getByRole('button', { name: '10:30–11:00' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await second.getByRole('button', { name: '10:30–11:00' }).press('Enter');
  await expect(second.getByLabel('Имя')).toHaveValue('Гость');
  await expect(second.getByLabel('Email')).toHaveValue('guest@example.test');
  await second.getByRole('button', { name: 'Записаться' }).press('Enter');
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

test('потеря тела успешного ответа оставляет результат записи неопределённым', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:8080/__e2e/reset');
  await request.post('http://127.0.0.1:8080/meeting-types', {
    data: { name: 'Встреча', description: 'Описание', durationMinutes: 30 },
  });
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const input = args[0];
      if (
        input instanceof Request &&
        input.method === 'POST' &&
        new URL(input.url).pathname.endsWith('/bookings') &&
        response.status === 201
      ) {
        response.text = () => Promise.reject(new Error('Соединение прервано при чтении'));
      }
      return response;
    };
  });
  await page.goto('/booking');
  await page.getByRole('button', { name: 'Выбрать', exact: true }).click();
  await page.getByLabel('День').selectOption('2027-01-01');
  await page.getByRole('button', { name: '10:00–10:30' }).click();
  await page.getByLabel('Имя').fill('Гость');
  await page.getByLabel('Email').fill('guest@example.test');
  await page.getByRole('button', { name: 'Записаться' }).click();
  await expect(page.getByText('Не удалось получить подтверждение записи')).toBeVisible();
  await expect(page.getByLabel('Имя')).toHaveValue('Гость');
  const response = await request.get('http://127.0.0.1:8080/bookings');
  expect(await response.json()).toHaveLength(1);
});
