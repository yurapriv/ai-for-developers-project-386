# TypeSpec → OpenAPI → TypeScript SDK и варианты стека

Дата среза: **2026-11-02**. Статус: исследование, **не решение о выборе стека**.

**Граница достоверности: проверено по документации, npm registry и исходникам; не исполнялось.** Не выполнялись установка зависимостей, scaffold, компиляция TypeSpec, генерация SDK/сервера, запуск приложения, тесты или измерение размеров bundle. Примеры ниже — только предложения внутри этого отчёта, не созданные файлы приложения. Изменён только этот Markdown; карта и билеты не редактировались.

## Краткий вывод

1. Цепочка **TypeSpec 1.17.0 → `@typespec/openapi3` 1.17.0 → OpenAPI 3.0.0 YAML → `@hey-api/openapi-ts` 0.99.0 → Fetch SDK** документально осуществима. Это совместимость через стандартный файл OpenAPI, а не специальная интеграция TypeSpec/Hey API. Начать с 3.0.0 — консервативное предложение для всех рассматриваемых потребителей, не ограничение emitter: он также умеет 3.1.0 и 3.2.0. [T1][T2][H1][H2]
2. Hey API рекомендован для первого SDK-spike: существующий CLI, типы и функции операций, встроенный Fetch transport, локальный input без аккаунта и сервера. Версию необходимо фиксировать: проект прямо предупреждает об initial development. [H1][H2][H3]
3. **Не обещать «автоматически получим весь backend»**. Hey API имеет **Beta** Fastify v5 plugin, но его код 0.99.0 генерирует `RouteHandlers` types, а не регистрацию маршрутов или runtime validation. Пример документации дополнительно использует `glue`. [H4][H5]
4. У Hono существует сторонний реальный OpenAPI→server generator: **Orval 8.46.0**, режим `client: 'hono'`, с router, context, Zod и handler templates. Это не генератор команды Hono; при регенерации требуется проверить сохранность пользовательского кода. Hey API Hono plugin пока **Planned**. [O1][O2][H6]
5. Низкорисковое начало: ручной технический `/health`, сгенерированные wire types и contract tests против emitted OpenAPI; выбор Fastify/Hono не должен блокироваться отсутствием принятого генератора маршрутов. Это инженерная рекомендация, а не результат испытаний.
6. Предлагаемый фиксированный runtime: **Node 24.22.2 LTS + входящий в его дистрибутив npm 11.19.1**. TypeScript **5.9.3**, не автоматически `latest`: опубликованный `latest` уже 7.0.2, а запасной `openapi-typescript` 7.13.0 требует `^5.x`. Проверены прямые engine/peer ограничения и несколько усиливающих транзитивных ограничений; полное разрешённое дерево без lockfile ещё не доказано. [N1][N2][V1][V2]
7. React+Vite — документированный SPA-путь, не готовый full-stack framework. Mantine даёт готовый пакет компонентов с Provider/CSS/PostCSS; shadcn/ui добавляет исходники компонентов в проект и в стандартном Vite-пути требует Tailwind и alias. Для первого технического health UI библиотека компонентов вообще не обязательна. [R1][U1][U2][U3]

## 1. Метод и источники версий

Использованы первичные источники: сайты проектов, их GitHub-репозитории, `https://registry.npmjs.org/<package>` (`dist-tags`, `time`, `versions`) и version endpoints. В таблицах ссылки ведут на **конкретную опубликованную версию**, а не изменяемый `latest`. Проверялось, что выбранные версии опубликованы не позже даты среза; например, TypeSpec 1.17.0 опубликован 2026-10-08, Hey API 0.99.0 — 2026-06-22, Orval 8.46.0 — 2026-10-30. Registry доступен напрямую; `npm view` и тем более `npm install` не запускались. [T3][H7][O2]

Страницы документации обычно rolling: их утверждения описывают состояние сайта на дату проверки. Где существенно, проверены исходники release tag (Hey API 0.99.0, Orval 8.46.0, fastify-openapi-glue 4.12.0). Отсутствие найденной официальной возможности ниже не доказывает отсутствие всех сторонних решений.

## 2. TypeSpec и OpenAPI emitter

### Требования и состав

- Официальный Getting Started предлагает Node.js LTS, `tsp init` с Generic REST API, затем `tsp compile .`; результат — `tsp-output/@typespec/openapi3/openapi.yaml`. Standalone executable обозначен **Experimental**, поэтому для native Windows/Ubuntu предлагается обычный npm CLI, не standalone. [T1]
- Для **1.17.0** `engines.node` compiler, HTTP и OpenAPI libraries/emitter — **`>=22.0.0`**. Не переносить старое требование Node 18/20 из прежних руководств. [T3][T4][T5][T6]
- Минимальный согласованный набор: `@typespec/compiler`, `@typespec/http`, `@typespec/openapi`, `@typespec/openapi3` — **все 1.17.0**. HTTP peer требует compiler `^1.17.0`; OpenAPI3 — compiler/http/openapi `^1.17.0`. `@typespec/openapi` нужен emitter как обязательный peer и позволяет явно задать `@operationId`. [T4][T5][T6]
- У OpenAPI3 также указаны optional peers: SSE/events/streams/versioning `^0.87.0`, JSON Schema `^1.17.0` (и optional XML в metadata). Для простого health их добавлять не требуется. **Не выравнивать все `@typespec/*` по одному числу:** например, опубликованный `@typespec/rest` — 0.87.0, а не 1.17.0; он для приведённого примера не нужен. [T6][T7]

### Версии и форматы OpenAPI

Emitter 1.17/documentation поддерживает `openapi-versions`: **`3.0.0`, `3.1.0`, `3.2.0`**, default **`["3.0.0"]`**. В конфигурации это список целевых версий; не подставлять вместо них произвольные patch-версии OAS. Сериализация: **YAML или JSON**, в том числе массив форматов; default YAML, либо выводится из расширения `output-file`. `new-line` — `lf` по умолчанию, доступно `crlf`. Можно фиксировать output directory/file. [T2]

**Предложение:** сначала один `openapi.yaml`, одна версия **3.0.0**, LF и явный `operationId: getHealth`. Это упрощает diff и оставляет совместимость с запасным openapi-typescript (3.0/3.1), Fastify draft-07 validation и Orval. Поддержку всего OAS 3.2 со стороны каждого downstream-инструмента нельзя выводить из одной фразы «OpenAPI supported»; если 3.2 понадобится, нужен отдельный fixture/test. [T2][H2][S1][F3][O1]

## 3. Реальные TypeScript SDK-инструменты

| Инструмент на дату среза | Что действительно делает | Вывод для этого scaffold |
| --- | --- | --- |
| **Hey API `@hey-api/openapi-ts` 0.99.0** | OpenAPI→TS models и SDK functions/classes, transport plugins; Fetch default. Node `>=22.18.0`, TS peer `>=5.5.3 || >=6.0.0 || 6.0.1-rc`. [H1][H7] | **Рекомендованный кандидат**: exact pin, плоские SDK functions, встроенный Fetch, локальный YAML. Не обозначать весь 0.x инструмент как GA/stable. |
| **`openapi-typescript` 7.13.0 + `openapi-fetch` 0.17.0** | Первый генерирует runtime-free types из OAS 3.0/3.1 YAML/JSON; второй — типизированный Fetch client с вызовами по HTTP path. Это **не** генерация отдельных именованных методов операций. TS peer генератора `^5.x`. [S1][S2][S3][S8] | Хороший более простой запасной путь; TS 5.9.3 совместим. Не путать `openapi-typescript` с Hey API package. |
| **Orval 8.46.0** | Реальный generator TS clients, Fetch, Query hooks и server Hono templates; Node `>=22.18.0`. [O1][O2][O3] | Альтернатива; особенно интересен при выборе Hono server generation. Для первого Fetch SDK Query/MSW не обязательны. |
| **OpenAPI Generator `typescript-fetch`** | Метаданные генератора говорят **STABLE / CLIENT**, хотя help text всё ещё содержит «beta». CLI core **7.27.0**; npm wrapper **2.42.0** — это другая нумерация. Java runtime добавляется к Node toolchain (installation guide указывает минимум Java 11 для JAR). [S4][S5][S6][S7] | Реальная альтернатива, но не первая при приоритете одного Node toolchain на Windows. Фиксировать и wrapper, и скачиваемый core; «версия npm = версия генератора» неверно. |
| **TypeSpec `@typespec/http-client-js` 0.16.3** | Прямой TypeSpec→JS client emitter, в документации **Preview**, минует OpenAPI. Peer compiler/http `^1.17.0`, rest `^0.87.0`. [T8][T9] | Существует, но не проверяет требуемую промежуточную OpenAPI-цепочку; не подменять им её незаметно. |

### Hey API: transport и конфигурация

1. Input может быть **путём к локальному YAML/JSON**, URL или объектом спецификации. Аккаунт Hey API/registry, ключи, облако и доступный backend **не требуются** для локального файла. Для воспроизводимости предпочтителен локальный emitted artifact. Документация заявляет все valid OpenAPI versions/formats; для доказательства конкретной связки всё равно нужен generation/typecheck smoke. [H2]
2. В конфиге `@hey-api/client-fetch` — **имя встроенного plugin**. В версии 0.99.0 `bundle: true` по умолчанию копирует transport в generated output. Отдельно устанавливать старый npm `@hey-api/client-fetch` 0.13.1 для этого пути не нужно: это не «парная версия 0.99». [H3][H8][H9]
3. Клиент поддерживает `client.setConfig({ baseUrl, ...RequestInit })`, собственную `fetch`, per-call overrides и отдельный `createClient`. Для гарантии настройки **до первого запроса** имеется `runtimeConfigPath` с экспортом `createClientConfig`; generated files вручную не править. [H2][H3]
4. Для начала предлагается явный `baseUrl` в вызове `/health`/отдельный hand-written config; позднее Vite proxy с same-origin URL либо согласованный CORS. Не вшивать production hostname при генерации и не добавлять cookies/auth к публичному health без причины. Наличие cross-origin запроса требует отдельной browser-проверки: SDK не отменяет политики браузера. [H3][R2]
5. SDK runtime validation **не включена по умолчанию**. Наличие TypeScript types не проверяет реальный JSON. Можно подключить, например, Zod plugin; это отдельные dependency/runtime costs, а не обязательная часть первого health. По исходникам 0.99.0 request/response validator default `false`, Fetch `throwOnError` default `false`. Для smoke предлагается явно `throwOnError: true`. [H10][H11][H12]

## 4. Backend: Fastify и Hono

### Официальный старт

**Fastify 5.12.8:** Getting Started показывает `npm i fastify`, ESM import, `.get(...)` и `.listen({ port: 3000 })`; для ESM нужен `"type": "module"`. Fastify v5 официально требует Node 20+, полный JSON Schema с `type`, а не shorthand. Для локальной разработки достаточно loopback; Docker и `0.0.0.0` сейчас не нужны. Разделы testing/type providers объясняют `inject()` и inference по inline JSON Schema. [F1][F2][F4][F5][F6]

**Hono 4.13.16 + `@hono/node-server` 2.1.6:** официальный Node guide предлагает `npm create hono@latest ...`, template `nodejs`, затем `Hono`, `app.get`, `serve`. Core переносим между runtimes, но на Node нужен adapter. Важное расхождение: guide упоминает Node 18, **опубликованный adapter 2.1.6 требует Node `>=20`**, peer Hono `^4 || ^5.0.0-0`; для установки решающая граница — package metadata. Hono 5 RC не выбирать вместо stable 4 только из-за `next`. [B1][B2][B3]

Эти команды — ссылки на будущий путь старта, **не выполненные действия**. При реализации можно использовать точные `create-hono` **0.19.5** или ручную минимальную настройку; scaffold template затем обязательно проверить, поскольку он сам может ссылаться на ranges/latest. [B4]

### Что генерируется, а что нет

| Путь | Статус/владелец | Types | Runtime schema/validation | Routes |
| --- | --- | --- | --- | --- |
| Fastify встроенные route generics / type providers | Stable Fastify API; официальные providers отдельно | Да, явные generics или inference из schema | JSON Schema→Ajv validation и response serialization | **Ручная регистрация**. Provider не читает OAS и не создаёт router. [F4][F7] |
| Hey API 0.99.0 plugin `fastify` | **Beta**, сторонний к Fastify | Да: `RouteHandlers` с Body/Params/Querystring/Headers/Reply | **Не генерирует** runtime validators этим plugin | **Не регистрирует**. Source экспортирует type alias; документация использует внешний `glue`. [H4][H5] |
| `fastify-openapi-glue` **4.12.0** | Сторонний, опубликованный non-prerelease package, не гарантия production readiness | CLI предлагает JS/standaloneJS, не полноценный TS server generator | Читает OAS 2/3 и формирует Fastify schemas; использует Fastify validator | Да, runtime route registration по `operationId`→service handler. Source plugin допускает Fastify `>=4.0.0`, Node metadata `>=20`. [F3][F8][F9] |
| `@fastify/swagger` **9.9.3** | Официальный Fastify plugin; 9.x для Fastify 5 | Не назначение plugin | Публикация OAS, dynamic из route schemas или static из файла | **Нет**: static mode показывает контракт, но не реализует маршруты. README сам направляет к glue. [F10][F11] |
| Hono `@hono/zod-openapi` **1.6.3** | Официальная Hono ecosystem integration, не TypeSpec emitter | Да, из Zod/code-first declaration | Да, Zod→валидация/описание | Маршрут описывается вручную через `createRoute`/`app.openapi`; OAS **выход**, не вход. Peer Hono `>=4.10.0`, Zod `^4.0.0`. [B5][B6] |
| Hono RPC `hc<AppType>` | Официальный Hono API | Да, из `typeof app` | Не заменяет validation контрактом | Не OAS→server generator и не требуемый OAS SDK. Получается coupling клиента с типом backend implementation. [B7] |
| Orval **8.46.0**, `client: 'hono'` | Сторонний generator, функция documented/released; страница не маркирует Beta | Да: request/response/context | Да: Zod/validator artifacts при включённой validation | Да: Hono app/router и handler templates. Это кандидат для spike, не подтверждённый production toolchain. [O1][O2][O4] |
| Hey API plugin `hono` | **Planned** | Не считать доступным | Не считать доступным | Не считать доступным. [H6] |
| TypeSpec `@typespec/http-server-js` **0.58.0-alpha.29** | Microsoft, **highly experimental / alpha** | Да: models/service interfaces | Operation parsing/validation в generated code | Node HTTP router; optional **Express**, не Fastify/Hono emitter. Peer ranges `^1.16.0` включают 1.17.0, но это не подтверждает работоспособность alpha на нём. [T10][T11] |

**Три разумных варианта (предложения, не принятое решение):**

- **A — простой старт:** Fastify 5 либо Hono 4, ручной `/health`, generated wire type и contract tests. Не требовать server generator как prerequisite scaffold.
- **B — Fastify contract-first registration:** Hey API Beta `fastify` **types** + `fastify-openapi-glue` 4.12.0 для **routes/schema**. Проверить отдельно на emitted OAS: `$ref`, status map, serialization, validation. Не выдавать сочетание двух сторонних интеграций за stable first-party pipeline.
- **C — Hono full server templates:** Orval 8.46.0 для server + Hey API 0.99.0 для browser SDK из **одного и того же** emitted YAML. Цена — второй generator, Zod и regeneration policy. Документация Orval демонстрирует Wrangler, но для нашего Node-варианта нужен обычный `@hono/node-server`, не Cloudflare runtime. [O1][B1]

**Ограничения server generation:** OAS schema ≠ произвольный JSON Schema. Fastify по умолчанию использует draft-07; OAS 3.1/3.2 могут содержать draft-2020-12 keywords (`unevaluatedProperties` и т. п.), для которых нужен отдельный validator setup/adapter. Даже 3.0 нельзя бездумно скопировать в Ajv со всеми OAS keywords. Glue отдельно описывает strict mode/schema2020 ограничения. Response serialization Fastify не равнозначна полной проверке произвольного исходящего ответа. [F3][F7][T2]

**Orval-specific риск:** в 8.46.0 documented `handlerGenerationStrategy` — `smart`/`skip`/`full`, default smart; `smart` меняет принадлежащие generator imports/validators, сохраняя handler bodies. В source response-validator выбирает именно JSON **200**; нельзя обещать одинаковую автоматическую response validation для всех кодов. Следует проверить diff регенерации и делегировать implementation из тонких templates в отдельные файлы. `@orval/hono` и `@orval/zod` зависят от собственного TypeScript **6.0.3**; не насильно dedupe/override его до project TS 5.9.3. [O1][O4][O5][O6]

## 5. Frontend: React + Vite, Mantine или shadcn/ui

React docs официально приводят Vite `react-ts` как способ собрать SPA с нуля. При этом рекомендуемые полноценные frameworks решают больше задач; routing/data fetching/SSR не становятся готовыми возможностями только от `create-vite`. Для технического scaffold это допустимый trade-off без выбора бизнес-архитектуры. Vite **8.3.5** требует Node **`^20.19.0 || >=22.12.0`**; `@vitejs/plugin-react` **6.2.1** требует **Vite `^8.0.0`**, поэтому эта пара подходит. Vite transpiles TS, но **не typechecks**: отдельный `tsc --noEmit`/project build обязателен. [R1][R3][R4][R5][R7]

Будущий официальный starter-путь: `npm create vite@9.3.3 web -- --template react-ts`. Это фиксирует версию **scaffolder**, не все зависимости шаблона: после старта manifest следует сверить с таблицей, не принимать его `latest`/ranges автоматически. **Проверен release template 9.3.3: он содержит `typescript: ~7.0.2`, plugin-react `^6.1.2`, Vite `^8.3.5` и oxlint.** Для предложенного TS 5.9.3 набора manifest нужно сознательно адаптировать; Node 24 совместим с обоими компиляторами, но fallback openapi-typescript peer ограничен TS 5.x. Для максимально узкого scaffold допустима ручная настройка без лишних линтеров/templates. [R3][R6][R8]

| | Mantine | shadcn/ui |
| --- | --- | --- |
| Модель | Библиотека npm-компонентов; старт с `@mantine/core` + `@mantine/hooks`. | Open Code distribution: CLI/registry приносит исходники компонентов в репозиторий; не одна библиотека, импортируемая целиком. [U3] |
| На дату среза | Core/hooks **9.7.4**; **React и React DOM `^19.2.0`**, hooks exact 9.7.4. React/DOM 19.3.1 удовлетворяют. [U4][U5] | CLI **shadcn 4.23.0**, Node `>=20.18.1`; для стандартного Vite-пути Tailwind **4.3.3** + `@tailwindcss/vite` **4.3.3** (peer Vite включает 8). CLI version не фиксирует содержимое внешнего registry snapshot. [U6][U7][U8] |
| Setup | CSS import `@mantine/core/styles.css`, `MantineProvider`; официальный Vite guide также настраивает PostCSS preset/simple-vars. Без Tailwind. [U1] | Tailwind import/plugin, согласованный `@/*` alias в TS и Vite, init/`components.json`, затем add нужных компонентов. Не требует Next.js/SSR. [U2] |
| Overhead | Runtime packages + CSS/provider; обновления централизованы в package versions. Полный официальный template несёт Storybook/testing/lint, **минимальный template есть отдельно**. [U1] | Tailwind toolchain + локальные UI-файлы/utilities и зависимости выбранных компонентов; модификации/upstream updates — зона ответственности проекта. Больше редактируемого кода, но полный контроль. [U2][U3] |
| Вывод | Предпочтительный кандидат, если нужен быстрый стандартный UI без собственной дизайн-системы. | Кандидат, если нужен контроль исходников/дизайна и команда готова сопровождать этот слой. |

Это оценка **операционной сложности**, не benchmark производительности или bundle size. Данных для утверждения «X легче/быстрее Y» нет. На первом health screen разумно отложить обе библиотеки; если UI-библиотека обязательна, выбрать **одну**, не ставить обе. `@mantine/dates`, формы, auth, router, Query и бизнес-календари здесь не требуются.

## 6. Предлагаемые точные версии и совместимость

### Базовый совместимый по метаданным набор

Все версии опубликованы; exact pins ниже — **предложение для будущей проверки**, не существующий manifest.

| Уровень | Точная версия | Проверенное ограничение/связь и источник |
| --- | --- | --- |
| Node runtime/build/codegen | **24.22.2 LTS (Krypton)** | Release 2026-10-27, официальные win-x64 MSI/ZIP и Linux x64/arm64 artifacts; npm bundled 11.19.1. [N1] |
| Package manager | **npm 11.19.1** | Node `^20.17.0 || >=22.9.0`; уже входит в выбранный Node, не требует отдельного менеджера/глобального обновления. [N1][N2] |
| TypeScript project compiler | **5.9.3** | Node `>=14.17`; удовлетворяет Hey API, запасному openapi-typescript `^5.x`, React/Node types и type-fest 5.x из Mantine. [V1][H7][S2][V3] |
| TS execution в dev | **tsx 4.23.15** | Node `>=18`; Vite optional peer tsx `^4.8.1` удовлетворён; production можно `tsc`→JS→`node`, без tsx. [V4][R4] |
| Node declarations | **@types/node 24.19.2** | Та же major, что runtime; `typeScriptVersion: 5.6`; Vite peer `^20.19.0 || >=22.12.0` включает 24.x. [V5][R4] |
| TypeSpec contract toolchain | **compiler/http/openapi/openapi3 1.17.0** | Node `>=22`; все обязательные peers согласованы `^1.17.0`. [T3][T4][T5][T6] |
| SDK generator/transport plugin | **@hey-api/openapi-ts 0.99.0** | Node `>=22.18`; TS 5.9.3 входит в peer; Fetch transport встроен и bundled. [H7][H8] |
| Backend A | **fastify 5.12.8** | Docs Node 20+; не Fastify 6 alpha. [F1][F2][F6] |
| Backend B, вместо A | **hono 4.13.16 + @hono/node-server 2.1.6** | Core Node `>=16.9`; adapter `>=20`, Hono peer `^4 || ^5.0.0-0`. [B2][B3] |
| UI runtime | **react 19.3.1 + react-dom 19.3.1** | DOM peer React `^19.3.1`; Mantine 9.7.4 React/DOM `^19.2.0` соблюдены. [V6][V7][U4] |
| UI declarations | **@types/react 19.3.0 + @types/react-dom 19.3.0** | DOM types peer `@types/react ^19.3.0`, TypeScript minimum metadata 5.6. [V8][V9] |
| Frontend build | **vite 8.3.5 + @vitejs/plugin-react 6.2.1** | Node `^20.19.0 || >=22.12.0`; plugin peer Vite `^8.0.0`. Babel/React Compiler/OXC transform plugin peers в этой версии optional, не обязательны для минимального setup. [R4][R5] |
| Scaffolder, если нужен | **create-vite 9.3.3 / create-hono 0.19.5** | Одноразовые инструменты, не runtime; не сохранять `@latest` в воспроизводимых инструкциях. [R6][B4] |

Для сервера использовать ESM и `module/moduleResolution: NodeNext`, для browser SDK/UI — `ESNext`/`Bundler`, `strict: true`, DOM lib. Это разные TS execution environments, поэтому не навязывать одну конфигурацию всем файлам. У generated SDK надо проверить `.js` extensions/NodeNext, **если** его собираются исполнять и на Node; гарантировать это без компиляции нельзя. Native Node type stripping не заменяет compiler: Node игнорирует tsconfig/path aliases, не поддерживает `.tsx` и не выполняет typecheck. Для первого backend dev предлагается tsx, для prod — build JS. [N3][S1][R7]

### Условные добавления — только при выборе соответствующего пути

| Вариант | Exact pins и совместимость |
| --- | --- |
| Mantine | **@mantine/core 9.7.4**, **@mantine/hooks 9.7.4**, **postcss 8.5.32**, **postcss-preset-mantine 1.18.0**, **postcss-simple-vars 7.0.1**. Preset peer PostCSS `>=8`, simple-vars `^8.2.1`; 8.5.32 также удовлетворяет Vite dependency `^8.5.30`. [U4][U5][U9][U10][U11][R4] |
| shadcn/ui | **shadcn 4.23.0**, **tailwindcss 4.3.3**, **@tailwindcss/vite 4.3.3**. Vite peer включает `^8`; additional component dependencies фиксировать после выбора preset/components, не считать их уже проверенными. [U6][U7][U8] |
| Fastify Beta handler types + glue | **@hey-api/openapi-ts 0.99.0** с plugin `fastify`, **fastify-openapi-glue 4.12.0**. Диапазоны Node/Fastify подходят, но совместная generation/runtime проверка ещё обязательна. [H5][F8][F9] |
| Fastify JSON Schema inference | **@fastify/type-provider-json-schema-to-ts 5.0.1** с json-schema-to-ts **3.1.1**; не требуется для ручного Reply generic. [F12][F14] |
| Hono server generation | **orval 8.46.0**, Hono/adapter как выше, **zod 4.6.7**; при использовании official validator — **@hono/zod-validator 0.9.1**, peers Hono `>=4.11.2`, Zod `^3.25.0 || ^4.0.0`. Orval custom response-validator artifact отличается от official request-validator. [O2][O5][O6][O7][O8] |
| Hono code-first OAS (не TypeSpec→server) | **@hono/zod-openapi 1.6.3**, **zod 4.6.7**, Hono 4.13.16; обязательные peers соблюдены. Избежать второго независимого источника контракта. [B6][O7] |
| SDK fallback | **openapi-typescript 7.13.0 + openapi-fetch 0.17.0**, project TS **5.9.3**. [S2][S3] |

Дополнительная ловушка: актуальный `@fastify/type-provider-typebox` **6.3.0** требует **`typebox ^1.1.14`** и `ajv-formats ^3.0.1`, не старый package `@sinclair/typebox`. Нельзя механически смешивать пример из старого tutorial и свежий provider. В базовый набор TypeBox не включён. [F13]

### Проверка пересечения диапазонов, а не только номера Node

- Core chain: TypeSpec `>=22`, Hey API/Orval `>=22.18`, Vite/plugin `^20.19 || >=22.12`, npm 11 `^20.17 || >=22.9`, Fastify docs `>=20`, Hono adapter `>=20`, tsx `>=18`. **24.22.2 удовлетворяет всем**; Node 20 не подходит общей цепочке, несмотря на отдельную поддержку Vite/Fastify. Источники — version endpoints в таблицах.
- Усиливающее транзитивное ограничение: TypeSpec compiler зависит от `@babel/code-frame ^8.0.0`; проверенная версия **8.0.6** требует **`^22.18.0 || >=24.11.0`**. Поэтому даже формального «Node >=22» недостаточно для всего compiler tree; нельзя рекомендовать Node 24.0 или Node 23. [T3][V10]
- Mantine→type-fest **5.10.0** требует Node `>=20`, TS **>=5.9**, ESM и strict; это обосновывает TS **5.9.3**, а не просто минимальный Hey API TS 5.5.3. PostCSS preset→postcss-mixins **12.1.2** требует Node `^20.0 || ^22.0 || >=24.0`, также подходит 24.22.2. [V3][V11][V16][U4]
- Vite→Rolldown **1.2.16** (в пределах `~1.2.14`) требует Node `^20.19 || >=22.12`; Lightning CSS **1.33.0** — `>=12`. Native binaries — отдельный platform риск, который одни engines не доказывают. [R4][V12][V13]
- Node 24 на дату среза уже **Maintenance LTS**, EOL 2028-04-30; Node **26.13.0** уже Active LTS (с 2026-10-28), EOL 2029-04-30. Выбор 24 — сознательный более зрелый baseline, **не утверждение, что 26 ещё non-LTS**. Node 20 EOL с 2026-04-30. [N1][N4]
- `npm latest` уже **12.2.1**, engine **`^22.22.2 || ^24.15.0 || >=26.0.0`**. Он подходит 24.22.2, но не нужен вместо bundled npm 11.19.1. `pnpm` **12.16.1** опубликован с Node `>=18` и тоже возможен, но добавляет отдельную установку/pin. Не смешивать lockfiles/менеджеры; для первого native Windows/Ubuntu пути предложен npm. [V14][V15]

**Чего эта проверка не утверждает:** manifests содержат транзитивные ranges, а готового lockfile нет. Полное разрешение всех transitive/optional/peer dependencies, integrity/platform artifacts, install scripts, фактическая совместимость generated TS и безопасность дерева **не проверены исполнением**. Это не сертификат «весь диапазон любых будущих версий совместим». Следующий gate — exact manifest, полученный lockfile, `engine-strict`/strict peer checks, Windows и Ubuntu install/build/test. Вариант считается принятым только после этого. [N5]

## 7. Минимальный документальный пример: технический health

Никаких бронирований, БД, авторизации или иных бизнес-функций. Единственный контракт: **GET `/health` → 200 `application/json` `{ "status": "ok" }`**. Ниже предполагается запуск tools из корня будущего проекта; выбранные пути — предложение, не текущая структура repo.

### 7.1. Будущий `main.tsp`

```typespec
import "@typespec/http";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service(#{ title: "Technical API" })
namespace TechnicalApi;

model Health {
  status: "ok";
}

@get
@route("/health")
@operationId("getHealth")
op health(): {
  @statusCode statusCode: 200;
  @body body: Health;
};
```

Основание: официальное отображение `@route`, `@get`, `@operationId`, `@statusCode` и `@body` в OAS. `statusCode` — HTTP metadata, не поле JSON; `Health.status` — required single-literal property. Точный emitted YAML/имена symbols должны быть проверены компиляцией. [T12]

### 7.2. Будущий `tspconfig.yaml`

```yaml
output-dir: "{project-root}/artifacts"
emit:
  - "@typespec/openapi3"
options:
  "@typespec/openapi3":
    emitter-output-dir: "{output-dir}/openapi"
    output-file: "openapi.yaml"
    file-type: yaml
    openapi-versions:
      - "3.0.0"
    new-line: lf
```

Ожидаемый artifact: `artifacts/openapi/openapi.yaml`, OAS 3.0.0 с GET `/health`, `operationId: getHealth`, JSON 200 response и schema `status` enum `[ok]`. Это **ожидание по документации**, не сохранённый результат emitter. [T2][T12]

### 7.3. Будущий `openapi-ts.config.ts`

```ts
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './artifacts/openapi/openapi.yaml',
  output: './generated/client',
  plugins: [
    '@hey-api/typescript',
    { name: '@hey-api/client-fetch', bundle: true, baseUrl: false },
    '@hey-api/sdk',
  ],
});
```

Explicit plugins делают намерение ясным, не требуют отдельных npm-пакетов с каждым plugin name. Ожидаемые generated modules: `types.gen.ts`, `sdk.gen.ts`, `client.gen.ts`, transport/core. При default flat SDK и явном operationId ожидается функция `getHealth`; настоящий экспорт проверить, не угадывать при реализации. [H2][H8][H10]

Будущий consumer smoke (не код приложения):

```ts
import { getHealth } from './generated/client/sdk.gen';

const { data, response } = await getHealth({
  baseUrl: 'http://127.0.0.1:3000',
  throwOnError: true,
});
// В тесте: response.status === 200 и data.status === 'ok'.
```

Это browser/bundler-style import; NodeNext consumer потребует согласованных extensions/build. Transport можно настроить отдельно через `client.setConfig` или runtimeConfigPath, как описано выше. [H3][H11][H12]

### 7.4. Серверная граница

Первый spike может вручную зарегистрировать `GET /health` в Fastify/Hono и вернуть `{ status: 'ok' }`; ответ типизировать generated wire type **через `import type`**, а не импортировать runtime SDK на сервер. Если взять Fastify Beta plugin, использовать generated `RouteHandlers`; **сам route** по-прежнему ручной либо glue. Если взять Orval, из того же YAML генерируются Hono router/templates, а Node adapter стартует exported app. [F1][B1][H5][O1]

Минимальный JSON-ответ не доказывает contract-first server generation. Даже при ручном route contract test должен прочитать **именно emitted artifact**, проверить наличие method/path/status/content type и соответствие реального ответа его schema. Только TypeScript assignment или тест с дублированной строкой `ok` недостаточны для доказательства синхронизации.

## 8. План будущей верификации (сейчас не выполнялся)

1. **Выбрать вариант**, затем создать минимальные manifest/scripts с exact direct pins из §6. Один package manager/lockfile. Не включать оба backend/UI одновременно. Проверить release notes и актуальные security advisories перед установкой.
2. **Windows baseline:** официальный Node **24.22.2** MSI/ZIP, проверить `node --version`, `npm.cmd --version`. В PowerShell использовать **`npm.cmd`/`npx.cmd`** при блокировке `.ps1`; не менять execution policy всей машины. Npm создаёт `.cmd` shims на Windows. Не требовать Git Bash/WSL/Docker. [N1][N5]
3. **Первичная установка только после разрешения:** получить lockfile; включить engine strict/strict peer validation, не обходить ошибки через force/legacy-peer-deps. Зафиксировать реально выбранные transitive versions. Проверить native Rolldown/Lightning CSS (и Tailwind Oxide, если выбран) на Windows; наличие engine-compatible package само по себе этого не гарантирует.
4. Добавить npm scripts, например `api:openapi` = `tsp compile .`, `api:sdk` = `openapi-ts`; агрегатор на Node или явно последовательные CI steps. Не делать Unix-only `rm`, `cp`, `VAR=value`, shell glob/`&` обязательной частью инструкции. **Это новые предлагаемые имена scripts, сейчас их нет.** [T1][H1]
5. **Generation smoke:** `npm.cmd run api:openapi`, затем `npm.cmd run api:sdk`. Проверить exit codes, отсутствие diagnostics, правильную версию OAS, method/path/operationId, JSON 200 и required literal status; проверить, что `statusCode` не попал в JSON. Не подменять generated YAML вручную.
6. **Typecheck:** отдельные server/client/frontend TS configs; включить generated modules. Проверить настоящий SDK import/call, typed server reply и negative type test (неверный `status` должен отвергаться). `vite build` не заменяет этот шаг. [R7]
7. **Backend contract test:** Fastify `inject()` либо Hono `app.request()` без порта; проверить status/media type/body по emitted OAS. Для health schema хватает корректной проверки её простого подмножества; перед более сложными схемами выбрать OAS-aware validation/нормализацию, не прогонять произвольную OAS 3.0 schema как draft-2020-12 без адаптации. Затем поднять реальный Node HTTP server на свободном порту и вызвать **generated Fetch SDK**, закрыв server после теста. [F5][B8][F3]
8. **Отрицательные проверки:** специально вернуть неправильный status/body/content type и убедиться, что contract test падает; изменить контракт, регенерировать SDK, убедиться, что устаревший consumer/handler обнаруживается. Это доказывает полезность страховки, а не просто наличие зелёного теста.
9. **Determinism:** два запуска генерации дают одинаковые bytes/LF; если generated artifacts решено хранить в Git, CI должен проверять drift и новые untracked outputs (одного `git diff --exit-code` для untracked недостаточно). Если не хранить — CI генерирует их перед сборкой. При Orval отдельно проверить `smart`/`skip` regeneration на пользовательских imports/body. [O1]
10. **Frontend/browser smoke:** React/Vite dev server + один вызов `/health` через SDK, видны loading/success/error; настроить proxy или согласованный CORS и проверить **в браузере**, не только Node fetch. Для Mantine проверить CSS/provider/PostCSS; для shadcn — Tailwind/aliases/один компонент. Никакого business UI.
11. **CI Ubuntu:** отдельный новый workflow с той же Node/npm версией и lockfile: clean `npm ci`, generation, typecheck, tests, Vite production build. Желательно дополнительная Windows job для native-host parity. `npm ci` требует существующий согласованный lockfile и не обновляет его. **`.github/workflows/hexlet-check.yml` не изменять**; этот отчёт не разрешает изменение других workflows или публикацию ветки. [N5]

## 9. Открытые решения и ограничения

- Какой backend и нужен ли server generator вообще? Предложение: сначала ручной health + контрактные тесты, затем отдельный spike Beta/glue или Orval, если масштаб оправдает overhead.
- Нужна ли UI-библиотека на первом техническом шаге? Если да: Mantine versus shadcn — предпочтение по модели сопровождения, не установленная техническая необходимость.
- Хранить ли emitted OpenAPI/SDK в Git или всегда генерировать? Нужна единая политика generated ownership, drift и reproducibility.
- Выбрать точный contract-validation инструмент перед выходом за health subset. Types, SDK runtime validation и server request validation — разные гарантии; ни одна не заменяет end-to-end contract tests.
- Нужна ли OAS 3.1/3.2? Сейчас предложена 3.0.0 ради широкой совместимости; более новые форматы потребуют отдельного downstream fixture набора.
- Не проверены установка, engines/peers **полного разрешённого** дерева, Windows/Ubuntu native binaries, TS/ESM импорты generated output, CORS, восстановление Orval handlers и воспроизводимость. Все они — обязательные execution gates, не скрытые «всё должно работать» допущения.
- Это не security audit и не оценка всех возможностей будущего календарного сервиса. Авторство/Git config, staging, commit и push не менялись. Публикация research-ветки требует отдельно согласованного плана.

## Источники

### TypeSpec

[T1]: https://typespec.io/docs/ "TypeSpec installation / Generic REST API"
[T2]: https://typespec.io/docs/emitters/openapi3/reference/emitter/ "OpenAPI3 emitter options"
[T3]: https://registry.npmjs.org/@typespec/compiler/1.17.0 "Published compiler engines/dependencies"
[T4]: https://registry.npmjs.org/@typespec/http/1.17.0 "HTTP engines/peers"
[T5]: https://registry.npmjs.org/@typespec/openapi/1.17.0 "OpenAPI peers"
[T6]: https://registry.npmjs.org/@typespec/openapi3/1.17.0 "Emitter engines/required and optional peers"
[T7]: https://registry.npmjs.org/@typespec/rest/0.87.0 "REST version/peers"
[T8]: https://typespec.io/docs/emitters/clients/introduction/ "Client emitters, preview status"
[T9]: https://registry.npmjs.org/@typespec/http-client-js/0.16.3 "JS client emitter version/peers"
[T10]: https://raw.githubusercontent.com/microsoft/typespec/main/packages/http-server-js/README.md "Highly experimental server emitter: Node HTTP/Express"
[T11]: https://registry.npmjs.org/@typespec/http-server-js/0.58.0-alpha.29 "Server emitter published alpha and peer ranges"
[T12]: https://typespec.io/docs/emitters/openapi3/openapi/ "TypeSpec to OpenAPI mapping: operationId, statusCode, body"

### Hey API

[H1]: https://heyapi.dev/docs/openapi/typescript/get-started "CLI/install/version pin guidance"
[H2]: https://heyapi.dev/docs/openapi/typescript/configuration "Local spec inputs, output/plugins"
[H3]: https://heyapi.dev/docs/openapi/typescript/clients/fetch "Fetch config/runtimeConfigPath/custom fetch"
[H4]: https://heyapi.dev/docs/openapi/typescript/plugins/fastify "Beta Fastify v5 plugin; glue usage"
[H5]: https://raw.githubusercontent.com/hey-api/hey-api/%40hey-api/openapi-ts%400.99.0/packages/openapi-ts/src/plugins/fastify/plugin.ts "0.99.0 plugin emits RouteHandlers type alias, not router"
[H6]: https://heyapi.dev/docs/openapi/typescript/plugins/hono "Hono plugin Planned"
[H7]: https://registry.npmjs.org/@hey-api/openapi-ts/0.99.0 "Published version engines/TS peers"
[H8]: https://raw.githubusercontent.com/hey-api/hey-api/%40hey-api/openapi-ts%400.99.0/packages/openapi-ts/src/plugins/@hey-api/client-core/types.ts "Bundled client default and runtime config API"
[H9]: https://registry.npmjs.org/@hey-api/client-fetch/0.13.1 "Separate client package has different version"
[H10]: https://heyapi.dev/docs/openapi/typescript/plugins/sdk "SDK flat functions and opt-in validators"
[H11]: https://raw.githubusercontent.com/hey-api/hey-api/%40hey-api/openapi-ts%400.99.0/packages/openapi-ts/src/plugins/@hey-api/sdk/config.ts "SDK 0.99.0 defaults: validator false"
[H12]: https://raw.githubusercontent.com/hey-api/hey-api/%40hey-api/openapi-ts%400.99.0/packages/openapi-ts/src/plugins/@hey-api/client-fetch/config.ts "Fetch 0.99.0 default throwOnError false"

### Другие SDK / Orval

[S1]: https://openapi-ts.dev/introduction "OAS 3.0/3.1 runtime-free TS generation"
[S2]: https://registry.npmjs.org/openapi-typescript/7.13.0 "TS ^5.x peer"
[S3]: https://registry.npmjs.org/openapi-fetch/0.17.0 "Published openapi-fetch"
[S4]: https://openapi-generator.tech/docs/generators/typescript-fetch/ "STABLE metadata vs beta help text"
[S5]: https://github.com/OpenAPITools/openapi-generator/releases/tag/v7.27.0 "Generator core release"
[S6]: https://registry.npmjs.org/@openapitools/openapi-generator-cli/2.42.0 "Npm wrapper version"
[S7]: https://openapi-generator.tech/docs/installation/ "OpenAPI Generator prerequisites / Java"
[S8]: https://openapi-ts.dev/openapi-fetch/ "Typed HTTP path Fetch client and runtime support"
[O1]: https://orval.dev/docs/guides/hono.md "Hono server templates, generated artifacts, regeneration strategy"
[O2]: https://registry.npmjs.org/orval/8.46.0 "Orval published version, Node engines"
[O3]: https://orval.dev/llms.txt "Official Orval docs index: Fetch and other generators"
[O4]: https://raw.githubusercontent.com/orval-labs/orval/v8.46.0/packages/hono/src/index.ts "Release source: routes/context/handler merge, 200 response validation"
[O5]: https://registry.npmjs.org/@orval/hono/8.46.0 "Private compiler dependency TypeScript 6.0.3"
[O6]: https://registry.npmjs.org/@orval/zod/8.46.0 "Orval Zod peer and compiler dependency"
[O7]: https://registry.npmjs.org/zod/4.6.7 "Published Zod candidate"
[O8]: https://registry.npmjs.org/@hono/zod-validator/0.9.1 "Hono/Zod compatible peer ranges"

### Backend

[F1]: https://fastify.dev/docs/latest/Guides/Getting-Started/ "Official Fastify getting started"
[F2]: https://registry.npmjs.org/fastify/5.12.8 "Published Fastify candidate"
[F3]: https://raw.githubusercontent.com/seriousme/fastify-openapi-glue/master/README.md "OpenAPI→routes/schema; CLI JS only; draft-07/schema2020 caveats"
[F4]: https://fastify.dev/docs/latest/Reference/Type-Providers/ "Official type providers infer inline JSON Schema"
[F5]: https://fastify.dev/docs/latest/Guides/Testing/ "inject testing"
[F6]: https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/ "Node 20+ and full JSON Schema requirements"
[F7]: https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/ "Runtime validation and serialization guarantees"
[F8]: https://registry.npmjs.org/fastify-openapi-glue/4.12.0 "Published glue package, Node engine"
[F9]: https://raw.githubusercontent.com/seriousme/fastify-openapi-glue/v4.12.0/index.js "Release source: route generation and Fastify >=4 metadata"
[F10]: https://raw.githubusercontent.com/fastify/fastify-swagger/main/README.md "Swagger compatibility matrix and static/dynamic modes"
[F11]: https://registry.npmjs.org/@fastify/swagger/9.9.3 "Published swagger version"
[F12]: https://registry.npmjs.org/@fastify/type-provider-json-schema-to-ts/5.0.1 "Provider version/dependencies"
[F13]: https://registry.npmjs.org/@fastify/type-provider-typebox/6.3.0 "New typebox package peer, not @sinclair/typebox"
[F14]: https://registry.npmjs.org/json-schema-to-ts/3.1.1 "Published inference dependency"
[B1]: https://hono.dev/docs/getting-started/nodejs "Official Node adapter and getting started"
[B2]: https://registry.npmjs.org/hono/4.13.16 "Published stable Hono engines"
[B3]: https://registry.npmjs.org/@hono/node-server/2.1.6 "Node adapter engines/peers"
[B4]: https://registry.npmjs.org/create-hono/0.19.5 "Published scaffolder"
[B5]: https://hono.dev/examples/zod-openapi "Code-first route + Zod → OpenAPI"
[B6]: https://registry.npmjs.org/@hono/zod-openapi/1.6.3 "Hono/Zod peers"
[B7]: https://hono.dev/docs/guides/rpc "typeof app → hc RPC, not OpenAPI codegen"
[B8]: https://hono.dev/docs/guides/testing "app.request testing"

### Frontend / UI

[R1]: https://react.dev/learn/build-a-react-app-from-scratch "Official React Vite SPA path and framework trade-offs"
[R2]: https://vite.dev/config/server-options#server-proxy "Vite dev server proxy"
[R3]: https://vite.dev/guide/ "Vite getting started"
[R4]: https://registry.npmjs.org/vite/8.3.5 "Vite engines, dependencies and optional peers"
[R5]: https://registry.npmjs.org/@vitejs/plugin-react/6.2.1 "React plugin Vite 8 peer"
[R6]: https://registry.npmjs.org/create-vite/9.3.3 "Published scaffolder"
[R7]: https://vite.dev/guide/features#typescript "Vite transpile-only, typecheck separately"
[R8]: https://raw.githubusercontent.com/vitejs/vite/create-vite%409.3.3/packages/create-vite/template-react-ts/package.json "Exact starter template dependencies, including TypeScript 7"
[U1]: https://mantine.dev/guides/vite/ "Provider/styles/PostCSS and minimal/full templates"
[U2]: https://ui.shadcn.com/docs/installation/vite "Vite/Tailwind/alias setup"
[U3]: https://ui.shadcn.com/docs "Open Code distribution and ownership model"
[U4]: https://registry.npmjs.org/@mantine/core/9.7.4 "React/DOM/hooks peers and dependencies"
[U5]: https://registry.npmjs.org/@mantine/hooks/9.7.4 "React peer"
[U6]: https://registry.npmjs.org/shadcn/4.23.0 "CLI engine/dependencies"
[U7]: https://registry.npmjs.org/tailwindcss/4.3.3 "Published Tailwind"
[U8]: https://registry.npmjs.org/@tailwindcss/vite/4.3.3 "Vite peer and exact Tailwind dependencies"
[U9]: https://registry.npmjs.org/postcss/8.5.32 "PostCSS engine"
[U10]: https://registry.npmjs.org/postcss-preset-mantine/1.18.0 "PostCSS peer and mixins dependency"
[U11]: https://registry.npmjs.org/postcss-simple-vars/7.0.1 "PostCSS peer"

### Runtime / toolchain metadata

[N1]: https://nodejs.org/dist/index.json "Published Node releases, LTS, bundled npm, OS artifacts"
[N2]: https://registry.npmjs.org/npm/11.19.1 "Bundled npm engine range"
[N3]: https://nodejs.org/docs/latest-v24.x/api/typescript.html "Native type stripping limitations and tsx alternative"
[N4]: https://raw.githubusercontent.com/nodejs/Release/main/schedule.json "Node LTS/maintenance/EOL dates"
[N5]: https://docs.npmjs.com/cli/v11/commands/npm-ci "Frozen lockfile installation, strict peers, Windows .cmd shims"
[V1]: https://registry.npmjs.org/typescript/5.9.3 "Published conservative TypeScript candidate"
[V2]: https://registry.npmjs.org/typescript/7.0.2 "Published latest TypeScript differs from chosen compiler"
[V3]: https://raw.githubusercontent.com/sindresorhus/type-fest/v5.10.0/readme.md "TS >=5.9, ESM, strict requirements"
[V4]: https://registry.npmjs.org/tsx/4.23.15 "TS dev execution engine range"
[V5]: https://registry.npmjs.org/@types/node/24.19.2 "Node declarations minimum TS metadata"
[V6]: https://registry.npmjs.org/react/19.3.1 "Published React version"
[V7]: https://registry.npmjs.org/react-dom/19.3.1 "React DOM peer"
[V8]: https://registry.npmjs.org/@types/react/19.3.0 "React types minimum TS metadata"
[V9]: https://registry.npmjs.org/@types/react-dom/19.3.0 "React types peer"
[V10]: https://registry.npmjs.org/@babel/code-frame/8.0.6 "Stricter transitive Node engine"
[V11]: https://registry.npmjs.org/postcss-mixins/12.1.2 "PostCSS preset transitive Node/peer range"
[V12]: https://registry.npmjs.org/rolldown/1.2.16 "Vite transitive Node engine"
[V13]: https://registry.npmjs.org/lightningcss/1.33.0 "Vite CSS native dependency engine"
[V14]: https://registry.npmjs.org/npm/12.2.1 "Alternative latest npm stricter engine"
[V15]: https://registry.npmjs.org/pnpm/12.16.1 "Alternative package manager version/engine"
[V16]: https://registry.npmjs.org/type-fest/5.10.0 "Type-fest Node engine"
