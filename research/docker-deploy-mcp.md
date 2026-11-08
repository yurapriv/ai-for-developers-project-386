# Безопасное проектное подключение MCP хостинга в OpenCode

Дата исследования и обращения ко всем внешним источникам: **2026-11-08**.
Задача: [Исследовать безопасное подключение MCP хостинга в OpenCode](https://github.com/yurapriv/ai-for-developers-project-386/issues/17),
карта: [Путь к сдаче финального задания «Docker и деплой»](https://github.com/yurapriv/ai-for-developers-project-386/issues/15).
Это план подключения и проверки доступа, **не настройка и не деплой**.
Тарифы и возможности выката относятся к исследованию
[Исследовать Docker-деплой через MCP Render и Railway](https://github.com/yurapriv/ai-for-developers-project-386/issues/16);
выбор пути — к решению
[Выбрать хостинг и порядок первого выката](https://github.com/yurapriv/ai-for-developers-project-386/issues/19).

## Краткая рекомендация

1. Сохранить порядок карты: **Render первым, Railway — запасной путь**.
   Предпочитать OAuth, но не обещать совместимость конкретного аккаунта или
   клиента до пользовательского входа и read-only проверки.
2. Render больше нельзя описывать как API-key-only: официальная инструкция
   содержит OAuth. Однако найденные публичные OAuth metadata Render не
   объявляют DCR или CIMD, а документированный `client_id=codex` относится к
   Codex, не к OpenCode. Для OpenCode сначала выяснить допустимую регистрацию
   клиента; не заимствовать чужой client ID. Если подходящего OAuth-клиента нет,
   **с отдельного согласия** использовать документированный Bearer API key через
   `{env:RENDER_API_KEY}`. [R1, R4, R5, O2]
3. Railway теперь документирует прямой OAuth на `https://mcp.railway.com` без
   CLI. Это предпочтительный вариант для OpenCode. CLI-мост `railway mcp`
   требует Railway CLI **5.44.0+** и пользовательского `railway login`.
   `npx -y @railway/mcp-server` устарел: пакет стал shim для CLI. [W1–W4]
4. Будущий patch должен только добавить необходимые записи `mcp.servers`
   в существующий `.opencode/opencode.json`, сохранив `$schema`, `skills` и все
   прочие значения. Шаблоны ниже выключены по умолчанию. OAuth-сессии,
   реальные ключи, CLI credential store и диагностические дампы не публиковать.
   [O1–O3, O5, R2]

## Границы и локальные наблюдения

- Проверена ветка `research/docker-deploy-mcp`, HEAD
  `67a46b05b3733f6677dc5cb1efd2f5f36c281b6e`. Исходное рабочее дерево чистое.
- Прочитаны `AGENTS.md`, `docs/agents/domain.md`,
  `docs/agents/issue-tracker.md`, `GLOSSARY.md` и
  `docs/adr/0001-client-side-navigation.md`. ADR требует production fallback
  на HTML для клиентских маршрутов без подмены API; настройку маршрутизации
  этот отчёт не меняет.
- Конфигурация изучена только структурно: `.opencode/opencode.json`
  существует, верхние ключи — `$schema` и `skills`; `skills` — массив,
  `mcp` отсутствует. Значения skills и возможные credentials не выводились.
  Глобальные, родительские и системные файлы пользователя не читались.
- `opencode --version` в этой PowerShell-среде завершился `CommandNotFound`.
  Дополнительное безопасное наблюдение оркестратора: запуск
  bundled CLI `%APPDATA%\ai.opencode.desktop\cli\2.2.6-x64\opencode-cli.exe --version`
  вернул **`opencode v2.2.6`**. CLI отсутствует в PATH даже после добавления
  `$HOME\.local\bin`; установки/setup не выполнялись. Это подтверждает версию
  данного локального CLI, но не отдельного уже работающего server build.
  Оркестратор также проверил `mcp add --help`: доступны `--url`,
  `--header key=value`, `--env key=value`, `--global` и command после `--`.
  Это локальные наблюдения, а не вывод о версии из текущих онлайн-документов.
- Аккаунты, роли, OAuth-сессии, ключи, Git-provider permissions и платёжный
  статус не проверялись. Были только чтение задач и публичных документов,
  а также неавторизованные GET публичных OAuth metadata. Регистрация
  клиентов, вход и запросы к ресурсам аккаунтов не выполнялись.
- Ограничения карты сохраняются: только публичное учебное in-memory демо,
  публичный `/admin`, исключительно вымышленные имена/email; сброс данных
  после перезапуска допустим. Ни платный ресурс, ни привязка оплаты не
  разрешены без отдельного согласия владельца. Документы не доказывают,
  что доступный бесплатный путь существует именно для его аккаунта.

## Что считать корректным OpenCode V2

В загруженном skill есть противоречие: один и тот же `https://opencode.ai/docs/`
одновременно назван источником V2 и запрещён как V1. Разрешение — проверять
содержание официальных страниц, а не делать вывод из URL. На дату обращения
`config` показывает `mcp.servers`, `mcp-servers` прямо говорит «V2 does not
place server names directly under mcp», а `migrate-v1` отдельно сопоставляет
V1/V2. Их согласованная форма использована ниже; схема не загружалась для
угадывания полей. Локальный CLI — v2.2.6 по наблюдению оркестратора; текущие
онлайн-страницы не являются закреплённой документацией именно этого build.
Полную совместимость с уже работающим сервером ещё надо проверить. [O1–O3]

Подтверждённая форма V2:

- Серверы: `mcp.servers.<name>`, выключение: `disabled: true`, не `enabled`.
- Remote: `type: "remote"`, `url`, необязательные `headers` и `oauth`.
  Transport — Streamable HTTP; не SSE URL, не JSON другого MCP-клиента.
- Local: `type: "local"`, `command` — массив executable/args; transport stdio,
  переменные процесса — `environment`, а не `env`.
- OAuth-поля при необходимости: `client_id`, `client_secret`, `scope`,
  `callback_port`, `redirect_uri`. Для public client не придумывать secret.
- `{env:NAME}` подставляет окружение; отсутствующая переменная даёт пустую
  строку. `$NAME` в JSON не является shell substitution.
- Remote OAuth включён по умолчанию; OpenCode использует PKCE, discovery и
  refresh, хранит credentials вне проектной конфигурации. Для заголовочного
  API key явно поставить `oauth: false`. [O1, O2]

Railway в собственной таблице OpenCode всё ещё показывает `enabled: true`.
Это пример совместимого legacy-формата, не основание копировать его в native
V2. Migration guide допускает нормализацию поддерживаемого V1 без переписывания
файла; native V2 имеет приоритет при конфликте. Не смешивать два определения
одного сервера и не мигрировать несвязанные настройки ради этой задачи. [W2, O3]

### Merge, precedence и сохранение существующего файла

OpenCode читает global config, затем найденные от дальних предков к текущей
директории прямые `opencode.json(c)`, затем `.opencode/opencode.json(c)` в том
же порядке. Поэтому любой обнаруженный `.opencode` config выше прямого config.
System/managed settings имеют наивысший приоритет. Поиск идёт до корня файловой
системы, не только до Git root; наличие невидимого здесь override надо проверить
в момент реализации, не публикуя секретные значения. [O1]

Несовпадающие настройки сохраняются, но **одноимённый MCP server object
заменяется целиком** более приоритетным объектом: нельзя рассчитывать, что URL
и auth сольются по полям из разных файлов. Выбирать уникальное имя и держать
полное определение подключения в одном месте. [O1, O2]

Для этого репозитория рекомендован точечный patch существующего
`.opencode/opencode.json`: добавить `mcp`, не заменить весь документ шаблоном.
Не создавать второй root config «поверх» и не обнулять `skills`. OpenCode CLI
рекомендуется документацией для сохранения несвязанных значений, но она
обещает запись в project config без гарантии выбора именно существующего
`.opencode/opencode.json`. Поэтому после любой CLI-команды проверять путь и diff;
для выключенного шаблона проще заранее проверенный ручной patch. [O1, O2]

## Render: endpoint, auth и минимальные права

| Пункт                           | Проверенный результат                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted endpoint                 | `https://mcp.render.com/mcp`; Render рекомендует hosted вместо локального запуска. [R1]                                                |
| Transport                       | Streamable HTTP и stdio; HTTP требует `initialize`, поддерживает ревизии до `2025-11-25`. Не форсировать `2026-07-28` для hosted. [R6] |
| OAuth                           | Документирован для официальных plugins/connectors и Codex; пример Codex требует `--oauth-client-id codex`. [R1]                        |
| API key                         | `Authorization: Bearer <API_KEY>`, ключ создаёт человек в Account Settings. [R1, R2]                                                   |
| Локальные зависимости hosted    | MCP-capable OpenCode, HTTPS-сеть и браузер для OAuth; Node, `npx`, Docker и Render CLI для прямого remote config не нужны. [R1, O2]    |
| Локальный альтернативный сервер | Официально доступны Docker image или executable; `RENDER_API_KEY`, stdio. Не нужен для рекомендуемого пути. [R1, R6]                   |

Публичный protected-resource metadata указывает `resource` равным endpoint и
authorization server `https://api.render.com`. Его metadata объявляет PKCE
`S256`, authorization code/refresh, public-client token auth `none` и endpoint
отзыва `https://api.render.com/v1/oauth/token/revoke`, но **не** объявляет
`registration_endpoint` или `client_id_metadata_document_supported`. [R4, R5]

OpenCode выбирает pre-registered client, затем CIMD, затем DCR. Следовательно,
из найденных документов нельзя вывести работоспособный URL-only OAuth Render
для OpenCode: нужен допустимый pre-registered public client и его loopback
redirect либо новое подтверждение discovery поддержки. Отсутствие полей не
доказывает, что регистрация невозможна вообще. `codex` не выдавать за ID OpenCode,
не ставить произвольный client ID, secret или scope. [O2, R1, R5]

Если пользователь разрешит API-key fallback:

1. Человек открывает Account Settings → API Keys и создаёт отдельный ключ
   этого учебного проекта. Scoped API keys — **early access**, доступны не
   обязательно всем аккаунтам; они ограничиваются одним workspace. [R2, R3]
2. Для первого `list_services` достаточно документированного **Services: Read**.
   Не включать чтение значений environment variables/secret files, connection
   strings, БД, environment groups или write «на всякий случай». Для будущего
   создания сервиса документация различает **Services: Read & write**, для
   trigger deployment — **Deploys: Run**, для истории — **Deploys: Read**.
   Это соответствие API permissions, не обещание, что весь MCP bootstrap
   удовлетворится только Services: Read. Проверить конкретную ошибку и не
   расширять права автоматически. [R3]
3. Если scoped key недоступен, остановиться и согласовать риск более широкого
   classic key; не называть его read-only/scoped. Выбор workspace в MCP
   не заменяет ограничение полномочий credential. [R1–R3]
4. Ключ человек передаёт только в environment нужного процесса, не в чат,
   config, tracked `.env`, shell history или командный аргумент с реальным
   значением. Ключ виден полностью только при создании. [R2, R3]

Ротация API key: создать замену с теми же минимальными правами, доставить её
в нужный процесс, проверить read-only доступ, отозвать старую через Dashboard.
Render предупреждает, что отзыв действует сразу; при компрометации отзывать
немедленно, а не ждать плановой ротации. [R2, R3]

Для OAuth OpenCode `mcp logout` удаляет локальные credentials, но это не
доказательство provider-side отзыва. Render metadata публикует revocation
endpoint; точный пользовательский Dashboard-путь отзыва OAuth grant в найденной
инструкции MCP не описан. До реального подключения уточнить его у Render;
не выполнять ручной POST с token из agent shell. [O2, R1, R5]

## Railway: актуальный OAuth и CLI fallback

| Путь                    | Endpoint / команда                                | Auth и требования                                                                                                            |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Предпочтительный remote | `https://mcp.railway.com` (без добавления `/mcp`) | OAuth MCP-клиента, Railway account, браузер/HTTPS; Railway CLI не требуется. [W1, W2]                                        |
| CLI-мост                | `railway mcp`                                     | stdio от OpenCode к CLI, HTTPS дальше к hosted; CLI 5.44.0+, существующий `railway login`, refresh credentials CLI. [W1, W2] |
| Настоящий local         | `railway mcp local`                               | stdio, прямой Railway API с CLI credentials; другой набор tools. Для egress-ограничений, а не основной вариант. [W1, W2]     |
| Старый npm package      | `npx -y @railway/mcp-server`                      | Deprecated compatibility shim, требует CLI; не рекомендовать как новый setup. Репозиторий архивирован 2026-05-23. [W4]       |

Remote OpenCode использует Streamable HTTP; официальный Railway документирует
прямое подключение OAuth-capable MCP-клиента к указанному endpoint. Публичные
metadata подтверждают resource, issuer `https://backboard.railway.com`, PKCE
S256, DCR registration endpoint и CIMD. Это сильнее подтверждает возможность
автоматической регистрации OpenCode, чем metadata Render, но успешный вход
конкретного пользователя всё равно не проверен. [O2, W1, W5, W6]

Protected resource Railway объявляет **`workspace:member`**, не viewer.
Общая OAuth-документация знает `workspace:viewer`, `project:viewer` и другие
scopes, но отсюда не следует, что hosted MCP принимает viewer-only token.
Не обещать read-only OAuth scope для MCP и не запрашивать admin. По умолчанию
оставить discovery scopes серверу, на consent выбрать только нужные учебные
ресурсы. Если экран требует лишние полномочия — остановиться. [W5–W7, O2]

Railway MCP требует user identity и **не принимает project tokens**.
Не подменять OAuth на `RAILWAY_TOKEN`, хотя для обычного CLI этот CI-вариант
существует. Для этой задачи не нужен отдельный account API token: OAuth или
CLI login держат credential вне editor config. [W1, W3]

Общие Railway OAuth docs описывают часовые access tokens, refresh rotation
и необходимость хранить самый новый refresh token. Это задача MCP-клиента,
не причина копировать tokens вручную. Отзыв OAuth-доступа доступен в account
settings по MCP docs; после него удалить локальный grant через
`opencode mcp logout railway-demo`. CLI `railway logout` очищает сохранённый
CLI token, но документ не обещает provider-side отзыв всех ранее выданных
токенов. [W1, W8, W9, O2]

## Выключенные проектные шаблоны

**Это фрагменты для точечного объединения, не замена существующего файла.**
`$schema` оставлен для редактора. Никакие серверы в исследовании не добавлялись.
Включать только выбранный путь, не все варианты сразу.

### Railway OAuth: подтверждённая документами форма V2

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "railway-demo": {
        "type": "remote",
        "url": "https://mcp.railway.com",
        "disabled": true
      }
    }
  }
}
```

Основания: [O1, O2, W1, W2]. Для включения после разрешения убрать `disabled`
либо поставить `false`; вход — человеком через `/mcps`.

### Render OAuth: только после подтверждения регистрации клиента

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "render-demo": {
        "type": "remote",
        "url": "https://mcp.render.com/mcp",
        "oauth": {
          "client_id": "<RENDER_APPROVED_PUBLIC_CLIENT_ID>",
          "redirect_uri": "http://127.0.0.1:<REGISTERED_PORT>/callback"
        },
        "disabled": true
      }
    }
  }
}
```

Это **не готовая регистрация**: placeholders должен заменить человек данными,
которые Render действительно разрешил для OpenCode. Loopback URI и port должны
соответствовать регистрации; не включать этот шаблон как есть. Если провайдер
впоследствии подтвердит CIMD/DCR, повторно сверить metadata и рассмотреть
URL-only вариант без `oauth` object. [O2, R1, R4, R5]

### Render API key: только согласованный fallback

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "render-demo": {
        "type": "remote",
        "url": "https://mcp.render.com/mcp",
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {env:RENDER_API_KEY}"
        },
        "disabled": true
      }
    }
  }
}
```

Основания: [O1, O2, R1–R3]. Использовать вместо OAuth object целиком.

### Railway CLI-мост: запасной путь без npm MCP shim

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "railway-demo": {
        "type": "local",
        "command": ["railway", "mcp"],
        "disabled": true
      }
    }
  }
}
```

Основания: [O2, W1, W2]. CLI executable должен быть доступен **серверу OpenCode**,
а не только отдельному терминалу. Если понадобится in-process вариант,
документированная команда — `["railway", "mcp", "local"]`; не менять её без
решения, потому что меняется сервер и каталог tools. [W1, W2]

## Окружение: терминал не равен работающему shared server

OpenCode V2 обычно использует общий background server; именно он владеет
конфигурацией, интеграциями и выполнением tools. `--standalone` запускает
приватный сервер. Переменные PowerShell наследуются дочерними процессами;
изменение `$env:RENDER_API_KEY` в новом терминале не меняет уже запущенный
shared server или отдельный desktop server. Это вывод из модели процессов,
а не обещание OpenCode автоматически синхронизировать environment. [O4, O5, E1]

Практический порядок для API-key fallback после явного разрешения:

1. Человек доставляет ключ в окружение процесса безопасным локальным способом,
   без literal в сохраняемой команде/истории; агент не читает его значение.
2. При необходимости изолированного доказуемого запуска использовать новый
   `opencode --standalone` из подготовленного терминала. Для desktop выяснить,
   какой сервер используется и какое окружение получил при старте. Не считать,
   что «в PowerShell переменная есть» доказывает доступность серверу.
   Статус и вход проверять через `/mcps` именно этого клиента: отдельно
   запущенный обычный `opencode mcp list` может обратиться к shared server,
   а не к приватному серверу standalone. [O2, O4]
3. Не предлагать `service restart` как обычное применение config. Для изменения
   окружения существующего daemon нужен отдельно согласованный lifecycle и
   проверенный способ передачи env; новый терминал сам этого не решает.
4. Изменение конфигурации и изменение process env — разные операции.
   Следовать reload-механизму установленного build; если требуется ручной
   reload, проверить доступность `/reload`, а не обещать hot reload по одной
   лишь этой странице config. [O1, O4, O5, E1]

Для иллюстрации синтаксиса env, **не для ввода реального ключа в историю**:

```powershell
$env:RENDER_API_KEY = '<PLACEHOLDER_ONLY>'
opencode --standalone
Remove-Item Env:RENDER_API_KEY
```

Удаление env после выхода убирает только переменную текущего терминала;
это не отзыв credential и не очистка уже запущенных процессов. Не использовать
`Get-ChildItem Env:`, debug config dumps или чтение auth storage для проверки.
`.env` не считать автоматически загружаемым OpenCode без отдельного
документированного механизма. [E1, O1, O4]

## Точная будущая последовательность подключения и проверки

Все команды ниже — **инструкция на этап реализации**. Выполненные безопасные
version/help observations отдельно перечислены выше; подключения и входа не было.

### 1. Read-only preflight

В нужном checkout проверить версию и сервер, не читать credential stores:

```sh
opencode --version
opencode service status
opencode mcp list
```

`mcp list` показывает connection state, не доказывает права на конкретный
workspace. При необходимости `opencode api get /api/info` проверяет сервер;
команда может автоматически запустить service. Не запускать её просто ради
сбора информации в фазе, где запуск запрещён. [O2, O5]

Человек подтверждает: нужный аккаунт и учебный workspace, роль, возможность
авторизовать клиента, браузер с callback на машину OpenCode. Доступ к GitHub
repository через хостинг — отдельное разрешение: этот отчёт его не выдаёт и
не проверяет. В случае требуемой оплаты/карты или чрезмерных прав остановиться.

### 2. Подготовить и включить только выбранный server

Сделать точечный patch шаблона в `.opencode/opencode.json`, проверить сохранение
`skills` и unrelated values, затем включить выбранную запись. Это обеспечивает
контроль пути и `disabled`, который CLI quick start не обещает. [O1, O2]

Альтернатива после разрешения на немедленное подключение — точные команды V2
из корня проекта, **без `--global`**:

```sh
opencode mcp add railway-demo --url https://mcp.railway.com
opencode mcp list
```

Для согласованного Render API-key пути CLI умеет заголовок с буквальной env
ссылкой, но `oauth: false` всё равно надо задать в config **до подключения**.
Поэтому здесь рекомендован выключенный config patch, а не автоматическая
команда добавления. Для Render OAuth URL-only `mcp add` не предлагать как
заведомо рабочий вход без подтверждённой регистрации. [O2, R5]

### 3. OAuth выполняет только человек

В OpenCode открыть **`/mcps` → выбранный server → sign in**, прочитать issuer,
scopes и выбранные ресурсы, подтвердить только согласованный доступ.
`opencode mcp auth` существует, но агент не запускает его shell tool: ссылка
интерактивной авторизации может скрыться в фоне. Не пересылать коды/callback
URL с `code` и `state` в issues, отчёт или Git. [O2]

При remote/SSH браузере OpenCode допускает вставку callback URL в специальный
sign-in prompt. Делает это человек в auth UI, не в чат с агентом. Пока
`mcp list` не показывает `connected`, статус — «настроен, ожидает входа»,
не «готов к деплою». [O2]

### 4. Railway CLI fallback — только при выборе этого пути

При отсутствии CLI его установка — отдельное разрешённое человеком действие.
Документированные Windows-варианты: `npm i -g @railway/cli` (Node.js 16+)
или `scoop install railway`; не выполнять их в исследовании и не менять
репозиторный toolchain автоматически. [W3]

```sh
railway --version
railway login
railway whoami
railway list
```

`login` интерактивно выполняет человек в своём терминале; `--browserless`
возможен для среды без браузера. `whoami` и `list` проверяют identity/доступ
без деплоя; персональные значения из вывода не публиковать. После login
CLI-мост читает обновлённую сессию без перезапуска editor. [W2, W3]

CLI-эквивалент добавления уже выбранного моста в OpenCode:

```sh
opencode mcp add railway-demo -- railway mcp
opencode mcp list
```

Это тоже включает подключение: для безопасной предварительной подготовки
предпочтителен выключенный patch. Не использовать `railway setup agent` или
`railway mcp install` в этой задаче: они записывают конфиги, могут охватить
другие инструменты, а опубликованный Railway пример OpenCode ещё legacy. [O2, W2]

### 5. Подтвердить доступ только чтением

- **Render:** сначала обнаружить фактический tools catalog, затем
  `list_workspaces`; человек выбирает допустимый workspace. Актуальный README
  рекомендует явно передавать `workspaceId` в resource calls вместо
  deprecated session-based `select_workspace`. Выполнить только `list_services`
  для выбранного workspace. Для существующего demo service можно проверить
  `list_deploys`/`get_deploy`, если разрешён Deploys: Read. Не читать env values,
  connection strings, SQL или потенциально секретные логи. [R1, R3, R6]
- **Railway hosted:** фактически доступные `whoami`, `list-projects`, затем
  `list-services` нужного подтверждённого проекта. Не угадывать аргументы —
  брать схему из текущего каталога. Не вызывать `railway-agent`, `redeploy`,
  `accept-deploy` или tools переменных для проверки подключения. [W1]
- Пустой список — допустимое отсутствие ресурсов или ограничение доступа,
  не доказательство поломки транспорта. `connected` плюс read-only результат
  подтверждает только этот доступ на этот момент; создание/деплой требуют
  отдельного согласия, проверенных permissions и решения о расходах. [R1, O2, W1]

Для временного отключения — `/mcps` disconnect; это не изменяет config.
Для постоянного — `disabled: true`. Для удаления локального OAuth grant после
решения пользователя: `opencode mcp logout <server-name>`; отзыв у провайдера
проверяется отдельно. [O2]

## План repo-scoped аудита секретов на этапе реализации

**Аудит не выполнен.** Чистый исходный status и безопасные примеры в отчёте
не дают права заявлять «секретов во всей истории нет».

1. Зафиксировать репозиторий, HEAD, refs, версии сканера и границы проверки.
   Проверить shallow/history completeness. После разрешения обновить именно
   refs этого repository, включая ветки и теги, а не другие личные репозитории.
   `--all` означает все **доступные локальные refs**, не потерянные server refs
   или каждый существовавший когда-либо fork. Ограничения полноты записать. [G1]
2. Инвентаризировать tracked, staged, untracked и ignored пути только внутри
   repo. Не переходить по symlinks в личные каталоги; исключения вроде
   dependency/build directories обосновать и записать, не скрывать ими исходники.
   Реальные `.env`, OAuth/session exports, CLI auth files и scanner reports не
   должны попасть в индекс; если локальные файлы нужны, заранее согласовать
   ignore rules и проверить их, не игнорировать весь `.opencode`. [G2]
3. Прогнать approved/pinned Gitleaks с redaction по полной доступной истории
   refs, а не диапазону новой ветки. Отдельно сканировать рабочие файлы и
   содержимое **индекса**, которое может отличаться от рабочего дерева.
   Проверить также commit messages и подозрительные repo artifacts; patch
   scanner не является исчерпывающим доказательством для всех Git objects.
   Gitleaks `git` использует `git log -p`, `dir` — файлы, `stdin` — входной поток.
   Не применять baseline, скрывающий старые находки. [G3]

Пример будущих команд из корня repository, не запускать в этом исследовании:

```sh
git ls-files --cached
git ls-files --others --exclude-standard
git ls-files --others --ignored --exclude-standard
gitleaks git --redact=100 --log-opts="--all --full-history" .
gitleaks dir --redact=100 .
git diff --cached --no-ext-diff --binary | gitleaks stdin --redact=100
```

Основания команд: [G1–G4]. Pipeline индекса проверяет staged patch, **не весь
индекс**: для полного покрытия надо дополнительно сканировать все staged blobs
по списку `git ls-files --stage` в изолированном локальном потоке/экспорте без
печати содержимого и без добавления временных файлов в repo. Для unusual
filenames использовать NUL-safe обработку. Версия shell/encoding и support
flags сканера проверяются заранее; stdout с сырыми patches не сохранять. [G2–G4]

4. В implementation acceptance хранить только обезличенную сводку: SHA/refs,
   даты, команды/версии, охват history/index/worktree/untracked, exclusions,
   результат и разобранные false positives. Полные отчёты с путями/метаданными
   тоже считать чувствительными; не коммитить их автоматически.
5. При находке: остановить публикацию, сообщить владельцу без значения секрета,
   отозвать/ротировать credential. Очистка истории, force push и удаление
   пользовательских файлов — отдельное согласование, не действие исследования.
   Отсутствие находок — результат указанного охвата/правил, а не абсолютная
   гарантия отсутствия всех возможных секретов. [R2, R3, G3]

Не сканировать `$HOME`, credential stores OpenCode/Railway, профили shell,
browser storage, другие checkout или личные диски. Для проверки repository
не требуется узнавать реальные значения ключей.

## Неподтверждённое: checklist перед реализацией

- [ ] Версия работающего server build и совместимость с локальным CLI v2.2.6;
      доступность CLI в пользовательской среде, отсутствие влияющего
      system/ancestor override.
- [ ] Для Render: разрешённый public client OpenCode/redirect либо актуальное
      подтверждение CIMD/DCR; путь provider-side отзыва OAuth.
- [ ] Если Render OAuth недоступен: отдельное согласие на API key; доступность
      scoped early access, минимальные bootstrap permissions, окружение сервера.
- [ ] Railway: consent действительно ограничен нужными ресурсами; принятие
      требуемого `workspace:member`, возможность refresh и отзыва у пользователя.
- [ ] Успех `/mcps` и read-only проверки под реальным аккаунтом; CLI 5.44.0+
      только если выбран CLI fallback.
- [ ] GitHub repository доступен выбранному хостингу с согласованными правами;
      это не следует из работоспособного MCP login.
- [ ] Нет оплаты без согласия; если бесплатный путь недоступен, вернуться к
      владельцу, а не автоматически включать платный ресурс.
- [ ] Repo-scoped all-history, staged/index, tracked/untracked аудит выполнен
      и его ограничения честно отражены; пока такого результата нет.

## Индекс первичных источников

Все ссылки ниже открыты **2026-11-08**. Metadata — публичные наблюдения на эту
дату, не бессрочный контракт. Ссылки на движущиеся README требуют повторной
проверки при реализации.

| ID  | Источник                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | OpenCode Config: https://opencode.ai/docs/config                                                                                                                                                    |
| O2  | OpenCode MCP servers (явно V2): https://opencode.ai/docs/mcp-servers                                                                                                                                |
| O3  | OpenCode migration V1 → V2: https://opencode.ai/docs/migrate-v1                                                                                                                                     |
| O4  | OpenCode CLI / shared service / standalone: https://opencode.ai/docs/cli                                                                                                                            |
| O5  | OpenCode troubleshooting / version / service / API: https://opencode.ai/docs/troubleshooting                                                                                                        |
| R1  | Render MCP server, hosted setup, OAuth/API key, local alternatives: https://render.com/docs/mcp-server                                                                                              |
| R2  | Render API, key creation and immediate revocation: https://render.com/docs/api                                                                                                                      |
| R3  | Render scoped API keys, early access, permission tables: https://render.com/docs/scoped-api-keys                                                                                                    |
| R4  | Render public protected-resource metadata: https://mcp.render.com/.well-known/oauth-protected-resource                                                                                              |
| R5  | Render public authorization-server metadata: https://api.render.com/.well-known/oauth-authorization-server                                                                                          |
| R6  | Official Render MCP README, transports, revisions, workspaceId and tools: https://github.com/render-oss/render-mcp-server                                                                           |
| W1  | Railway MCP server, OAuth, CLI, identity, security: https://docs.railway.com/reference/mcp-server                                                                                                   |
| W2  | Railway MCP CLI, 5.44.0+, install flags, legacy OpenCode examples: https://docs.railway.com/cli/mcp                                                                                                 |
| W3  | Railway CLI install, Node requirement, login/whoami/list/logout: https://docs.railway.com/cli                                                                                                       |
| W4  | Official archived npm MCP repository and deprecation/migration: https://github.com/railwayapp/railway-mcp-server                                                                                    |
| W5  | Railway public protected-resource metadata: https://mcp.railway.com/.well-known/oauth-protected-resource                                                                                            |
| W6  | Railway public authorization metadata, DCR/CIMD/PKCE: https://mcp.railway.com/.well-known/oauth-authorization-server                                                                                |
| W7  | Railway OAuth scopes and selective consent: https://docs.railway.com/integrations/oauth/scopes-and-user-consent                                                                                     |
| W8  | Railway access/refresh token lifecycle: https://docs.railway.com/integrations/oauth/login-and-tokens                                                                                                |
| W9  | Railway logout semantics: https://docs.railway.com/cli/logout                                                                                                                                       |
| E1  | Microsoft PowerShell environment inheritance and process scope: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables?view=powershell-7.5 |
| G1  | Git log, refs, `--all` / `--full-history`: https://git-scm.com/docs/git-log                                                                                                                         |
| G2  | Git tracked/index/untracked/ignored inventory, NUL output: https://git-scm.com/docs/git-ls-files                                                                                                    |
| G3  | Gitleaks official commands, history scanning, redaction and limits: https://github.com/gitleaks/gitleaks/blob/master/README.md                                                                      |
| G4  | Git diff, staged patch: https://git-scm.com/docs/git-diff                                                                                                                                           |

Проверенные отрицательные результаты: metadata authorization server по адресу
`https://mcp.render.com/.well-known/oauth-authorization-server` возвращал 404;
правильный issuer взят из protected-resource metadata [R4], а не угадан.
Страница `https://render.com/docs/oauth` также вернула 404; это не опровергает
OAuth, явно описанный в [R1].

Проверка отчёта: ручная сверка утверждений, ссылок, placeholders и JSON-структур.
Полный `mise run check`, setup, auth, secret audit и деплой не запускались.
Проверки Git diff и публикацию выполняет оркестратор; этот отчёт не заявляет
их выполненными.
