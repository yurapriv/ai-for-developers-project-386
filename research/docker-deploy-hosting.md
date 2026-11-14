# Docker-деплой через официальные MCP Render и Railway

Повторная проверка **2026-11-14** по публичной официальной документации и закреплённым исходникам; обновлён существующий отчёт от 2026-11-08. Это не проверка доступности конкретного аккаунта. Исследование для [«Исследовать Docker-деплой через MCP Render и Railway»](https://github.com/yurapriv/ai-for-developers-project-386/issues/16), части [«Путь к сдаче финального задания „Docker и деплой“»](https://github.com/yurapriv/ai-for-developers-project-386/issues/15).

**Статус: только исследование и план. Хостинг не выбран, деплой не выполнялся.** Аккаунты, секреты и подключённые hosting MCP не исследовались; ресурсы, регистрации, платежи и публикации образов не создавались. Настройка OpenCode и способы авторизации MCP уже описаны в [опубликованном исследовании подключения](https://github.com/yurapriv/ai-for-developers-project-386/blob/844b676a44b8f5e3591a5ec8ba763abf2f8915a9/research/docker-deploy-mcp.md); здесь только минимальные предпосылки провайдеров.

## Краткий результат

- **Render:** прямой официальный MCP-инструмент `create_web_service` создаёт web service из Git Dockerfile: `runtime: docker`, `plan: free` подтверждены исходником, хотя README пропускает Free. Через него нельзя задать HTTP health path или готовый registry image. Для полного MCP-only пути исходник отдельно предлагает **Blueprint public alpha**: удалённый YAML → plan → одобренный apply; YAML поддерживает health path, Dockerfile и registry image. Наличие alpha в конкретном hosted inventory не проверено; без неё HTTP health требует отдельно разрешённого Dashboard/API шага. [R1–R4, R10, R13]
- **Railway:** сейчас существуют разные официальные MCP-поверхности. Hosted MCP предлагает небольшой набор именованных инструментов и делегирующий `railway-agent`; локальный MCP в CLI имеет явные инструменты для GitHub, образов, загрузки локального каталога, переменных, домена, health check и логов. Старое утверждение «MCP умеет только deploy связанного локального репозитория» нельзя применять ко всем текущим вариантам. [W1–W4]
- **Registry не обязателен:** обе платформы собирают Dockerfile из исходников. Render Free — не временный trial; Railway имеет отдельные Free ($1/месяц usage credit) и Trial ($5 один раз, до 30 дней). Ни бесплатность конкретного аккаунта, ни достаточность кредитов для демонстрации не доказаны. При любом платном требовании — остановка и решение владельца проекта, не автоматический переход. [R5–R7; W5–W7]

## 1. Что уже есть в репозитории

Историческая база этого worktree: `67a46b05b3733f6677dc5cb1efd2f5f36c281b6e`, **не текущий `main`**. Повторно прочитаны `AGENTS.md`, `docs/agents/domain.md`, `GLOSSARY.md` и [ADR о клиентской навигации](../docs/adr/0001-client-side-navigation.md). Утверждения о реализации ниже относятся только к этой базе; согласованный контракт `PORT` в §5 — требование, а не вывод о состоянии `main`.

На этой базе [README](../README.md) описывает контейнерный запуск, но его фраза «Подтверждение записи ещё не реализовано» устарела: [Go handler](../internal/server/handler.go) содержит создание записи, список предстоящих встреч и ответ `409` при пересечении; [BookingPage](../frontend/src/pages/BookingPage.tsx) вызывает создание и показывает подтверждение. Это наблюдение кода, не результат приёмки. Прочитанные [Dockerfile](../Dockerfile), [main.go](../cmd/server/main.go) и [frontend.go](../internal/server/frontend.go) подтверждают контейнерную схему ниже. README здесь не изменяется.

Целевая схема — **один контейнер, один публичный Go-процесс, один origin**: Go обслуживает React static assets и API `/api/`; второй frontend service, Vite dev/preview, БД, volume и custom domain для этой публикации не нужны. Dockerfile уже собирает React и Go в разных build stages, копирует статику в `/frontend`, запускает `/server` из `scratch`, задаёт `FRONTEND_DIR=/frontend`, `LISTEN_ADDR=0.0.0.0:8080` и `EXPOSE 8080`.

Данные в памяти могут исчезать при sleep/restart/redeploy; это допустимо для задания, но нужно заново подготовить тестовый каталог перед показом. `/admin` публичен: только вымышленные имена и контакты, никаких реальных персональных данных. Это ограничение проекта, не средство защиты хостинга. [README](../README.md)

## 2. Render: платформа и точная MCP-поверхность

Официальный hosted endpoint — `https://mcp.render.com/mcp`; текущая документация поддерживает OAuth, а не только API key. Нужен доступ к нужному Render workspace. Выбор способа подключения, выдача разрешений и конфигурация клиента здесь не выполняются и относятся к параллельной задаче. [R1]

### Создание Docker web service

В исходниках Render MCP зафиксирован commit `16fe2e9977b0cf4837d6b68fe7f02f3cd85c4bd7`. `create_web_service` принимает:

| Параметр                          | Подтверждённая семантика                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`, `runtime`                 | Обязательны; runtime enum включает `docker`.                                                                                                                       |
| `repo`, `branch`                  | Git URL, который Render может клонировать; ветка отдельно, иначе default branch. Формальная optional-схема `repo` не означает поддержку загрузки локальных файлов. |
| `dockerfilePath`, `dockerContext` | От корня репозитория; defaults `./Dockerfile` и `.`.                                                                                                               |
| `dockerCommand`                   | Необязательный override; пропуск/пустая строка сохраняет `ENTRYPOINT`/`CMD` образа. Для нашего `scratch` не добавлять shell-команду.                               |
| `buildCommand`, `startCommand`    | Для `docker` не обязательны; native-команды не заменяют Docker build.                                                                                              |
| `plan`                            | Исходник явно добавляет `free` в enum и использует `free`, если параметр отсутствует. В будущем запросе всё равно задавать `free` явно.                            |
| `region`, `autoDeploy`            | Default `oregon`, default `yes`; автоматические публикации необходимо согласовать, не полагаться на default.                                                       |
| `envVars`                         | Массив объектов `{key, value}`; значения доступны при сборке и выполнении.                                                                                         |

Источник: реализация schema, validation и формирования API request [R2], enum/default Free [R3]. **Расхождение:** README сервера [R4] ещё перечисляет для web service старые платные планы без `free`; исходник и актуальные platform compute IDs отличаются от этой таблицы. До будущего создания сверить фактический `tools/list` подключённого сервера с этими полями. Отсутствие `free` в живой схеме — блокер, а не повод посылать `starter` или надеяться на API default.

Прямой `create_web_service` не принимает image URL, registry credentials или `healthCheckPath`; его описание явно исключает prebuilt images. Нельзя переносить возможности Render REST/Dashboard на MCP. Платформа отдельно умеет Dockerfile builds (BuildKit, multistage, `.dockerignore`) и image-backed services. Для последних нужны доступный registry image, `linux/amd64`, compressed image ≤10 GB; обновление registry tag само по себе не запускает deploy. Локальный `docker build` не делает образ доступным Render, а загрузки локального каталога в этом MCP-инструменте нет. [R1, R2, R6, R8]

### Изменения, URL, состояние и логи

- `list_workspaces`, `list_services`, `get_service(serviceId)` дают обнаружение workspace/service и деталей. Текущий README рекомендует явный `workspaceId` на resource-вызовах; implicit selected workspace объявлен deprecated, хотя основная документация ещё описывает его выбор. Workspace должен подтвердить человек. [R1, R4]
- После создания web service платформа выдаёт `*.onrender.com`, автоматически обслуживает HTTPS и перенаправляет HTTP на HTTPS. URL нужно получить из результата/деталей сервиса и проверить извне, не конструировать как доказательство доступности. Отдельный custom domain не требуется. [R7]
- `list_deploys(serviceId)`, `get_deploy(serviceId, deployId)` — история и состояние; `trigger_deploy(serviceId, clearCache=false)` — **запись**, новый deploy. Git-provider-backed сервис может обновляться автоматически при push; public-Git-URL путь без provider credentials autodeploy не поддерживает, несмотря на общий default инструмента `yes`. Не запускать дубликат deploy вручную без необходимости. [R4, R7, R12]
- `list_logs(resource: [serviceId], type, startTime, endTime, limit, …)` фильтрует логи. Для диагностики брать build и runtime/service logs, привязывая временной диапазон к deploy; конкретные доступные значения `type` можно выяснить через `list_log_label_values`. Наличие фильтров request logs не гарантирует их доступность на Hobby: pricing относит HTTP request logs к Pro+. `list_events` в текущем README отдельно сообщает о restarts, OOM и health failures, которые могут отсутствовать в stdout/stderr. [R4, R5]
- `update_environment_variables(serviceId, envVars, replace)` в проверенном исходнике **по умолчанию merge**, `replace=true` заменяет весь набор; затем инструмент сам вызывает deploy. README/основная документация говорят об обновлении «всех» переменных — это ещё одно расхождение. Проверить живую schema, не выгружать существующие секреты в контекст и не запускать второй deploy автоматически. [R1, R2, R4]
- Общие изменения service settings, масштаба и удаление не поддерживаются прямыми service MCP tools; наличие описания `update_web_service` в README не доказывает write-возможности: функция в исходнике возвращает ссылку на Dashboard и не включена в список регистрируемых service tools. Настройка HTTP health path — через Dashboard/API по отдельному разрешению. [R1, R2]

**Отдельный MCP-only путь — Blueprint public alpha**, подтверждённый README и handler, но не live-сервером. `create_blueprint(repoUrl, branch?, path?, name?, autoSync?, existingResources?)` читает уже опубликованный удалённый YAML; defaults: `path=render.yaml`, `autoSync=true`, `existingResources=create_new`. Результат содержит `blueprint`, `planningOutcome`, `sync`, `notices`; `get_blueprint(blueprintId)` — чтение, `plan_blueprint(blueprintId)` создаёт план, `approve_blueprint(blueprintId, manualEnvVars?)` применяет последний успешно проверенный план **только после отдельного одобрения человека**. `workspaceId` передаётся явно согласно README. `failed` и `no_changes` не одобряют; returned sync/status не доказывает готовность web service. [R4, R13]

YAML поддерживает `type: web`, `runtime: docker`, `plan: free`, `dockerfilePath`, `dockerContext`, `healthCheckPath: /api/health`; для prebuilt image — **другой** runtime `image` и `image.url`. Поэтому формулировка «официальный MCP вообще не может registry image» слишком сильная: прямой create не может, Blueprint даёт документированный условный путь. Он требует remote YAML и доступной alpha, не загружает локальный образ; private image ссылается на заранее созданные registry credentials, которые spec предлагает добавлять через Dashboard/API. Это не гарантия полного MCP-only provisioning credentials. Создание/планирование Blueprint не read-only, approval меняет инфраструктуру; `autoSync` и `adopt` требуют явного решения. Здесь YAML, Blueprint и ресурсы не создаются. [R8, R10, R13]

### Health checks Render

Без HTTP path используется TCP probe, обычно на публичном HTTP-порту. HTTP probe делает GET по заданному пути; `2xx` **или `3xx` за ≤5 секунд** считается успехом. Новые экземпляры должны одновременно пройти проверки в пределах 15 минут, иначе deploy отменяется и сохраняется прежняя версия, если она была. Это также **continuous monitoring**: последовательные сбои 15 секунд исключают экземпляр из маршрутизации, 60 секунд приводят к restart. Проверки идут каждые несколько секунд. Для проекта желательно проверять `/api/health` с прямым `200` и ожидаемым JSON: redirect/SPA HTML не должны означать готовность. [R9]

## 3. Railway: не смешивать hosted, CLI-local и старый пакет

Официальная документация на дату наблюдения описывает hosted `https://mcp.railway.com` с прямым OAuth либо CLI-прокси `railway mcp`, который использует существующую login-сессию (CLI ≥5.44.0). Прокси ведёт к **hosted inventory**, это не локальная расширенная поверхность. Отдельный in-process сервер `railway mcp local` обращается к Railway API и имеет другой набор инструментов. Требуется аккаунт с пользовательской идентичностью; **project tokens MCP не принимает**. Это описание предпосылок, не инструкции настройки/входа. [W1]

Старый официальный `@railway/mcp-server` deprecated и служит shim к CLI; его прежние tutorial/tool lists нельзя считать актуальным контрактом. Даже README shim и основная документация расходятся в терминах local/remote defaults. Конкретную поставленную версию и `tools/list` необходимо выяснить до планирования вызовов; здесь подключение не выполнялось. [W1, W2]

### Hosted MCP

Документированы `whoami`, `list-projects`, `create-project`, `list-services`, feature-flag tools, `redeploy`, `accept-deploy` и `railway-agent`. На 14 ноября также перечислены cloud-agent task tools: `run-cloud-agent-task`, `check-cloud-agent-task`, `list-cloud-agent-tasks`, `get-cloud-agent-transcript`, `respond-cloud-agent-task`, `cancel-cloud-agent-task`, `list-cloud-agent-models`; запуск нового cloud agent прямо обозначен оплачиваемым. Они для Docker-публикации не нужны. [W1]

`accept-deploy` применяет staged changes и запускает deploy. `railway-agent` выполняет многошаговые действия, включая анализ логов и настройки, но **не является гарантией отдельного именованного read-only log/domain/Docker creation tool**. Документация не публикует точную schema всех внутренних операций агента; не выводим из примера ни поддержку конкретных Docker-параметров, ни отсутствие платных действий. Вызов агента не входит в безопасную read-only проверку. Agent Usage учитывается/ограничивается отдельно от compute. [W1, W11]

### Локальный MCP в Railway CLI

Проверен официальный исходник CLI commit `5a07ac2ae44ec2fcf892ba96e18f638402c7f8fb`; это публичный source snapshot, не утверждение о версии установленного CLI. В текущем local API default linkage можно заменить явными `project_id`, `service_id`, `environment_id` там, где эти поля предусмотрены. [W3, W4]

| Задача                        | Подтверждённые инструменты и границы                                                                                                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Создать проект/service        | `create_project(name, workspace_id?, …)`; `create_service(project_id?, environment_id?, name?, source_repo?, branch?, source_image?)`. `source_repo` — `owner/repo`; `source_repo` и `source_image` взаимоисключающие, `branch` допустим только для repo.                                            |
| Привязать GitHub или image    | `connect_service_source(…, source_repo?, branch?, source_image?)` требует ровно один источник. Это текущая явная MCP-возможность, не только Dashboard/CLI.                                                                                                                                           |
| Загрузить локальные исходники | `deploy(project_id?, service_id?, environment_id?, path?, message?)` создаёт tarball, загружает его и начинает deploy. Default `path` — текущий каталог; без service ID backend может создать service. Это **не** push готового локального Docker image и **не** создание GitHub autodeploy linkage. |
| Dockerfile/health/restart     | `update_service(…, dockerfile_path?, root_directory?, health_check_path?, healthcheck_timeout?, sleep_application?, restart_policy_type?, …)`. Dockerfile в source root с именем `Dockerfile` распознаётся автоматически; для текущего проекта source/build context — корень, а не `frontend/`.      |
| Переменные                    | `set_variables(…, variables: map, skip_deploys?)` задаёт значения; `skip_deploys` позволяет пропустить redeploy. Не считать изменение окружения просто чтением.                                                                                                                                      |
| Публичный адрес               | `generate_domain(…, domain?, port?)`: без `domain` создаёт Railway service domain, `port` задаёт target. `list_domains`, `domain_status` — последующее чтение.                                                                                                                                       |
| Статус/логи                   | `environment_status`, `list_deployments(…, limit?)`, `get_logs(…, deployment_id?, log_type?, lines?, since?, until?, …)`. `log_type` enum: `build`, `deploy`, `http`; default — `deploy` (runtime), lines default 100.                                                                               |

Параметры — [W3], реализация source validation/settings — [W4], tarball deploy — [W12], список доступных local tools — [W1]. Передавать `workspace_id` явно: комментарий schema обещает personal default, но handler при отсутствии ID может выбрать единственный team workspace или потребовать выбор при нескольких. **Нюанс единиц:** комментарий `healthcheck_timeout` в local schema говорит milliseconds, но docs/UI описывают seconds и `RAILWAY_HEALTHCHECK_TIMEOUT_SEC`; реализация передаёт поле дальше без преобразования. Не задавать числовой timeout через MCP наугад: сохранить default либо уточнить единицы фактической версии/API. [W3, W4, W8]

GitHub, local upload и registry — альтернативы платформы. При GitHub-источнике владелец должен заранее связать GitHub с Railway и предоставить GitHub App доступ к нужному public/private репозиторию; для организации могут понадобиться действия её владельца. MCP не выдаёт себе эти права. Если фактически подключён **старый/урезанный** MCP только с local deploy и без `connect_service_source`/`create_service`, первоначальную GitHub-привязку придётся выполнить вручную либо отдельно согласованным другим интерфейсом; local deploy её не заменяет. У текущего local MCP repo source уже есть, поэтому ручное создание service не безусловно обязательно. [W1–W4, W9, W10]

Public registry image поддерживается платформой и полем `source_image`; private registry требует **Pro**, в отличие от private GitHub source, которому нужен repo access, а не private-registry entitlement. Credentials для private registry в перечисленной schema `create_service` не предусмотрены. Выбор registry добавляет публикацию/доступы и не нужен для Dockerfile-пути. [W3, W9]

Railway не назначает публичный домен автоматически: его нужно сгенерировать. Достаточно одного `*.up.railway.app` с автоматическим SSL, без покупки домена/DNS. GitHub-linked service может обновляться по push; для autodeploy нужен хотя бы один участник проекта с connected GitHub и contributor access, а GitHub App должен иметь доступ к repo. Некоторые commits требуют ручного Deployment Approval; staged changes тоже не равны применённому deploy. [W9, W10, W13]

### Health checks Railway

HTTP GET по настроенному пути должен получить **любой `2xx`**; после этого новая версия становится active. Default deployment health timeout — **300 секунд**. Проверка использует `PORT`, hostname `healthcheck.railway.app`; `/api/health` не должен отвергать такой Host. Это **только deployment gate**, не continuous monitoring после публикации. Сбой зависшего приложения после успешного gate этим механизмом не обнаруживается; restart policy реагирует на остановку процесса, а не заменяет HTTP-мониторинг. [W8, W14]

## 4. Стоимость и ограничения демонстрации

| Критерий          | Render Free web service / Hobby workspace                                                                                                                                                                              | Railway Free и Trial                                                                                                                                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Бесплатность      | Compute `free` $0; workspace Hobby $0 отдельно от compute. Не 30-дневный web trial.                                                                                                                                    | Free $0 subscription и $1 credit/месяц без накопления. Trial: $5 однократно, до 30 дней или исчерпания; затем Free. Hobby **не бесплатный**: минимум $5/месяц + превышение usage.                                                                                           |
| Runtime           | 512 MB RAM, 0.1 CPU, один экземпляр.                                                                                                                                                                                   | Free: до 0.5 GB RAM, 1 vCPU, 1 replica; Trial: до 1 GB, 2 vCPU, 2 replicas. Docs уточняют, что максимумы включают умножение на replicas: это не обещание таких ресурсов каждой replica и не бесплатная reservation; trial CPU shared. Для in-memory проекта — одна replica. |
| Время/квоты       | 750 free instance hours на workspace в календарный месяц; sleep не расходует часы; исчерпание приостанавливает Free services до следующего месяца.                                                                     | Нет эквивалента обещанных 750 часов: credit расходуется по измеренному CPU/RAM/egress. Нельзя обещать месяц или даже длительность показа без остатка credit и измерений.                                                                                                    |
| Sleep/cold start  | Через 15 минут без входящего трафика; пробуждение HTTP/WebSocket, обычно около минуты. Render может произвольно restart Free.                                                                                          | Serverless — отдельная настройка, не универсальная гарантия Free. При включении отсутствие outbound packets приводит к sleep примерно через 5–10 минут; применяется к новому контейнеру после deploy. Cold request может получить 502; точная длительность не обещана.      |
| Builds            | На Hobby 500 standard pipeline minutes/месяц; bandwidth и builds общие для workspace. Runtime RAM не является обещанием RAM builder.                                                                                   | Service builds сейчас бесплатны (build CPU/RAM, base-image downloads, export/storage); это не отменяет technical build limits, image size и runtime billing. Free/Trial image limit 4 GB.                                                                                   |
| Трафик            | Hobby включает 5 GB outbound/месяц, затем $0.15/GB при наличии payment method; без него Free services приостанавливаются. Builds сверх quota оплачиваются либо блокируются без payment method/при spend limit.         | Egress $0.05/GB, RAM $10/GB-месяц, CPU $20/vCPU-месяц; расходуют credit. Free/Trial ephemeral storage 1 GB. Даже низкий idle RAM расходует бюджет.                                                                                                                          |
| Restart           | Continuous health restart; состояние памяти не сохраняется.                                                                                                                                                            | Default On Failure до 10 retries; Free/Trial не дают Always и ограничены 10 retries. Исчерпание бюджета/ограничения не лечится restart.                                                                                                                                     |
| Карта/верификация | Free docs описывают работу без payment method; это не обещание отсутствия anti-abuse/card gate для любого аккаунта. Добавление карты может вызвать возвращаемый $1 verification charge. Не добавлять её автоматически. | Trial официально доступен без карты; Full/Limited зависит от автоматической проверки, в том числе GitHub age/activity. Limited разрешает code deploy, но ограничивает outbound network/порты. Paid subscriptions требуют credit card; Hobby waiver не гарантирован.         |

Источники таблицы: Render pricing/free/compute [R5, R7, R11], Railway plans/trial/FAQ [W5–W7], Serverless/restart [W14, W15]. Не переносить ограничения free Postgres на наш web service: БД здесь вообще не нужна.

**Что не установлено:** текущий план и остаток квот владельца, прохождение anti-abuse/verification, фактический доступ к private repo, build CPU/RAM/time limits конкретной поставки Railway и успешность нашей сборки в них. На Railway текущая FAQ о stopped services ещё предлагает upgrade после исчерпания Trial, тогда как dedicated Trial page говорит о переходе в Free: переход тарифа не доказывает автоматическое сохранение работающего приложения. Проверить статус и доступный Free credit перед демонстрацией. [W6, W7]

Railway hard usage limit — не способ поставить безопасный «нулевой бюджет»: FAQ страницы указывает минимум **$10**, но та же страница задаёт отдельный Agent default $5 на Hobby / $20 на Pro. Нельзя переносить общий минимум на оба вида лимитов без уточнения. Compute limit останавливает workloads, Agent limit — агента; один не заменяет другой. Не включать paid plan ради лимита. Если бесплатный путь недоступен или credit недостаточен, решение принимает владелец: ждать квоты, уменьшать окно демонстрации, менять разрешённый путь либо отдельно одобрять деньги. Хостинг здесь не выбирается. [W11]

## 5. PORT, origin и SPA: условия, общие для обоих вариантов

1. Процесс должен действительно слушать `0.0.0.0`, а не loopback. `EXPOSE` — метаданные, не запуск listener и не публикация порта. Render default `PORT=10000`; Railway инжектирует `PORT`, но фиксированного универсального default рассмотренные docs не обещают. [R7, W8, W16, D1]
2. **Закрытый, уже принятый контракт проекта, не предложение:** само наличие `PORT` перекрывает `LISTEN_ADDR`; значение должно быть непустой строкой только десятичных цифр ASCII `0..9`, численно **1..65535**, без пробелов и знаков. Валидный `PORT` означает bind `0.0.0.0:<PORT>`; невалидный, включая пустой, — завершение с ненулевым кодом, без fallback. При отсутствии `PORT` сохраняется прежняя семантика `LISTEN_ADDR`, включая порт `:0`; native default `127.0.0.1:8080`, default образа `0.0.0.0:8080`. На исторической базе `67a46b0` Go читает только `LISTEN_ADDR`; это не утверждение о текущем `main`. Фиксированный override порта не предлагается как обход контракта. Не задавать `LISTEN_ADDR=0.0.0.0:$PORT` в ожидании shell expansion: `scratch` и exec entrypoint shell не запускают. [main.go на базе](../cmd/server/main.go), [Dockerfile](../Dockerfile), [D1]; согласованный контракт — условие задания исследования.
3. Provider HTTPS заканчивается на edge/load balancer; внутри контейнера достаточно HTTP. Браузер обращается к относительному `/api/` того же origin: не публиковать `localhost`, private DNS или отдельный API host в React build. [R7, W13]
4. Health path для плана — **`/api/health`**, который контейнерный Go действительно маршрутизирует в API. Legacy `/health` также имеет отдельную ветку, но не надо выбирать `/` или полагаться на SPA fallback. Обязателен прямой `200` с ожидаемым API body, не просто успешный TCP connect. [frontend.go](../internal/server/frontend.go), [README](../README.md)
5. Прямое открытие и refresh `/booking` и `/admin` должны отдавать React HTML, как требует [ADR](../docs/adr/0001-client-side-navigation.md). Fallback только для UI: `/api/*`, `/health`, существующие assets и ошибки отсутствующих assets не превращаются в `index.html`. Неизвестный UI URL должен показать React «Страница не найдена», не redirect на главную. Это правило production-процесса Go, а не настройка второго static-site service. Проверка отсутствующих assets нужна отдельно: один удачный `/booking` не доказывает корректность всех fallback-границ.

## 6. Известные предпосылки и неизвестные gates аккаунта

**Из официальных источников известно:** нужен аккаунт провайдера и подходящий workspace; MCP доступ и GitHub source access — разные разрешения. Для private GitHub repo требуется разрешённый репозиторий в GitHub App/integration; право агента читать hosting status не даёт права самостоятельно выдавать GitHub permissions или создавать услуги. Render различает бесплатный compute и workspace plan; Railway различает Free, Trial, paid, verification и private-registry entitlement. [R1, R5, R7, R12; W1, W5, W6, W9, W10]

**Только владелец может подтвердить перед будущей работой:**

- Какой workspace разрешён, какие права есть и доступен ли Free именно этому аккаунту; остатки hours/credit/build minutes/bandwidth и наличие платёжного способа — без раскрытия его реквизитов.
- Какой репозиторий/ветку разрешено публиковать; предоставлен ли hosting GitHub App доступ к нему; нужны ли одобрение организации, повторное принятие permissions или commit approval.
- Какой официальный MCP вариант и версия реально подключены; содержит ли живая schema нужные Docker/Free/read-only инструменты.
- Когда и сколько должна жить демонстрация, допустимы ли конкретные sleep/cold start и перерывы из-за квоты. Сброс памяти, публичный `/admin` и вымышленные контакты уже согласованы в карте; полная приёмка записи и отказа пересечений остаётся обязательной и здесь не выполнялась.
- Разрешены ли создание ровно одного service, health/domain/env mutations и последующие redeploy; нужны ли auto-deploy или только ручные обновления. Любые payment/card/upgrade действия — отдельное решение, не часть такого разрешения.

## 7. Безопасная последовательность и дальнейший lifecycle — только план

### Сначала read-only, после отдельного допуска к аккаунту

1. Не читая credential files и env values, получить фактический список MCP tools/schema и сравнить с отчётом. При нехватке нужной возможности остановиться, не подменять инструмент произвольным REST write.
2. Render: `list_workspaces` → человек подтверждает workspace → `list_services`/`get_service` → при наличии сервиса `list_deploys`/`get_deploy` → минимальные build/runtime logs. Railway hosted: `whoami`, `list-projects`, `list-services`; local дополнительно `list_workspaces`, `environment_status`, `list_deployments`, `list_domains`/`domain_status`, `get_logs` с явными ID. Не вызывать `railway-agent` как якобы read-only замену.
3. Не создавать ресурсы для проверки eligibility. Если plan/credit/quota не видны через доступный безопасный read-only интерфейс, запросить у владельца только несекретное подтверждение из Dashboard. Не выгружать переменные: для плана достаточно знать названия нужных новых значений. Логи могут содержать чувствительные данные — минимальный диапазон/число строк, не копировать их целиком в публичный отчёт. [R1, R4; W1, W3]

### Затем только после решения владельца и разрешения на изменения

1. Зафиксировать выбранный владельцем provider/path, точную ветку/commit, один экземпляр, регион, бесплатный план/credit, auto-deploy policy и окно показа. Dockerfile в корне позволяет обойтись без внешней registry publication.
2. До создания проверить выполнение уже принятого контракта `PORT` из §5 (в том числе invalid/absent и `LISTEN_ADDR=:0`) на выбранном для публикации commit; согласовать только действия с ресурсами: `FRONTEND_DIR`, health `/api/health`, provider domain. Render: отдельно разрешённый Dashboard/API шаг для health path либо проверенная alpha и одобренный Blueprint-план. Railway: source path должен поддерживаться конкретным MCP; GitHub разрешения выполняет владелец, не агент без допуска.
3. Создать один service; не считать tool return успешной публикацией. Отслеживать конкретный deploy ID и commit, build logs → runtime logs → health/deploy status. На Railway staged changes сначала review/accept; подтверждать единицы timeout перед override.
4. Получить HTTPS provider URL: Render из service details; Railway после отдельно разрешённого generate domain с target, совпадающим с портом listener/health. Проверить извне по критериям ниже.
5. Обновления: согласованный push при включённом autodeploy либо явный redeploy. Учитывать, что env update может сам запускать deploy; не повторять его вслепую. Записывать версию и повторять внешнюю проверку. При сбое читать статус/логи, не повышать тариф или ресурсы автоматически.
6. После показа согласовать сохранение/остановку/удаление и дату окончания, не выполнять cleanup без разрешения. Каждый restart/redeploy может очистить каталог. Rollback не является резервной копией памяти; источник образа/старого deploy должен оставаться доступен. [R2, R4, R8; W1, W5, W9]

### «Публично проверено и готово» — не «build зелёный»

- Из внешней сети/чистого браузера provider HTTPS URL открывается с валидным TLS, без hosting login и внутренних адресов.
- Конкретный deploy соответствует ожидаемому commit/source; runtime не завершился, health `/api/health` даёт прямой `200` и ожидаемый JSON, не HTML/redirect.
- `/`, прямые `/booking`, `/admin` и их refresh работают; React JS/CSS загружаются с корректными content types. Отсутствующий `/assets/missing.js` и неизвестный `/api/...` возвращают настоящие ошибки, не HTML с `200`; неизвестный UI URL показывает страницу ошибки по ADR.
- На `/admin` создаётся только тестовый тип встречи, на `/booking` он виден и выбирается слот; запросы идут на `/api/` того же HTTPS origin. Это hosting smoke, **не полная приёмка финального задания**: при приёмке дополнительно нужны создание записи гостем, её просмотр владельцем календаря и отказ пересекающейся записи, как требует карта. Эти сценарии не объявляются проверенными на исследуемой базе.
- В пределах разрешённого окна проверены повторные запросы, runtime errors/рестарты, а для sleep-плана — пробуждение после ожидаемого idle с документированной задержкой/возможным первым 502. Зафиксированы URL, время, версия, наблюдённый результат и ограничения; никакой keep-alive нагрузки для обхода Free sleep.
- Владелец знает остаток квоты/credit и срок доступности, публичность раздела владельца и сброс памяти. Только после этих наблюдений будущий исполнитель может писать «публично проверено»; этот отчёт этого **не утверждает**.

## Источники и ограничения доказательств

**Фактически перечитано 2026-11-14:** все перечисленные ниже R1–R13, W1–W16 и D1; для длинных R10, W12 и D1 — непосредственно относящиеся к выводам разделы, а не каждый раздел справочника. R2–R4, R13 и W3/W4/W12 прочитаны по raw URL на указанных immutable commits. W2 — rolling README официального пакета; W13/W16 включают обе перечисленные страницы. У `fixing-common-errors.md` получен 404, обычный URL W16 успешно вернул официальную страницу «Application Failed to Respond». Ни поисковые snippets, ни чужие обзоры не использовались.

**Историческое свидетельство отдельно от свежести:** source snapshots Render `16fe2e9…` и Railway `5a07ac2…` сохранены из отчёта 8 ноября и повторно прочитаны, но не объявляются latest release / deployed hosted build на 14 ноября. Отдельных неперепроверенных тарифных чисел из старого текста не оставлено. Rolling docs не имеют здесь архивной фиксации; дата означает день чтения, не дату обновления поставщиком. Наблюдение исходника не доказывает rollout, eligibility аккаунта или успешную сборку проекта. Перед реальным созданием вновь сверить тарифы, live `tools/list` и разрешения. Никакие hosting MCP, аккаунты, переменные, регистрации и платежи не проверялись; публикация отчёта и деплой не выполнялись.

**Дополнительная сверка оркестратором 2026-11-14:** публичный GitHub API показал HEAD Render `77c0d4eff4efb1170118399f2040e4daa4b9307e` (13 ноября) и Railway CLI `7da7f0d4dd6061656ed0b001c193945887ee645a` (release 5.74.0, 13 ноября). Повторное чтение Render service tools, Free enum и README подтвердило описанные Docker/Free/health/image границы и наличие Blueprint alpha; точечная сверка Railway params, project handlers и tarball deploy подтвердила перечисленные source/settings поля и расхождение единиц timeout. Это проверка указанных исходников, не всей версии и не живого MCP. [R14, W17]

Отчёт перенесён из `docs/research/` в корневой `research/` по соглашению уже опубликованного исследования подключения. Прежний файл был нашим неиндексированным артефактом, названным в progress-комментарии задачи; исходная версия сохранена вне репозитория. Это также оставляет файл вне игнорируемого форматтером `docs/**`, без изменения hooks/config. Выполнены ручная сверка документа и whitespace-проверки; полный check, зависимости, staging, commit и push не выполнялись.

### Render

- [R1: MCP overview, supported actions, limitations](https://render.com/docs/mcp-server).
- [R2: MCP service tools/schema/handlers, закреплённый source](https://github.com/render-oss/render-mcp-server/blob/16fe2e9977b0cf4837d6b68fe7f02f3cd85c4bd7/pkg/service/tools.go).
- [R3: явное включение Free в enum](https://github.com/render-oss/render-mcp-server/blob/16fe2e9977b0cf4837d6b68fe7f02f3cd85c4bd7/pkg/mcpserver/common.go).
- [R4: MCP README, включая deploy/log/event/Blueprint tools](https://github.com/render-oss/render-mcp-server/blob/16fe2e9977b0cf4837d6b68fe7f02f3cd85c4bd7/README.md).
- [R5: pricing, workspace/compute, bandwidth, pipeline, card verification](https://render.com/pricing).
- [R6: Dockerfile builds](https://render.com/docs/docker).
- [R7: web services, source options, PORT и HTTPS](https://render.com/docs/web-services).
- [R8: prebuilt image requirements и обновления](https://render.com/docs/deploying-an-image).
- [R9: health checks и failure timing](https://render.com/docs/health-checks).
- [R10: Blueprint spec](https://render.com/docs/blueprint-spec).
- [R11: Free limits, sleep, часы и suspension](https://render.com/docs/free).
- [R12: Git provider и GitHub App repository access](https://render.com/docs/git-provider).
- [R13: Blueprint tools/schema/approval, закреплённый source](https://github.com/render-oss/render-mcp-server/blob/16fe2e9977b0cf4837d6b68fe7f02f3cd85c4bd7/pkg/blueprint/tools.go).
- R14: [HEAD API](https://api.github.com/repos/render-oss/render-mcp-server/commits/77c0d4eff4efb1170118399f2040e4daa4b9307e), [service tools](https://github.com/render-oss/render-mcp-server/blob/77c0d4eff4efb1170118399f2040e4daa4b9307e/pkg/service/tools.go), [Free enum](https://github.com/render-oss/render-mcp-server/blob/77c0d4eff4efb1170118399f2040e4daa4b9307e/pkg/mcpserver/common.go), [README](https://github.com/render-oss/render-mcp-server/blob/77c0d4eff4efb1170118399f2040e4daa4b9307e/README.md).

### Railway и Docker

- [W1: актуальная hosted/local MCP документация](https://docs.railway.com/reference/mcp-server).
- [W2: официальный deprecated MCP package/shim](https://github.com/railwayapp/railway-mcp-server).
- [W3: local MCP parameter schemas, закреплённый CLI source](https://github.com/railwayapp/cli/blob/5a07ac2ae44ec2fcf892ba96e18f638402c7f8fb/src/commands/mcp/params.rs).
- [W4: create/connect/update implementations](https://github.com/railwayapp/cli/blob/5a07ac2ae44ec2fcf892ba96e18f638402c7f8fb/src/commands/mcp/tools/project.rs).
- [W5: Free/Hobby pricing, resource limits/rates, бесплатные builds](https://docs.railway.com/pricing/plans).
- [W6: Trial → Free, Full/Limited verification](https://docs.railway.com/pricing/free-trial).
- [W7: payment и stopped-service FAQ](https://docs.railway.com/pricing/faqs).
- [W8: health status, PORT, timeout и отсутствие continuous checks](https://docs.railway.com/deploy/healthchecks).
- [W9: service sources, GitHub App, private registry Pro, local upload, approvals](https://docs.railway.com/services).
- [W10: GitHub autodeploy permissions](https://docs.railway.com/deployments/github-autodeploys).
- [W11: compute/agent cost control и minimum hard limit](https://docs.railway.com/pricing/cost-control).
- [W12: MCP registration и tarball deploy handler](https://github.com/railwayapp/cli/blob/5a07ac2ae44ec2fcf892ba96e18f638402c7f8fb/src/commands/mcp/handler.rs).
- [W13: public networking](https://docs.railway.com/networking/public-networking), [provider domains/target ports](https://docs.railway.com/networking/domains/working-with-domains).
- [W14: restart policy и Free/Trial ограничения](https://docs.railway.com/deployments/restart-policy).
- [W15: Serverless sleep/cold boot](https://docs.railway.com/deployments/serverless).
- [W16: bind/PORT troubleshooting](https://docs.railway.com/guides/fixing-common-errors), [Dockerfile detection/path](https://docs.railway.com/deploy/dockerfiles).
- W17: [HEAD API/release](https://api.github.com/repos/railwayapp/cli/commits/7da7f0d4dd6061656ed0b001c193945887ee645a), [params](https://github.com/railwayapp/cli/blob/7da7f0d4dd6061656ed0b001c193945887ee645a/src/commands/mcp/params.rs), [project handlers](https://github.com/railwayapp/cli/blob/7da7f0d4dd6061656ed0b001c193945887ee645a/src/commands/mcp/tools/project.rs), [deploy handler](https://github.com/railwayapp/cli/blob/7da7f0d4dd6061656ed0b001c193945887ee645a/src/commands/mcp/handler.rs).
- [D1: Dockerfile EXPOSE и exec-form variable substitution](https://docs.docker.com/reference/dockerfile/#expose).
