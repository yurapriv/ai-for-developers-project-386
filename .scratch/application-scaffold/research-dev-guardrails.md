# Scaffold: тесты, линтеры, хуки и CI относительно dev-guardrails

Дата проверки: **2026-11-02**. Статус: исследование, **не выбор стека и не реализация**. Кандидат: TypeScript, React/Vite, Node.js с Fastify либо Hono; локально native Windows/PowerShell, CI — Ubuntu. Все предложенные ниже команды — будущий контракт, сейчас их в проекте нет.

## Краткий вывод

- Первоисточник подборки с высокой уверенностью найден: **[mokevnin/dev-guardrails](https://github.com/mokevnin/dev-guardrails)**, теперь **[mokevnin/dev-quality-gates][gates]**. Связь именно с конкретной редакцией закрытого упражнения календаря публично не доказана; доказательства и граница уверенности ниже.
- Минимум после выбора TS-стека: строгая проверка типов, **один** линтер и **один** форматтер, Vitest с одним настоящим process/HTTP smoke-тестом, сборка, единая задача `check`, locked install и отдельный Linux workflow на каждый push. Это предлагаемый минимум проекта, не универсальный обязательный набор Хекслета.
- Наиболее прямое соответствие текущим рекомендациям подборки: **Oxlint + Oxfmt + отдельный `tsc`**. Biome и ESLint сравниваются как альтернативы, а не как дополнительные обязательные инструменты. Oxfmt пока `0.x`; у ESLint/TypeScript есть существенная граница совместимости.
- Правило Conventional Commits отделить от необязательной автоматизации через commitlint. Release-автоматизация не нужна. Браузерный E2E-раннер не нужен только ради проверки запуска HTTP-сервера, но потребуется пересмотр для пользовательского пути календаря.

## 1. Происхождение и редакция подборки

Цепочка первичных источников:

1. В [README шаблона организации Hexlet](https://github.com/hexlet-boilerplates/ai-metarepo/blob/d10ba451f857bc7971426f2f2729e16884a86af1/README.md#источник-тулов) прямо написано: `mokevnin/dev-guardrails` — «откуда берутся тулы и проверки для метарепозитория». Это не совпадение названия в постороннем репозитории.
2. На [официальной странице курса][course] автором назван Кирилл Мокевнин и дана ссылка на GitHub `mokevnin`; итоговый проект — календарный букинг с TypeSpec, тестами и CI, стек на выбор. Сама публичная страница не содержит проверяемой прямой ссылки «упражнение календаря → dev-guardrails».
3. [GitHub API старого адреса](https://api.github.com/repos/mokevnin/dev-guardrails) перенаправляет к тому же репозиторию с `full_name: mokevnin/dev-quality-gates`. Прочитанный snapshot: **[`829848c77853988cee6683b0d3bfe4904181be95`][gates]**, [дата коммита 2026-11-01](https://api.github.com/repos/mokevnin/dev-quality-gates/commits/829848c77853988cee6683b0d3bfe4904181be95). Текущее название README — **Dev Quality Gates**.

**Уверенность:** высокая в идентификации связанной с Hexlet/автором подборки и переименования; ограниченная в том, что именно этот snapshot указан в доступной пользователю версии упражнения. Без исходного текста задания это нельзя объявлять доказанным. `hexlet/dev-guardrails` при проверке вернул 404; одноимённые независимые проекты не использовались как замена. Общий веб-поиск был недоступен (HTTP 402); поиск через GitHub API и чтение первоисточников сработали.

**Важно для трактовки:** [README][gates] и [инструкция внедрения][adopt] прямо запрещают устанавливать всю подборку. Рекомендации — только раздел `Recommendations`/`tools.json`; `Under review` и рабочие исследования не равны одобренному выбору. Например, `research/stack-javascript.md` в этом snapshot ещё предлагает ESLint/Prettier, но актуальные README и [реестр][registry] рекомендуют Oxlint/Oxfmt. В выводах ниже приоритет у README/реестра, а факты об инструментах перепроверены у их авторов.

## 2. Что рекомендует источник и что обязательно здесь

Обозначения: **минимум** — предложение для приёмки будущего scaffold; **условно/опционально** — отдельное решение после появления соответствующей задачи. Это не попытка выдать всю подборку за требования курса.

| Область | Позиция подборки | Применение к scaffold |
| --- | --- | --- |
| TypeScript | `tsc --noEmit`, `strict`; отдельная проверка типов [реестр][registry] | **Минимум при выборе TS**: проверять frontend, backend, тесты и конфиги, а не только открытые в IDE файлы. Vite сам типы не проверяет [Vite][vite-ts]. |
| JS/TS lint и format | Oxlint + Oxfmt; меньше дублирующих инструментов; ограничения нужно учитывать [README][gates] | **Минимум**: один выбранный набор; warnings должны блокировать проверку. Для Oxc — `oxlint --deny-warnings` ([CLI](https://oxc.rs/docs/guide/usage/linter/cli.html)) и `oxfmt --check` ([CLI](https://oxc.rs/docs/guide/usage/formatter/cli.html)). |
| Тесты | В `Recommendations` есть `diff-cover`, но **нет выбора универсального TS test runner** [реестр][registry] | Vitest — самостоятельная рекомендация этого исследования для кандидата Vite/TS, не требование подборки. **Минимум**: тест реально запускает сервер и проверяет HTTP-ответ. |
| Git hooks | hk; быстрые staged-проверки на commit, полные на push; hooks не заменяют CI [patterns][patterns] | **Минимум процесса**: описать установку хуков и одинаковые проверки. Конкретный менеджер и Windows-поддержка согласуются по отдельному исследованию mise/hk/pitchfork. |
| CI | Одна задача `check`, общие pins, CI как обязательный gate, actions по полному SHA; доказать, что проверки умеют падать [adopt][adopt] | **Минимум**: отдельный Ubuntu workflow с locked install и `check` на каждый push; неизменяемый Hexlet workflow сохранить. |
| Git conventions | commitlint проверяет Conventional Commits, в hook либо по CI range [реестр][registry] | **Правило обязательно по запросу задачи**, сам commitlint — **опциональная автоматизация**. Без него соблюдение остаётся ручной дисциплиной, а не техническим gate. |
| Coverage | `diff-cover` для покрытия изменённых строк; собственный общий порог runner остаётся отдельным [реестр][registry] | **Опционально**: сначала содержательные тесты; не добавлять Python-инструмент и произвольные «80/100%» только ради одного smoke-теста. |
| Другие категории | Всегда рассмотреть secrets, vulnerabilities, updates, configs и CI linter [adopt][adopt] | Рассмотреть, но **не устанавливать автоматически**. Knip/architecture rules — после появления кода; syncpack — только при реальной необходимости согласовывать версии в monorepo. |

Для CI-lint подборка рекомендует [jactionlint](https://github.com/jdx/jactionlint), причём [реестр][registry] явно отмечает его молодость и одного сопровождающего. Это отдельный осознанный выбор, не причина добавлять сразу несколько workflow-линтеров. Если проверка требует исправить запрещённый к изменению `.github/workflows/hexlet-check.yml`, нельзя молча править этот файл: нужен узкий документированный policy exception для upstream-файла либо отдельное решение владельца. Не отключать соответствующее правило для всех своих workflow.

## 3. Подтверждённые версии и совместимость

Снимок публичных метаданных на дату среды; версии не взяты из памяти или прогнозов. `latest` ниже означает значение, увиденное при исследовании; его **не следует** оставлять плавающим в будущей конфигурации. Наличие публикации не означает, что совместная установка здесь проверена.

| Инструмент | Подтверждённая версия / дата публикации | Существенное ограничение и первоисточник |
| --- | --- | --- |
| Node.js | **24.22.2**, 2026-10-27; bundled npm **11.19.1** | LTS `Krypton`; официальный индекс содержит Windows x64/arm64 и Linux x64/arm64 дистрибутивы. Предлагаемая общая линия runtime, не единственная возможная: [индекс Node][node-index]. |
| TypeScript | **7.0.2**, 2026-07-08 | `engines.node >=16.20.0` в metadata; есть native optional packages для Windows/Linux x64/arm64: [версия](https://registry.npmjs.org/typescript/7.0.2), [даты](https://registry.npmjs.org/typescript). Для проекта использовать более строгий общий runtime Node 24. |
| Vite | **8.3.5**, 2026-10-21 | Node `^20.19.0 || >=22.12.0`: [metadata](https://registry.npmjs.org/vite/8.3.5), [даты](https://registry.npmjs.org/vite). Не путать с отстающим баннером сайта `8.3.4`. |
| Vitest | **5.1.0**, 2026-11-02, `16:12:37Z` | Node `^22.12.0 || ^24.0.0 || >=26.0.0`; Vite peer `^6.4.0 || ^7.0.0 || ^8.0.0`: [metadata](https://registry.npmjs.org/vitest/5.1.0), [даты](https://registry.npmjs.org/vitest), [docs][vitest]. Релиз того же дня, не предположение о будущем. |
| Oxlint | **1.90.0**, 2026-10-27 | Node `^20.19.0 || >=22.12.0`; optional bindings Windows/Linux: [metadata](https://registry.npmjs.org/oxlint/1.90.0), [даты](https://registry.npmjs.org/oxlint). |
| Oxfmt | **0.75.0**, 2026-10-27 | Те же Node-ограничения и платформенные bindings; ещё pre-1.0: [metadata](https://registry.npmjs.org/oxfmt/0.75.0), [даты](https://registry.npmjs.org/oxfmt). |
| Biome | **2.6.4**, 2026-10-28 | npm wrapper: Node `>=14.21.3`; standalone не требует Node. Native Windows/Linux x64/arm64: [metadata](https://registry.npmjs.org/@biomejs%2fbiome/2.6.4), [даты](https://registry.npmjs.org/@biomejs%2fbiome), [официальная установка][biome-install]. |
| ESLint | **10.14.0**, 2026-10-30 | Node `^20.19.0 || ^22.13.0 || >=24`: [metadata](https://registry.npmjs.org/eslint/10.14.0), [даты](https://registry.npmjs.org/eslint), [docs][eslint]. |
| typescript-eslint | **8.72.1**, 2026-10-26 | ESLint `^8.57 || ^9 || ^10`, но TypeScript только **`>=4.8.4 <6.1.0`**: [metadata](https://registry.npmjs.org/typescript-eslint/8.72.1), [даты](https://registry.npmjs.org/typescript-eslint), [официальная матрица][ts-eslint]. |
| Альтернатива TS для ESLint | **6.0.3**, 2026-04-16 | Подтверждённый стабильный 6.0.x внутри поддерживаемого диапазона: [metadata](https://registry.npmjs.org/typescript/6.0.3), [даты](https://registry.npmjs.org/typescript). Это альтернатива TS 7, не предложение держать два компилятора в scaffold. |
| Prettier, если выбран ESLint | **3.9.10**, 2026-10-10 | Отдельный formatter, Node `>=14`: [metadata](https://registry.npmjs.org/prettier/3.9.10), [даты](https://registry.npmjs.org/prettier). Не добавлять поверх Oxfmt/Biome. |
| commitlint, если автоматизируем | **21.2.4** у CLI и config-conventional, 2026-10-18 | Node `>=22.12.0`: [CLI metadata](https://registry.npmjs.org/@commitlint%2fcli/21.2.4), [CLI даты](https://registry.npmjs.org/@commitlint%2fcli), [config metadata](https://registry.npmjs.org/@commitlint%2fconfig-conventional/21.2.4). |

Node 24.22.2 удовлетворяет заявленным engine-диапазонам основной комбинации. Это **проверка метаданных**, не выполненный compatibility test. Для воспроизводимости не нужно обновлять bundled npm до текущего другого major без причины. Платформенные пакеты в optional dependencies — не повод устанавливать с `--omit=optional` или переносить готовый `node_modules` между Windows и Ubuntu.

### Выбор линтера и форматтера без лишнего стека

| Вариант | Что даёт | Что нельзя обещать |
| --- | --- | --- |
| **Oxlint + Oxfmt** | Текущий выбор подборки. JS/TS/JSX/TSX, встроенные группы React, Vitest, jsx-a11y; formatter поддерживает также CSS/JSON/YAML/Markdown [Oxlint][oxlint], [plugins][ox-plugins], [Oxfmt][oxfmt]. | Не полная замена любому ESLint plugin. JS plugins помечены alpha; Oxfmt pre-1.0 и имеет осознанные отличия от Prettier. React/a11y/Vitest plugins не все включены по умолчанию — нужные правила надо явно настроить, а не считать установленный binary достаточным. |
| **ESLint + typescript-eslint + Prettier** | Расширяемость через parsers/plugins, flat config; уместен при конкретных нужных ESLint-правилах [ESLint][eslint]. CI-политика — `eslint . --max-warnings 0`. | На дату проверки нельзя заявлять официальную поддержку TS 7 через typescript-eslint. Для простого scaffold разумнее TS 6.0.3 либо другой линтер, а не два TS-компилятора и `--legacy-peer-deps`. Настройки React тоже требуют проверки peers, не слепого копирования старого шаблона. |
| **Biome** | Один binary для format/lint/import assist; `biome ci . --error-on-warnings` без записи файлов [CI][biome-ci], [CLI][biome-cli]. Меньше отдельных CLI, native Windows/Linux. | В этой подборке остаётся `Under review`, поэтому нельзя называть его её одобренным выбором. Собственная type inference не заменяет `tsc`; нельзя обещать полное равенство ESLint rules или Prettier output [сравнение Biome](https://biomejs.dev/introduction/comparison-with-other-tools/), [различия formatter](https://biomejs.dev/formatter/differences-with-prettier/). |

**Предложение:** при подтверждении кандидата TS/React/Vite начать с Oxc + `tsc`, принять и зафиксировать риск Oxfmt `0.x`. Не добавлять одновременно ESLint, Biome и Oxlint. Если человеческое решение — минимальное число CLI с Biome либо нужный ESLint plugin, записать это как осознанное отклонение от текущей рекомендации подборки. Существующий рабочий набор источник рекомендует сохранять, а не заменять ради моды [adopt][adopt]; здесь такого набора пока нет.

Type-aware lint — **отдельная опция**, не синоним typecheck. У Oxlint он требует дополнительного `oxlint-tsgolint`, TS 7+, не поддерживает некоторые старые настройки, например `baseUrl`; покрытие правил неполное [официальная документация][ox-types]. Для первой проверки запуска достаточно обычного lint + отдельного `tsc`. При добавлении type-aware режима pin обоих пакетов и отдельный отрицательный тест на, например, unhandled promise обязательны для подтверждения реального enforcement.

## 4. Тестовый runner и один настоящий smoke-тест

### Почему Vitest

Для кандидата Vite/React/TS это соразмерный единый test runner: поддерживает TS/JSX и Vite resolution/config, по умолчанию `environment: node`; команда **`vitest run`** однократная, в отличие от dev watch [начало работы][vitest], [возможности][vitest-features], [окружения](https://vitest.dev/guide/environment). Для server smoke не нужны `jsdom`, Testing Library, Supertest, Jest или браузер. Typecheck оставить отдельным: runtime-тесты и компиляция — разные проверки; у Vitest есть отдельный opt-in [режим тестирования типов](https://vitest.dev/guide/testing-types).

Встроенный `node:test` — разумная более лёгкая альтернатива для backend-only JS/TS, но не добавлять его вторым обязательным runner. Native Node type stripping не читает `tsconfig.json`, не выполняет typecheck и не поддерживает `.tsx` [Node TypeScript](https://nodejs.org/docs/v24.22.2/api/typescript.html), поэтому для потенциального React/Vite набора Vitest уменьшает число разных путей выполнения тестов. Это инженерная оценка удобства, не измеренный benchmark.

### Контракт smoke-теста (предложение, не исполнявшийся код)

Один тест: **«собранный сервер стартует отдельным процессом и отвечает на настоящий HTTP-запрос»**. Проверяем запуск production entrypoint и реальный loopback socket; успех injection-теста сам по себе этого не доказывает. Fastify прямо называет `.inject()` fake HTTP injection и отдельно показывает тестирование слушающего сервера [Fastify testing][fastify-tests]; у Hono для Node есть `@hono/node-server` [Hono Node][hono-node].

1. **Перед тестом собрать приложение** штатной build-задачей. Запускать Node напрямую с построенным серверным entrypoint, например `dist/server.js` (путь иллюстративный), через `spawn(process.execPath, [entrypoint], { shell: false, ... })`. Не запускать watcher, npm shell wrapper или специально написанный тестовый HTTP-сервер вместо приложения. Это снижает риск осиротевших внуков и проблем `.cmd`/quoting на Windows [Node child_process][child].
2. **Изолировать адрес и окружение:** explicit `cwd`, наследование окружения с ограниченными overrides, bind `127.0.0.1`, `PORT=0`. В коде запуска строка `'0'` должна стать числом `0`, а не fallback на 3000. ОС выбирает порт при `listen(0)`; читать фактический порт только после `listening` через `server.address()` [Node net][net]. Не «найти свободный порт, закрыть probe, потом запустить сервер»: между этими действиями порт может занять другой процесс.
3. **Узнать адрес от самого запущенного процесса:** одна структурированная startup-запись с адресом/портом после успешного bind, либо IPC ready-сообщение. Startup-record — часть будущего boot-контракта, а не готовая возможность этого scaffold. Проверить host и диапазон порта. stdout читать построчно с буферизацией: chunk не равен строке; stderr/stdout постоянно дренировать, но хранить только ограниченный хвост для диагностики, иначе pipe способен заблокировать ребёнка [Node child_process][child].
4. **Ожидание ограничить:** предлагаем startup/readiness deadline **10 секунд**, внешний `testTimeout` **20 секунд**, cleanup/hook budget **5 секунд**. Это наши стартовые бюджеты для маленького сервиса, не норматив инструмента; после измерений скорректировать без бесконечного ожидания. Vitest по умолчанию даёт Node-тесту 5 секунд, hook — 10, поэтому значения надо задать явно [testTimeout](https://vitest.dev/config/testtimeout), [hookTimeout](https://vitest.dev/config/hooktimeout).
5. **Настоящий HTTP:** после ready выполнить встроенный Node `fetch` к `http://127.0.0.1:<порт>/<проверяемый-маршрут>`. Предпочтителен минимальный health endpoint либо стабильный существующий маршрут с проверяемым телом. Endpoint и его точный ответ ещё предстоит выбрать. На каждый запрос — abort deadline, например **1 секунда**, включая чтение тела; общий readiness deadline не сбрасывать при retry. `fetch` и `AbortSignal.timeout()` доступны в выбранном runtime [Node globals](https://nodejs.org/docs/v24.22.2/api/globals.html#static-method-abortsignaltimeoutdelay).
6. **Условие успеха:** HTTP **200**, ожидаемый `Content-Type` и точное/структурно проверенное тело, ребёнок не завершился до ответа. Не достаточно «порт открыт», текста `server started` либо любого `response.ok`. Для health-маршрута не разрешать redirect скрыть ошибочный адрес. Если используются retries, ограничить их только ожиданием готовности, не перезапускать падающий сервер до «зелёного» результата.
7. **Ранняя ошибка:** `spawn error`, неожиданный `exit/close`, неверный startup-record, превышение deadline, HTTP mismatch — провал с exit status процесса и ограниченным хвостом stdout/stderr. Подписки на события выхода установить сразу после spawn, до ожидания ready, чтобы не потерять ранний crash [Node child_process][child].
8. **Cleanup зарегистрировать сразу**, до readiness/HTTP, и выполнить при успехе, assertion failure и timeout. В `finally`/teardown остановить только принадлежащий тесту процесс; на Linux сначала `SIGTERM`, короткое ограниченное ожидание, затем `SIGKILL` при необходимости. На Windows Node эмулирует эти сигналы принудительным завершением — **не обещать graceful shutdown через SIGTERM**. Для одинакового graceful пути нужен отдельный IPC shutdown-протокол, если он действительно нужен приложению. Ждать фактический `close`: `kill()`/`killed` не подтверждают завершение [Node subprocess.kill](https://nodejs.org/docs/v24.22.2/api/child_process.html#subprocesskillsignal).
9. **Не оставлять ресурсы:** очистить timers/listeners/streams, закрыть клиентское тело/соединение; не использовать `detached`/`unref` как «cleanup». Нельзя убивать все `node.exe`, все процессы на порту или чужой dev server. По возможности direct child не должен создавать своих потомков. Повторный запуск теста не должен сталкиваться с оставленным процессом.
10. **Проверить сам gate после реализации:** happy path; временно сломанный entrypoint/ответ должен дать non-zero; зависший старт должен укладываться в deadline и убираться. Обычный прогон обязан находить этот smoke-файл: не включать `passWithNoTests` [Vitest](https://vitest.dev/config/passwithnotests). Одна успешная проверка не покрывает конфликт бронирований, окно записи или клиентскую интеграцию.

**Отмена — часть реализации:** таймаут Vitest сам по себе не останавливает `fetch`, child process и polling loop. Передавать `signal` тестового контекста/общего deadline в операции ожидания и запросы; отмена должна приводить к тому же ограниченному teardown. Даже `spawn` с AbortSignal не заменяет ожидание `close` и escalation при игнорировании SIGTERM. Официальный Vitest [recipe cancellable resources](https://vitest.dev/guide/recipes/cancellable) отдельно описывает этот риск.

Ограничения cleanup: `finally` не выполняется при аварийном убийстве самого test runner/машины. Дочерний watchdog/обработка разрыва IPC возможны как усиление; их не следует выдавать за уже обеспеченную гарантию. Аналогично отдельный child не обязательно входит в coverage-инструментацию родительского Vitest — успешный process smoke не доказывает процент покрытия backend.

### Соразмерность браузерного E2E

Для описанного smoke **Playwright избыточен**: он добавляет браузерные binaries, системные зависимости и второй жизненный цикл. Сам Playwright позиционируется как browser E2E framework; поддерживает Windows/Linux и требует отдельной установки браузеров [официальная установка][playwright].

Однако публичная [программа курса][course] предусматривает интеграционные/E2E тесты итогового приложения. Process/HTTP smoke **не равен** сценарию «гость выбирает тип встречи → слот → подтверждает запись». Когда появится UI, отдельное решение о Playwright и небольшом browser happy path будет оправданно. Для этого scaffold не нужны сразу Chromium/Firefox/WebKit matrix, screenshots, a11y runner и visual regression. Отложить runner сейчас — не отменить проверку пользовательского пути навсегда.

## 5. Одна задача check и воспроизводимость

Предлагаемый внешний интерфейс — **`check`**: локальный запуск и CI вызывают одну и ту же полную задачу. Если выбранный task runner будет mise, это может быть `mise run check`; если package scripts — `npm run check`. Это не два независимо поддерживаемых pipeline: один может быть тонким делегирующим wrapper другого [adopt][adopt], [patterns][patterns]. Детали Windows/mise/hk/pitchfork — вне этого исследования.

Состав `check` после утверждения стека:

1. Проверка форматирования **без записи файлов**.
2. Lint с блокирующими errors/warnings.
3. Отдельная строгая проверка типов (`tsc --noEmit` по всем нужным tsconfig; [`strict`](https://www.typescriptlang.org/tsconfig/strict.html)).
4. Штатная сборка frontend/backend.
5. Однократный запуск Vitest, включающий process/HTTP smoke **с уже собранным entrypoint**. Не запускать вторую копию того же smoke через отдельную обязательную команду.
6. Остальные **принятые**, а не все найденные проверки. Когда появится генерация TypeSpec/OpenAPI/SDK, добавить regeneration-and-diff gate для согласованных generated files [patterns][patterns]; само требование контракта уже записано в [README проекта](../../README.md#требования-к-будущей-реализации).

Каждая ошибка должна передавать non-zero наружу, без `continue-on-error`, `|| true`, `--if-present` для обязательных задач или silent «нет файлов — успех». `fix` — отдельная локальная команда, не часть `check` и не CI autofix. Build до smoke — обязательная зависимость, её нельзя распараллелить с запуском child, читающего build artifacts.

**Предложение по install без выбора лишнего package manager:** npm из pinned Node достаточно. Если он утверждён — versioned `package.json` + `package-lock.json`, точные dev-tool версии и **`npm ci`** на чистом CI и при воспроизведении. Команда требует lock, отказывает при несовпадении manifest/lock и не обновляет их; влияющие на дерево параметры должны совпадать [npm ci][npm-ci], [setup-node lockfiles][setup-node]. Если будет выбран pnpm, эквивалент — committed `pnpm-lock.yaml` и `pnpm install --frozen-lockfile`; не хранить два конкурирующих lockfile [setup-node][setup-node].

Lock фиксирует версии зависимостей, но не делает Windows/Linux файловые деревья побитово одинаковыми и не гарантирует доступность registry. Pin runtime и package-manager версии отдельно; обновления делать намеренно, с проверкой diff lock. Не использовать в CI `npx <отсутствующий-пакет>` с неявной скачкой latest: вызывать локальные binaries через package scripts. `npm run` добавляет `node_modules/.bin` в PATH; даже из PowerShell его default script shell на Windows — **cmd.exe**, на Unix — `/bin/sh` [npm run](https://github.com/npm/cli/blob/v11.19.1/docs/lib/content/commands/npm-run.md). Поэтому не встраивать POSIX `VAR=value`, `rm`, bash pipeline или PowerShell-only синтаксис в общий task; переменные задавать через runner/config либо Node API, cleanup — через Node API.

## 6. Hooks, Linux Actions и коммиты

### Hooks: быстрая обратная связь, не единственный gate

- На pre-commit — быстрые format/lint проверки изменённых файлов; на commit-msg — commitlint **только если его приняли**; на pre-push — полный `check` либо согласованный полный набор без дублирования.
- Установка хуков должна быть явным повторяемым setup-шагом после clone; не менять глобальный Git config. Выбор менеджера не зафиксирован этим документом.
- Важна семантика частичного staging: проверка текущего worktree-файла не обязательно проверяет staged blob. Настроить поддержку staged contents выбранным менеджером; не делать скрытого `git add`, не включать незастейдженную пользовательскую работу ради автоформатирования.
- Полный CI повторяет обязательные проверки независимо от hook и `--no-verify`. Это требование [patterns][patterns], а не повод запрещать обход локального hook на уровне ОС.

### Отдельный workflow качества

Локальные первоисточники: [AGENTS.md](../../AGENTS.md), [hexlet-check.yml](../../.github/workflows/hexlet-check.yml), [.github/workflows/README.md](../../.github/workflows/README.md). **Не редактировать, не переименовывать и не удалять** `hexlet-check.yml`; не переименовывать репозиторий. Он уже запускается на branch/tag push под Ubuntu, использует `hexlet/project-action@release` и `HEXLET_ID`, но не описывает наш будущий локальный `check`. Проверки Хекслета становятся доступны после выполнения всех задач в интерфейсе; это не замена собственному CI.

Предлагаемый отдельный `quality.yml`, пока только дизайн:

1. `on: push` **без branch/path filters**; дополнительно `pull_request` — опционально для feedback до merge. GitHub подтверждает, что без branch/tag filters push затрагивает оба вида ref [триггеры][triggers]. Не обещать буквально все возможные pushes: GitHub имеет исключения для событий от `GITHUB_TOKEN` и skip directives; для обычных пользовательских pushes фильтры не нужны.
2. Один Linux job, например `runs-on: ubuntu-24.04`, с конечным job timeout (предложение: **10 минут**), без DB/browser services для первого smoke. Windows CI job — полезное отдельное расширение, **не обязательный второй job**; native PowerShell путь всё равно нужно реально проверить при внедрении.
3. Checkout → pinned runtime/package manager из общего toolchain contract → locked install с dev dependencies → **тот же `check`**. Не предполагать, что preinstalled версия runner совпадает с локальной. Если пользуемся setup-node, он умеет читать version-file; cache хранит package cache, не готовый `node_modules` [setup-node][setup-node]. Cache — оптимизация, не условие корректности.
4. Actions закрепить **полным проверенным commit SHA**, минимальные permissions `contents: read`, checkout `persist-credentials: false`; новые SHA выбирать по официальным release/tag, не сочинять здесь. Это рекомендации [adopt][adopt] и [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use). Запрет редактирования upstream Hexlet workflow остаётся исключением из нашей новой политики pinning.
5. После внедрения показать и зелёный проход, и контролируемое падение. Сейчас нет ни workflow-run, ни доказательства кроссплатформенной работоспособности. Для обязательного merge gate дополнительно нужны required status checks в правилах репозитория: наличие YAML само по себе не запрещает merge.

### Conventional Commits: правило отдельно, автоматизация отдельно

Правило — **[Conventional Commits 1.0.0][cc]**: `<type>[optional scope][!]: <description>`, при необходимости body/footer; `feat` для функциональности, `fix` для исправления, `BREAKING CHANGE:` либо `!` для несовместимости. `docs`, `test`, `ci`, `build`, `refactor`, `chore` допустимы, но конечный whitelist — локальная политика, не весь обязательный текст спецификации. Пример: `ci: add reproducible quality checks`.

**Опционально:** добавить pinned `@commitlint/cli` и `@commitlint/config-conventional`, commit-msg hook и CI. Проверка формата не доказывает правдивость сообщения [реестр][registry]. До принятия этой автоматизации не писать, что правило технически enforced.

Если commitlint принят, следовать принципу подборки **проверять pushed range**, а не только последний commit. Официальный [CI guide][commitlint-ci] показывает `--from/--to` для PR, но его пример push `--last` недостаточен для push из нескольких commits; его `npm install` в job также заменить на общий locked install. Нужна история (`fetch-depth: 0` либо достаточно fetch) [checkout](https://github.com/actions/checkout#readme). Для обычного push — диапазон `before..after`; для новой ветки с нулевым `before`, force push, удалённого ref и первого/root commit — явно выбранная политика и тестируемые ветки обработки, не безусловный `HEAD~1`. Старую историю не переписывать ради включения нового правила. SHA из payload передавать безопасными env/аргументами, а не вставлять произвольное сообщение commit в shell script [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use).

**Release-please и другие release/changelog боты не нужны:** формат коммитов полезен сам по себе; enforcement и потребитель истории — разные обязанности [patterns][patterns].

## Границы результата и следующие решения

- Создан только этот Markdown. Ничего не устанавливалось; app/test/config код и workflow не создавались; серверы, lint, build, tests, hooks и Actions не запускались. Нет staging/commit/push, изменений Git config или авторства. Публикация ветки требует отдельного согласования.
- Не определены framework, package manager, layout, production entrypoint, health endpoint и бюджет реального времени запуска. Числа timeout и состав минимального gate — предложения к обсуждению, не уже достигнутая приёмка.
- Поддержка платформ по metadata/docs не равна проверке конкретной PowerShell-машины. Не измерялись скорость линтеров, полнота правил и coverage; рекламные множители производительности не использованы как доказательство выбора.
- После выбора стека: утвердить **один** lint/format вариант и совместимые pins, реализовать описанный smoke и единый `check`, проверить clean/failing paths на Windows и Ubuntu, затем согласовать hooks/CI. Детальная оценка mise/hk/pitchfork и публикация ветки — отдельные задачи.

[gates]: https://github.com/mokevnin/dev-quality-gates/blob/829848c77853988cee6683b0d3bfe4904181be95/README.md
[registry]: https://github.com/mokevnin/dev-quality-gates/blob/829848c77853988cee6683b0d3bfe4904181be95/tools.json
[adopt]: https://github.com/mokevnin/dev-quality-gates/blob/829848c77853988cee6683b0d3bfe4904181be95/docs/adopt.md
[patterns]: https://github.com/mokevnin/dev-quality-gates/blob/829848c77853988cee6683b0d3bfe4904181be95/docs/patterns.md
[course]: https://ru.hexlet.io/programs/ai-for-developers
[node-index]: https://nodejs.org/dist/index.json
[vite-ts]: https://vite.dev/guide/features.html#typescript
[vitest]: https://vitest.dev/guide/
[vitest-features]: https://vitest.dev/guide/features
[oxlint]: https://oxc.rs/docs/guide/usage/linter.html
[ox-plugins]: https://oxc.rs/docs/guide/usage/linter/plugins.html
[oxfmt]: https://oxc.rs/docs/guide/usage/formatter.html
[ox-types]: https://oxc.rs/docs/guide/usage/linter/type-aware.html
[eslint]: https://eslint.org/docs/latest/use/getting-started
[ts-eslint]: https://typescript-eslint.io/users/dependency-versions/
[biome-install]: https://biomejs.dev/installation/install-biome/
[biome-ci]: https://biomejs.dev/recipes/continuous-integration
[biome-cli]: https://biomejs.dev/reference/cli/#biome-ci
[fastify-tests]: https://fastify.dev/docs/latest/Guides/Testing/
[hono-node]: https://hono.dev/docs/getting-started/nodejs
[child]: https://nodejs.org/docs/v24.22.2/api/child_process.html
[net]: https://nodejs.org/docs/v24.22.2/api/net.html#serverlistenport-host-backlog-callback
[playwright]: https://playwright.dev/docs/intro
[npm-ci]: https://docs.npmjs.com/cli/v11/commands/npm-ci
[setup-node]: https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md
[triggers]: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow
[cc]: https://www.conventionalcommits.org/en/v1.0.0/
[commitlint-ci]: https://commitlint.js.org/guides/ci-setup.html
