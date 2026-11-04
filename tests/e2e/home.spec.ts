import { expect, test, type Page } from '@playwright/test';

function mainHeading(page: Page, name: string) {
  return page.getByRole('main').getByRole('heading', { level: 1, name, exact: true });
}

async function expectSingleHeading(page: Page, name: string) {
  const firstLevel = page.getByRole('main').getByRole('heading', { level: 1 });
  await expect(firstLevel).toHaveCount(1);
  await expect(mainHeading(page, name)).toBeVisible();
}

function link(page: Page, name: string) {
  return page.getByRole('link', { name, exact: true });
}

test('главная показывает заголовок, описание и обе ссылки', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Календарь встреч');
  await expect(page.getByRole('main')).toBeVisible();
  await expectSingleHeading(page, 'Календарь встреч');
  await expect(
    page.getByText('Выберите удобное время и запишитесь онлайн', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(link(page, 'Записаться')).toHaveAttribute('href', '/booking');
  await expect(link(page, 'Админка')).toHaveAttribute('href', '/admin');
});

test('кнопка «Записаться» ведёт на страницу записи', async ({ page }) => {
  await page.goto('/');
  await expectSingleHeading(page, 'Календарь встреч');
  await link(page, 'Записаться').click();
  await expect(page).toHaveURL('/booking');
  await expectSingleHeading(page, 'Запись на встречу');
  await expect(page.getByText('Этот раздел пока в разработке', { exact: true })).toBeVisible();
  await link(page, 'На главную').click();
  await expect(page).toHaveURL('/');
  await expectSingleHeading(page, 'Календарь встреч');
});

test('кнопка «Админка» ведёт в админку', async ({ page }) => {
  await page.goto('/');
  await expectSingleHeading(page, 'Календарь встреч');
  await link(page, 'Админка').click();
  await expect(page).toHaveURL('/admin');
  await expectSingleHeading(page, 'Админка');
  await expect(page.getByText('Этот раздел пока в разработке', { exact: true })).toBeVisible();
  await link(page, 'На главную').click();
  await expect(page).toHaveURL('/');
  await expectSingleHeading(page, 'Календарь встреч');
});

test('прямые ссылки и обновление сохраняют страницу', async ({ page }) => {
  const routes = [
    { path: '/', heading: 'Календарь встреч' },
    { path: '/booking', heading: 'Запись на встречу' },
    { path: '/admin', heading: 'Админка' },
  ];
  for (const route of routes) {
    await page.goto(route.path);
    await expect(page).toHaveURL(route.path);
    await expectSingleHeading(page, route.heading);
    await page.reload();
    await expect(page).toHaveURL(route.path);
    await expectSingleHeading(page, route.heading);
  }
});

test('история браузера работает между главной и записью', async ({ page }) => {
  await page.goto('/');
  await expectSingleHeading(page, 'Календарь встреч');
  await link(page, 'Записаться').click();
  await expect(page).toHaveURL('/booking');
  await expectSingleHeading(page, 'Запись на встречу');
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expectSingleHeading(page, 'Календарь встреч');
  await page.goForward();
  await expect(page).toHaveURL('/booking');
  await expectSingleHeading(page, 'Запись на встречу');
});

test('неизвестный адрес показывает ошибку и сохраняет URL', async ({ page }) => {
  await page.goto('/unknown-page');
  await expect(page).toHaveURL('/unknown-page');
  await expectSingleHeading(page, 'Страница не найдена');
  await link(page, 'На главную').click();
  await expect(page).toHaveURL('/');
  await expectSingleHeading(page, 'Календарь встреч');
});

test('приложение не зависит от /health', async ({ page, baseURL }) => {
  await page.route('**/health', (route) => route.abort());
  const healthRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/health') {
      healthRequests.push(request.url());
    }
  });
  await page.goto('/');
  await expectSingleHeading(page, 'Календарь встреч');
  await link(page, 'Записаться').click();
  await expect(page).toHaveURL('/booking');
  await expectSingleHeading(page, 'Запись на встречу');
  expect(healthRequests).toEqual([]);
  expect(baseURL).toMatch(/127\.0\.0\.1:4173/);
});

test.describe('мобильный экран 375 × 812', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('действия кликабельны и нет горизонтального переполнения', async ({ page }) => {
    const routes = [
      {
        path: '/',
        heading: 'Календарь встреч',
        links: [
          { name: 'Записаться', target: '/booking', targetHeading: 'Запись на встречу' },
          { name: 'Админка', target: '/admin', targetHeading: 'Админка' },
        ],
      },
      {
        path: '/booking',
        heading: 'Запись на встречу',
        links: [{ name: 'На главную', target: '/', targetHeading: 'Календарь встреч' }],
      },
      {
        path: '/admin',
        heading: 'Админка',
        links: [{ name: 'На главную', target: '/', targetHeading: 'Календарь встреч' }],
      },
      {
        path: '/unknown-page',
        heading: 'Страница не найдена',
        links: [{ name: 'На главную', target: '/', targetHeading: 'Календарь встреч' }],
      },
    ];
    for (const route of routes) {
      await page.goto(route.path);
      await expectSingleHeading(page, route.heading);
      for (const item of route.links) {
        await expect(link(page, item.name)).toBeVisible();
        await expect(link(page, item.name)).toBeEnabled();
        await link(page, item.name).click();
        await expect(page).toHaveURL(item.target);
        await expectSingleHeading(page, item.targetHeading);
        await page.goBack();
        await expect(page).toHaveURL(route.path);
      }
      await expect
        .poll(() =>
          page.evaluate(() => {
            const root = document.documentElement;
            return root.scrollWidth - root.clientWidth;
          }),
        )
        .toBeLessThanOrEqual(0);
    }
  });
});

test('действия доступны с клавиатуры', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(link(page, 'Записаться')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/booking');
  await expectSingleHeading(page, 'Запись на встречу');

  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(link(page, 'Админка')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/admin');
  await expectSingleHeading(page, 'Админка');
});
