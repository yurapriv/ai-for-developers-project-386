import { expect, test, type Page, type Route } from '@playwright/test';

const API_URL = 'http://127.0.0.1:8080';

test.beforeEach(async ({ request }) => {
  // Tests start from an isolated empty catalog; the hook is test-only (E2E_MODE).
  const reset = await request.post(`${API_URL}/__e2e/reset`);
  expect(reset.status()).toBe(204);
});

async function expectSingleSection(page: Page, name: string) {
  const heading = page.getByRole('main').getByRole('heading', { level: 2, name, exact: true });
  await expect(heading).toHaveCount(1);
  await expect(heading).toBeVisible();
}

test('владелец создаёт тип встречи, и гость видит его в каталоге', async ({ page }) => {
  await page.goto('/admin');
  await expectSingleSection(page, 'Создание типа встречи');
  await page.getByLabel('Название', { exact: true }).fill('Знакомство');
  await page.getByLabel('Описание', { exact: true }).fill('Поговорим о задачах и цели буткемпа.');
  await page.getByLabel('Длительность', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Создать тип встречи' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Тип встречи создан' })).toBeVisible();
  const ownerItem = page.getByRole('listitem').filter({ hasText: 'Знакомство' });
  await expect(ownerItem).toHaveCount(1);
  await expect(ownerItem.getByText('Поговорим о задачах и цели буткемпа.')).toBeVisible();
  await expect(ownerItem.getByText('30 минут', { exact: true })).toBeVisible();

  await page.goto('/booking');
  await expectSingleSection(page, 'Типы встреч');
  const guestItem = page.getByRole('listitem').filter({ hasText: 'Знакомство' });
  await expect(guestItem).toHaveCount(1);
  await expect(guestItem.getByText('Поговорим о задачах и цели буткемпа.')).toBeVisible();
  await expect(guestItem.getByText('30 минут', { exact: true })).toBeVisible();
});

test('гость видит сообщение пустого каталога', async ({ page }) => {
  await page.goto('/booking');
  await expectSingleSection(page, 'Типы встреч');
  await expect(page.getByText('Пока нет доступных типов встреч', { exact: true })).toBeVisible();
});

test('ошибки полей формы владельца сохраняют введённые данные', async ({ page }) => {
  await page.goto('/admin');
  await expectSingleSection(page, 'Создание типа встречи');
  await page.getByLabel('Название', { exact: true }).fill('   ');
  await page.getByLabel('Описание', { exact: true }).fill('Описание остаётся в форме.');
  await page.getByLabel('Длительность', { exact: true }).fill('541');
  await page.getByRole('button', { name: 'Создать тип встречи' }).click();

  await expect(page.getByText('Укажите название', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Длительность должна быть целым числом от 1 до 540 минут', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue('   ');
  await expect(page.getByLabel('Описание', { exact: true })).toHaveValue(
    'Описание остаётся в форме.',
  );
  await expect(page.getByLabel('Длительность', { exact: true })).toHaveValue('541');

  // Исправление возвращённых ошибок создаёт тип; введённые данные не потерялись.
  await page.getByLabel('Название', { exact: true }).fill('Знакомство');
  await page.getByLabel('Длительность', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Создать тип встречи' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Тип встречи создан' })).toBeVisible();

  await page.goto('/booking');
  await expect(page.getByRole('listitem').filter({ hasText: 'Знакомство' })).toHaveCount(1);
});

test('сбой загрузки каталога показывает индикатор, сообщение и «Повторить»', async ({ page }) => {
  const held: Route[] = [];
  await page.route('**/meeting-types', (route) => held.push(route));
  await page.goto('/booking');
  await expect(page.getByText('Загрузка каталога…', { exact: true })).toBeVisible();

  for (const route of held.splice(0)) {
    await route.abort();
  }
  await expect(
    page.getByRole('alert').filter({ hasText: 'Не удалось загрузить каталог типов встреч' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();

  await page.unroute('**/meeting-types');
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText('Пока нет доступных типов встреч', { exact: true })).toBeVisible();
});
