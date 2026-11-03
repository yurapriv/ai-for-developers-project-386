# Go-бекенд и генерация сервера из OpenAPI

Дата среза: **2026-11-02**. Статус: исследование и предложение, не принятое архитектурное решение.

## Краткая рекомендация

**Go 1.27.3 + стандартный `net/http`/`ServeMux` + oapi-codegen v2.8.2**, генерация `models`, `std-http-server`, `strict-server`, `embedded-spec`. Это опубликованный, не beta-путь: генератор создаёт типы, интерфейс операций и регистрацию маршрутов; вручную остаются реализация операции и небольшой composition root HTTP-сервера. Gin и даже Chi для одного `/health` не нужны. Основание: [официальный пример std-http](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/docs/stdhttp-server.md), [strict server](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#strict-server), [релиз генератора](https://github.com/oapi-codegen/oapi-codegen/releases/tag/v2.8.2).

Для request validation добавить **nethttp-middleware v1.3.1**, для используемого generated runtime — **runtime v1.8.0**, для загрузки/проверки спецификации и response contract test — **kin-openapi v0.152.0**. **Strict-типы не заменяют runtime-валидацию схемы**, а request middleware не проверяет ответы. Эти версии образуют документированную связку, в том числе для устранения расхождения двух JSON-декодеров; сборка именно нашего будущего контракта ещё не проверена. Источники: [validation и совместимые версии](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#requestresponse-validation-middleware), [middleware go.mod](https://github.com/oapi-codegen/nethttp-middleware/blob/v1.3.1/go.mod).

Toolchain: выбранный пользователем **mise**, first-party `gofmt`/`go vet`/`go build`/`go test`; при подключении расширенного Go lint — **golangci-lint 2.15.0**, vulnerability gate — **govulncheck v1.9.0**. Один process+HTTP smoke рекомендую оставить в **`go test`**, не дублируя его в Vitest. Обоснование и ограничения ниже.

## Границы исследования

- Прочитаны `AGENTS.md`, `docs/agents/domain.md` выделенного worktree. Исходное состояние — scaffold без application/toolchain manifests. Исследование выполнено в ветке `research/scaffold-go`; единственное создаваемое содержимое — этот отчёт.
- Из задания, **не как заново проверенный здесь результат**: TypeSpec 1.17.0 → OpenAPI **3.0.0 YAML** → Hey API 0.99.0 TS Fetch SDK; Node 24.22.2/npm 11.19.1 — инструменты; React+Vite ещё не утверждены. Пользователь — iOS-разработчик, backend хочет попробовать на Go. Docker/UI library отложены; hk/pitchfork не утверждены.
- Проверялись HTTP metadata официальных релизов, Go module proxy, tagged README, исходники и документация владельцев инструментов. **Ничего не устанавливалось, генераторы, сервер, сборка, тесты и линтеры не запускались.** Нет заявления о «зелёном» запуске, binary compatibility или отсутствии уязвимостей. Нет app-кода, staging, коммитов, push или изменений Hexlet workflow.

## 1. Go: старт, платформы и pin

### Опубликованные версии на дату среза

Проверялся не предполагаемый график релизов: официальный download API возвращает `stable: true` для `go1.27.3` и `go1.26.10`; release history датирует оба patch-релиза **2026-10-19**. Предлагаю актуальную серию 1.27, а не старый Go 1.22 лишь потому, что тогда появился новый router. Поддерживаются две последние major-серии Go; 1.26.10 — допустимый fallback, но не второй обязательный compiler. Источники: [download metadata](https://go.dev/dl/?mode=json), [release history и support policy](https://go.dev/doc/devel/release).

| Компонент | Предлагаемый pin | Дата опубликования / первичный источник |
|---|---|---|
| Go compiler + stdlib/runtime | **1.27.3** | 2026-10-19, [официальная история](https://go.dev/doc/devel/release#go1.27), [дистрибутивы/checksums](https://go.dev/dl/?mode=json) |
| mise | **2026.10.25** | `published_at: 2026-10-31T10:24:21Z`, [release API](https://api.github.com/repos/jdx/mise/releases/tags/v2026.10.25) |
| oapi-codegen | **v2.8.2** | `published_at: 2026-10-31T21:34:53Z`, [release API](https://api.github.com/repos/oapi-codegen/oapi-codegen/releases/tags/v2.8.2) |
| oapi-codegen/runtime | **v1.8.0** | `published_at: 2026-10-23T06:28:43Z`, [release API](https://api.github.com/repos/oapi-codegen/runtime/releases/tags/v1.8.0) |
| nethttp-middleware | **v1.3.1** | `published_at: 2026-10-23T06:23:40Z`, [release API](https://api.github.com/repos/oapi-codegen/nethttp-middleware/releases/tags/v1.3.1) |
| kin-openapi | **v0.152.0** | `published_at: 2026-10-22T11:29:02Z`, [release API](https://api.github.com/repos/getkin/kin-openapi/releases/tags/v0.152.0) |
| golangci-lint | **2.15.0** | `published_at: 2026-10-16T11:33:37Z`, [release API](https://api.github.com/repos/golangci/golangci-lint/releases/tags/v2.15.0) |
| govulncheck, модуль golang.org/x/vuln | **v1.9.0** | `Time: 2026-10-11T03:39:53Z`, [официальный module proxy](https://proxy.golang.org/golang.org/x/vuln/@v/v1.9.0.info) |
| ogen, только сравнение | **v1.24.0** | `published_at: 2026-08-07T15:40:27Z`, [release API](https://api.github.com/repos/ogen-go/ogen/releases/tags/v1.24.0) |

`published_at` GitHub и `Time` Go proxy — разные поля: последнее отражает время version-control revision, не момент публикации release. Например, для oapi-codegen proxy сообщает `2026-10-31T21:24:05Z`; это не противоречит времени release десятью минутами позже. Источники: [proxy metadata](https://proxy.golang.org/github.com/oapi-codegen/oapi-codegen/v2/@v/v2.8.2.info), [протокол proxy](https://go.dev/ref/mod#goproxy-protocol).

### Что нужно на машине

- Go официально работает в PowerShell/cmd; getting started объясняет `go mod init`, `go.mod`, импорт пакетов, `go mod tidy`, `go run`. Для iOS-разработчика полезная аналогия: module — единица зависимостей, package — исходники одного каталога, `cmd/server` — исполняемая точка входа. Не требуется изучать отдельный web framework перед первым HTTP endpoint. Источники: [getting started](https://go.dev/doc/tutorial/getting-started), [module/package definitions](https://go.dev/ref/mod#modules-overview), [net/http](https://pkg.go.dev/net/http).
- Минимумы: **Windows 10 / Windows Server 2016**, на Linux для этой серии **kernel ≥3.2**; WSL1 не поддерживается, WSL2 возможен, но для native Windows не нужен. Дистрибутивы amd64/arm64 нужно выбирать по архитектуре машины. Go ≥1.25 требует Git ≥2.24 для операций, использующих Git; имеющийся Git 2.55 проходит этот минимум. Источники: [Minimum Requirements](https://go.dev/wiki/MinimumRequirements), [список архивов](https://go.dev/dl/?mode=json).
- Для pure-Go HTTP service достаточно compiler на этапе разработки/сборки и готового platform-specific executable при запуске. Go runtime входит в программу, это не отдельно устанавливаемая VM; Node нужен контрактным/TS-инструментам, не Go-бинарнику. C compiler понадобится при переходе к cgo, не для обязательного первого `/health`. Источники: [Go runtime/связывание](https://go.dev/doc/faq#runtime), [cgo requirements](https://go.dev/wiki/MinimumRequirements#cgo).
- `go test -race` **не делать обязательным первым Windows gate**: race detector требует cgo и C compiler; на Windows поддержан windows/amd64, есть требования к mingw-w64 runtime. Это отдельная будущая настройка, а не причина ставить Docker сейчас. Источник: [race detector requirements](https://go.dev/doc/articles/race_detector#Requirements).

### Как использовать выбранный mise

У mise есть встроенный **`core:go`**, устанавливающий официальные Go distributions с проверкой checksum; это отличается от **`go:` backend**, который через `go install` собирает отдельные Go CLI. Не нужен сторонний asdf plugin для compiler. Источники: [Go setup](https://mise.jdx.dev/lang/go.html), [Go registry pin](https://github.com/jdx/mise/blob/v2026.10.25/registry/go.toml), [go backend](https://mise.jdx.dev/dev-tools/backends/go.html).

Предлагаемый фрагмент будущего `mise.toml`, **не создан и не применён**:

```toml
[tools]
go = "1.27.3"
golangci-lint = "2.15.0"

[env]
GOTOOLCHAIN = "local"
```

Это exact pin, в отличие от `go = "1.27"`/`latest`. `GOTOOLCHAIN=local` не даёт Go молча скачать и переключить compiler поверх mise: несовместимая зависимость должна явно остановить проверку. У `go.mod` директива `go` — **минимум**, `toolchain` — предложенная toolchain, не strict lock; разумно для нового application module поставить `go 1.27.3`, не обещая поддержку старых compiler. Совпадающий `toolchain go1.27.3` может удаляться `go mod tidy`, отдельная `.go-version` не нужна. Источники: [mise version selection](https://github.com/jdx/mise/blob/v2026.10.25/docs/lang/go.md), [официальный Go toolchain selection](https://go.dev/doc/toolchain).

Registry `golangci-lint` выбирает `aqua:golangci/golangci-lint` перед asdf; можно зафиксировать полный backend вместо short name. Для команд/CI достаточно `mise exec -- …` и `mise run …`: shell activation не обязательна. На Windows не предполагать наличие `pwsh` 7, Bash, curl.exe, winget или Scoop. Официальная установка mise имеет manual ZIP и PowerShell **5.1+** путь; для точного pin удобнее ZIP v2026.10.25, проверка `Get-FileHash` по опубликованному `SHASUMS256.txt`, затем явный путь к `mise.exe`. Изменение PATH/profile — отдельный ручной шаг после согласования. Источники: [registry](https://github.com/jdx/mise/blob/v2026.10.25/registry/golangci-lint.toml), [install documentation на том же теге](https://github.com/jdx/mise/blob/v2026.10.25/docs/installing-mise.md), [release assets](https://api.github.com/repos/jdx/mise/releases/tags/v2026.10.25), [exec](https://mise.jdx.dev/cli/exec.html).

## 2. Генерация: std-http, strict, Chi, Gin

### Что именно генерировать

Рекомендуемый config будущего генератора (пути условные; config/app-файлы здесь не создаются):

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/oapi-codegen/oapi-codegen/v2.8.2/configuration-schema.json
package: api
generate:
  models: true
  std-http-server: true
  strict-server: true
  embedded-spec: true
allow-remote-refs-from: []
output: internal/api/server.gen.go
```

`strict-server` **дополняет**, а не заменяет `std-http-server`: создаёт request/response objects и `StrictServerInterface`; generated adapter превращает его в обычный `ServerInterface`. `HandlerFromMux`/`HandlerWithOptions` регистрируют маршруты в `http.NewServeMux()`. Общая схема будущей сборки: implementation → `NewStrictHandler` → generated `HandlerFromMux` → request validator → `http.Server`. Операция health должна попасть сюда, а не существовать параллельным вручную зарегистрированным route вне контракта. Источники: [strict config](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#strict-server), [std-http template](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/pkg/codegen/templates/stdhttp/std-http-handler.tmpl), [strict HTTP template](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/pkg/codegen/templates/strict/strict-http.tmpl).

Modern ServeMux умеет method-aware patterns (`GET /health`), wildcard path segments и приоритеты маршрутов; `GET` pattern также соответствует `HEAD`. Это возможности Go ≥1.22, но **текущий** oapi-codegen README обещает generated std-http code для **Go ≥1.24**, сам generator требует ≥1.25. Заголовок отдельного std-http guide «Go 1.22+» нельзя выдавать за актуальный минимум всей цепочки. Наш pin 1.27.3 выше этих требований. Источники: [ServeMux docs](https://pkg.go.dev/net/http#ServeMux), [актуальная supported servers matrix](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#supported-servers), [generator go.mod](https://proxy.golang.org/github.com/oapi-codegen/oapi-codegen/v2/@v/v2.8.2.mod), [runtime go.mod](https://github.com/oapi-codegen/runtime/blob/v1.8.0/go.mod).

**«Swagger» нужно уточнять.** В v2.8.2 `embedded-spec` даёт `GetSpec()`/`GetSpecJSON()`; старое `GetSwagger()` сохранено, но deprecated. Это загрузчик встроенной OpenAPI specification, **не HTTP handler Swagger UI и не автоматически опубликованный `/swagger`**. Для проверки контракта достаточно встроенной спецификации; интерактивную документацию можно добавить отдельно, без второго источника API. Исходник: [generated std-http example, GetSpec/GetSwagger](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/internal/test/servers/strict/stdhttp/server.gen.go).

Для одного локального контракта лучше запретить remote refs (`allow-remote-refs-from: []`), не добавлять import-mapping/overlays/custom templates. На линии 2.8 remote refs по умолчанию ещё разрешены (`"*"`); релиз v2.8.2 исправляет security issues именно при генерации из недоверенных спецификаций. Источники: [remote references policy](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#remote-references), [security release](https://github.com/oapi-codegen/oapi-codegen/releases/tag/v2.8.2).

### Почему не Chi или Gin

| Вариант | Что меняется | Вывод для scaffold |
|---|---|---|
| std-http | Стандартный router, стандартные `http.Handler`/middleware | **Начать с него**; изучаем Go HTTP, а не framework API. |
| Chi (`chi-server`) | Дополнительный router, остаётся net/http-compatible; strict и nethttp validator поддержаны | Рассмотреть при реальной потребности в route groups/mounting/экосистеме middleware, не ради health. |
| Gin (`gin-server`) | Framework API, свой middleware adapter, дополнительная dependency поверхность | Не нужен; server generation не требует Gin. |

Поддержка вариантов подтверждена [матрицей генератора](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#supported-servers); свойства Chi — [first-party README](https://github.com/go-chi/chi#readme). Выбор минимального std-http — рекомендация для этого задания, не утверждение, что другие варианты плохи.

## 3. OAS 3.0 / 3.1: не повторять устаревшее ограничение

**oapi-codegen v2.8.2 уже поддерживает OpenAPI 3.1.** Tagged README перечисляет webhooks, `type: [T, "null"]`, enum через `oneOf`+`const`; исходники содержат version-aware schema handling. Поэтому историческое «oapi-codegen не поддерживает 3.1 из-за kin-openapi» на дату среза неверно. Источники: [FAQ на опубликованном теге](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#does-oapi-codegen-support-openapi-31), [schema implementation](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/pkg/codegen/schema.go), [kin-openapi v0.152.0 targets](https://github.com/getkin/kin-openapi/blob/v0.152.0/README.md).

Но «поддерживает 3.1» **не означает** полный перенос любой JSON Schema 2020-12 в статические Go-типы или полную runtime validation без middleware. Сам проект обещает поддержку настолько, насколько позволяет Go type system. Есть общие ограничения: implicit `additionalProperties` игнорируются генератором, optional+nullable pointer по умолчанию не различает missing и null (для этого есть opt-in nullable wrapper). Источники: [key design decisions](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#key-design-decisions), [additional properties](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#additional-properties-additionalproperties), [nullable](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#generating-nullable-types). Не проверялись все keywords/dialects: для сложных unions, nullability и новых JSON Schema keywords нужен отдельный fixture generation+contract test, а не обещание полной совместимости.

**Оставить уже выбранный OAS 3.0.0**: health не получает выигрыша от смены dialect, оба consumer-а получают один и тот же YAML. В 3.0 фиксированное значение `status: "ok"` выражается `type: string` + `enum: [ok]`, поле включается в `required`; не использовать `const` из 3.1. Если нужна строго форма «только status», явно договориться об `additionalProperties: false`, а не рассчитывать на Go struct. Основание семантики: [OAS 3.0 Schema Object](https://spec.openapis.org/oas/v3.0.0#schema-object).

### ogen как запасной кандидат

**ogen v1.24.0** — реальная опубликованная альтернатива, не beta server emitter. Он генерирует типизированные server/client, decoding/encoding, validators и static radix router. Это может убрать отдельную request validation middleware-связку; генерируемая JSON-логика использует go-faster/jx. Источники: [release](https://github.com/ogen-go/ogen/releases/tag/v1.24.0), [tagged features](https://github.com/ogen-go/ogen/blob/v1.24.0/README.md#features), [generated project layout](https://ogen.dev/docs/intro).

**Не выбираю его по умолчанию**: нам нужен обычный современный ServeMux, читаемый минимальный Go starter, а не ещё одна модель router/optional wrappers и множество generated files. В README ogen есть собственные ограничения nullable arrays; надпись OpenAPI v3 не является доказательством полного 3.1/JSON Schema conformance. Его Go module также несёт runtime/helper dependencies, включая собственные packages, jx, errors и telemetry: «generated» не равно «zero dependency». Источники: [features и ограничения](https://github.com/ogen-go/ogen/blob/v1.24.0/README.md), [go.mod](https://github.com/ogen-go/ogen/blob/v1.24.0/go.mod). Вернуться к сравнению можно, если separate validation glue окажется главным неудобством; тогда проверить один и тот же контракт в обоих генераторах. Здесь этого эксперимента не было.

## 4. Runtime validation и тест контракта

### Три разных вида гарантий

1. **Go compile-time types:** strict server ограничивает варианты ответа/статус/media type, избавляет handler от ручной сериализации. Строковый enum в Go всё ещё можно привести к произвольной строке; ограничения вроде minLength/pattern не становятся автоматически полной проверкой. Источник: [generated code и validation notice](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#requestresponse-validation-middleware).
2. **Входящий HTTP:** `nethttp-middleware` оборачивает handler и вызывает kin-openapi `ValidateRequest` по тому же OAS. В том числе проверяет заявленные параметры/body/security requirements; реальную authentication function при появлении security всё равно пишет приложение. Источники: [middleware implementation](https://github.com/oapi-codegen/nethttp-middleware/blob/v1.3.1/oapi_validate.go), [security integration](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#implementing-security).
3. **Исходящий HTTP:** в штатном middleware oapi-codegen нет response validation. Для scaffold предпочтительнее OAS-aware contract test, не самописный production response-buffering proxy. kin-openapi предоставляет `ValidateResponse`; проверяем status, headers/media type и body по той же спецификации. Источники: [middleware limitation](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#requestresponse-validation-middleware), [ValidateResponse source](https://github.com/getkin/kin-openapi/blob/v0.152.0/openapi3filter/validate_response.go).

В contract test важно включить **`IncludeResponseStatus: true`**: по умолчанию `ValidateResponse` может разрешить неописанный status. У него также есть deliberate skips для HEAD и ряда redirects; это не универсальная проверка всех HTTP-ответов. Поэтому smoke должен явно ожидать **200** и JSON для `GET /health`, а не только `err == nil`. Источник: [код ValidateResponse](https://github.com/getkin/kin-openapi/blob/v0.152.0/openapi3filter/validate_response.go).

### Важные limits middleware

- `nethttp-middleware` реализован поверх kin-openapi и **внутреннего gorilla/mux router для сопоставления OAS routes**, даже если HTTP application использует ServeMux. Не обещать нулевые сторонние runtime dependencies. Проверка servers/Host может отклонить localhost, если OAS содержит другой server URL; осознанно использовать relative/no servers для локального контракта либо `DoNotValidateServers` только в validator configuration. Источники: [implementation/options](https://github.com/oapi-codegen/nethttp-middleware/blob/v1.3.1/oapi_validate.go), [dependency manifest](https://github.com/oapi-codegen/nethttp-middleware/blob/v1.3.1/go.mod).
- **Сохранять validated value**: middleware v1.3.1 включает `KeepValidatedValue` по умолчанию, runtime v1.8.0 даёт `BindJSONBody`, и strict template v2.8.2 его использует. Это закрывает известное расхождение: validator проверил `role`, а case-insensitive второй decode выбрал `ROLE`. Не включать `DiscardValidatedValue` и не заменять request body после validator без понимания последствий. Цена — удержание decoded JSON до конца запроса; без validated value binder может вернуться к обычному decoder. Источники: [middleware release](https://github.com/oapi-codegen/nethttp-middleware/releases/tag/v1.3.1), [runtime release](https://github.com/oapi-codegen/runtime/releases/tag/v1.8.0), [strict template](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/pkg/codegen/templates/strict/strict-http.tmpl).
- Schema validation не задаёт сетевые timeouts/лимит памяти и не проверяет бизнес-инварианты календаря. В будущем composition root должен задать server `ReadHeaderTimeout`, разумные read/write/idle limits и `MaxBytesReader` **до** body validation; конкретные значения выбрать по будущим операциям. `/health` не требует body, БД или framework. Источники: [http.Server](https://pkg.go.dev/net/http#Server), [MaxBytesReader](https://pkg.go.dev/net/http#MaxBytesReader).
- Generated defaults при ошибках используют `http.Error` (обычно text/plain), а не автоматически контрактный JSON error envelope. Если контракт начнёт обещать JSON 400/500, нужны согласованные error handlers и response tests; security/business ошибки не появятся сами из codegen. Источники: [strict errors](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/pkg/codegen/templates/strict/strict-http.tmpl), [middleware error handlers](https://github.com/oapi-codegen/nethttp-middleware/blob/v1.3.1/oapi_validate.go).

### Один smoke, один runner

Предлагаемый **единственный process+HTTP smoke — в Go `testing`**:

1. Собрать настоящий `cmd/server` один раз во временный каталог теста; запустить **сам бинарник**, не долгоживущий `go run` wrapper. Передать локальный listen address, по возможности `127.0.0.1:0` с надёжной передачей выбранного адреса тесту; фиксированный порт создаёт гонки. Иметь deadline/readiness polling, захват stderr, `t.Cleanup`, завершение и `Wait` дочернего процесса также при падении теста.
2. Выполнить реальный `GET /health`, явно проверить 200 и JSON Content-Type; response проверить `ValidateResponse` по исходному generated OAS с `IncludeResponseStatus: true`. Поле `status`/enum/required читаются из OAS, не из второй вручную написанной Zod/JSON schema.
3. Отдельным коротким negative subtest того же contract helper показать, что неверное значение/отсутствующее поле отвергается. Это проверка работоспособности gate, а не второй запуск серверного smoke другим runner.

Это проектное предложение на базе first-party [testing](https://pkg.go.dev/testing), [os/exec CommandContext](https://pkg.go.dev/os/exec#CommandContext), [net.Listen](https://pkg.go.dev/net#Listen), [response validator](https://github.com/getkin/kin-openapi/blob/v0.152.0/openapi3filter/validate_response.go). Реализации теста пока нет. `httptest` полезен для будущих handler/integration tests, но **не заменяет проверку старта отдельного процесса** ([httptest](https://pkg.go.dev/net/http/httptest)).

Если frontend примет Vitest, оставить ему TS/UI tests, а не копию Go smoke. Таким образом `go test ./...` действительно исполняет хотя бы один тест Go-сервиса даже без бизнес-логики, Vitest — тесты своего стека. Не добавлять ещё node:test, shell HTTP probe и Playwright ради одного и того же health. Это граница ответственности тестов, не запрет на будущий настоящий browser e2e.

## 5. Dependencies: генератор — не runtime приложения

| Модуль | Что подтверждено manifest-ом | Следствие |
|---|---|---|
| oapi-codegen v2.8.2 | `go 1.25.0`; kin-openapi **v0.142.0**, x/tools v0.48.0, x/mod v0.38.0, x/text v0.40.0 и другие generator deps | Не переносить весь require-блок генератора в зависимости сервера. [Module proxy go.mod](https://proxy.golang.org/github.com/oapi-codegen/oapi-codegen/v2/@v/v2.8.2.mod). |
| runtime v1.8.0 | `go 1.24.0`; root module содержит также зависимости других server adapters, uuid, jsonmerge, nullable | Наличие Gin/Echo/Iris в module graph не означает, что они используются/линкуются std-http binary. Проверять package imports и actual graph после генерации. [go.mod](https://github.com/oapi-codegen/runtime/blob/v1.8.0/go.mod). |
| nethttp-middleware v1.3.1 | `go 1.25.0`; kin-openapi **v0.152.0**, indirect gorilla/mux v1.8.1, jsonpointer v1.0.0, x/text v0.40.0 | Это runtime dependency, не только dev tool. [go.mod](https://github.com/oapi-codegen/nethttp-middleware/blob/v1.3.1/go.mod). |
| kin-openapi v0.152.0 | `go 1.25`; парсер, schema/filter/router helper dependencies | Нужен при embedded spec, middleware и OAS-aware тестах; pre-v1 обновления могут ломать API. [go.mod](https://proxy.golang.org/github.com/getkin/kin-openapi/@v/v0.152.0.mod), [предупреждение oapi-codegen](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#ive-just-updated-my-version-of-kin-openapi-and-now-i-cant-build-my-code-). |

Точный набор imports минимального health ещё неизвестен: без body/parameters часть runtime helpers может не понадобиться; `embedded-spec` уже добавляет kin-openapi. Не утверждать заранее, что любая комбинация flags обязательно импортирует все runtime packages. Источники: [std-http generated minimal example](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/examples/minimal-server/stdhttp/api/ping.gen.go), [strict generated example](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/internal/test/servers/strict/stdhttp/server.gen.go).

### Способ pinning генератора

**Предпочтение для первого scaffold: `go run …@v2.8.2` в mise task.** Так generator работает со своим module graph, отдельно от более нового kin-openapi middleware. Версия видна в task; глобально установленный `oapi-codegen` в PATH не нужен. Пример будущей команды, **не выполнено**:

```powershell
mise exec -- go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.8.2 -config oapi-codegen.yaml api/openapi.yaml
```

`go run package@version` игнорирует текущий go.mod для выбора generator graph и не добавляет generator dependencies в application go.sum. Checksums проверяет Go module infrastructure; это не offline/vendor решение. Источники: [go run semantics](https://pkg.go.dev/cmd/go#hdr-Compile_and_run_Go_program), [checksum database](https://go.dev/ref/mod#authenticating).

**Официально рекомендуемый oapi-codegen альтернативный путь:** `go get -tool github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.8.2`, затем `go tool oapi-codegen`. Go ≥1.24 записывает `tool` + versioned `require` в go.mod, checksums — в go.sum. Однако tools и приложение в одном module делят dependency graph, и minimum version selection может повысить generator dependency с kin-openapi 0.142 до 0.152. Это не изоляция devDependencies наподобие npm. Если этот путь будет выбран, надо проверить generator+middleware совместно или вынести tools в отдельный module; сейчас лишний tools module не предлагаю. Источники: [официальная рекомендация установки](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#installing), [tool directive](https://go.dev/ref/mod#go-mod-file-tool), [MVS](https://go.dev/ref/mod#minimal-version-selection).

`go install …@v2.8.2` допустим, но глобальный/неявный executable хуже читается и может устареть независимо от проекта; `@latest` недопустим для воспроизводимой task. У mise `go install` binaries по умолчанию привязаны к выбранному Go install directory, если GOBIN не переопределён; смена compiler влияет на их доступность. Источники: [installation options](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#installation), [mise GOBIN](https://mise.jdx.dev/lang/go.html#binaries-from-go-install).

Для приложения нужны **go.mod + go.sum**, поддерживаемые Go tooling после генерации и добавления реальных импортов. `go.sum` — checksum records, **не lockfile, выбирающий версии**: там возможны несколько версий, выбор задаёт module graph/MVS. В будущих проверках — `go mod tidy -diff`, `go mod verify`, review `go list -m all`/`go list -deps ./...`; не писать go.sum вручную и не обещать финальный graph до запуска resolver. Источники: [go.sum](https://go.dev/ref/mod#go-sum-files), [go commands](https://pkg.go.dev/cmd/go).

## 6. Guardrails: актуальная подборка и first-party checks

Старый `mokevnin/dev-guardrails` реально перенаправляется в **mokevnin/dev-quality-gates**. На момент проверки `main` — именно **829848c77853988cee6683b0d3bfe4904181be95**, commit date **2026-11-01T18:19:32Z**. Источники: [redirect API](https://api.github.com/repos/mokevnin/dev-guardrails), [snapshot API](https://api.github.com/repos/mokevnin/dev-quality-gates/commits/829848c77853988cee6683b0d3bfe4904181be95).

В Go-разделе snapshot рекомендует **golangci-lint**, **govulncheck**, **go-arch-lint**. В TS-разделе — **Oxlint + oxfmt**, не переносить старую рекомендацию ESLint/Prettier. Принцип подборки — выбирать относящиеся к проекту gates, не устанавливать весь список. Здесь не принимается решение о TS tooling, hooks или CI. Источник: [README зафиксированного snapshot](https://github.com/mokevnin/dev-quality-gates/blob/829848c77853988cee6683b0d3bfe4904181be95/README.md).

| Gate | Минимальное предложение для Go | Почему/ограничение |
|---|---|---|
| Format | `gofmt` из выбранного compiler; CI check должен проваливаться при отличиях | `gofmt -l` перечисляет файлы, но сам факт отличий не следует считать автоматическим non-zero gate; wrapper должен проверить output. [gofmt source](https://github.com/golang/go/blob/go1.27.3/src/cmd/gofmt/gofmt.go). |
| Static checks | `go vet ./...` | First-party анализ подозрительных конструкций. `go test` запускает лишь избранное подмножество vet, поэтому это не полная замена. [go test/vet](https://pkg.go.dev/cmd/go#hdr-Test_packages). |
| Compile | `go build ./...` | Проверяет компиляцию application packages; не доказывает, что процесс стартует/HTTP соответствует OAS. [go build](https://pkg.go.dev/cmd/go#hdr-Compile_packages_and_dependencies). |
| Go test | `go test -count=1 ./...` | Один настоящий process+HTTP contract smoke; `-count=1` избегает результата из test cache при приёмочной проверке. [go test](https://pkg.go.dev/cmd/go#hdr-Test_packages). |
| Extended lint | golangci-lint **2.15.0** | Один runner вместо отдельных Staticcheck/errcheck/gosec binaries; не включать все правила на пустом проекте. [curated Go research](https://github.com/mokevnin/dev-quality-gates/blob/829848c77853988cee6683b0d3bfe4904181be95/research/stack-go-rust-jvm-dotnet.md), [upstream config](https://github.com/golangci/golangci-lint/blob/v2.15.0/.golangci.reference.yml). |
| Vulnerabilities | govulncheck **v1.9.0**, text mode | First-party symbol/call analysis; JSON/SARIF/OpenVEX modes сами по себе возвращают 0 даже при найденных уязвимостях. Не путать scan report с gate. [официальный cmd doc](https://github.com/golang/vuln/blob/v1.9.0/cmd/govulncheck/doc.go). |
| Generation drift | Повторить TypeSpec → OAS → Go + TS SDK, проверить отсутствие незапланированного diff | Единственный source of truth — TypeSpec; generated Go/OAS/SDK не править вручную. [рекомендация oapi-codegen о generated code](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#should-i-commit-the-generated-code). |

**Не добавлять go-arch-lint сейчас:** нет слоёв/компонентов для архитектурных правил. Не ставить standalone gofumpt/gci/Staticcheck поверх golangci-lint ради дублирующих задач. Если нужна объединённая format gate, выбрать `gofmt` formatter в golangci-lint и `golangci-lint fmt --diff`: в исходниках 2.15.0 diff выставляет exit code 1. Это альтернатива отдельному format-check wrapper, не необходимость гонять оба. Рекомендация подборки gofumpt+gci строже базового Go style, её можно принять позже осознанно. Источники: [curated Go notes](https://github.com/mokevnin/dev-quality-gates/blob/829848c77853988cee6683b0d3bfe4904181be95/research/stack-go-rust-jvm-dotnet.md), [formatter settings](https://github.com/golangci/golangci-lint/blob/v2.15.0/.golangci.reference.yml), [fmt exit implementation](https://github.com/golangci/golangci-lint/blob/v2.15.0/pkg/goformat/runner.go).

### Критичная совместимость golangci-lint ↔ Go

Нельзя взять новый Go и старый linter только потому, что linter binary запускается. Upstream поддерживает Go не новее compiler, которым собран golangci-lint; дополнительно analyzers должны понимать новую версию Go. Поддержка **go1.27 появилась в golangci-lint 2.13.0**, выбранный **2.15.0** её включает; его release workflow задаёт **Go 1.27.0**, go.mod — минимум **1.26.0**. Patch 1.27.3 остаётся в поддержанной language series. После установки всё равно проверить фактический `golangci-lint version`/build info, не делать вывод из одной строки minimum go.mod. Источники: [support FAQ](https://golangci-lint.run/docs/welcome/faq/), [changelog](https://golangci-lint.run/docs/product/changelog/#2130), [release workflow на теге](https://github.com/golangci/golangci-lint/blob/v2.15.0/.github/workflows/release.yml), [go.mod](https://github.com/golangci/golangci-lint/blob/v2.15.0/go.mod).

Native Windows не исключён: опубликован **golangci-lint-2.15.0-windows-amd64.zip** и checksums; release config содержит Windows/Linux targets. Для воспроизводимости предпочесть release binary через mise/aqua, не случайную локальную пересборку linter старым Go. govulncheck v1.9.0 объявляет `go 1.26.0`, наш compiler выше этого минимума; CLI можно закрепить через `go:` backend или `go run …@v1.9.0`, но не `@latest`. Источники: [Windows assets API](https://api.github.com/repos/golangci/golangci-lint/releases/tags/v2.15.0), [release config](https://github.com/golangci/golangci-lint/blob/v2.15.0/.goreleaser.yml), [vuln module metadata](https://proxy.golang.org/golang.org/x/vuln/@v/v1.9.0.mod), [mise go backend](https://mise.jdx.dev/dev-tools/backends/go.html).

## 7. План будущей ручной установки и приёмки — не выполнялся

1. **Согласовать предложение:** Go backend, generated strict std-http, shared OAS 3.0, validation, один Go process smoke, выбранные gates. UI library/Docker/hk/pitchfork не добавлять автоматически. Уточнить module path и будущие каталоги (`cmd/server`, `internal/api` — предложения, не уже существующие файлы).
2. **Вручную поставить mise 2026.10.25** из официального Windows ZIP, сверить SHA-256; после этого подготовить exact project pins Go 1.27.3 и при принятии lint golangci-lint 2.15.0. Проверить `mise --version`, `mise exec -- go version`, `go env GOTOOLCHAIN GOOS GOARCH`, `golangci-lint version` через mise. Не нужен shell profile для `mise exec`. Источники: [mise installation](https://github.com/jdx/mise/blob/v2026.10.25/docs/installing-mise.md), [Go version setup](https://mise.jdx.dev/lang/go.html).
3. **Создать application module и контракт:** TypeSpec определяет `GET /health`, operationId `getHealth`, 200 `application/json`, required `status` с enum `ok`; emit OAS 3.0.0 YAML один раз для обоих генераторов. `go mod init <согласованный-module-path>`, generator config и pinned generation task — следующий implementation step, не часть этого исследования. Для OAS shape — [Schema Object](https://spec.openapis.org/oas/v3.0.0#schema-object), для Go module — [getting started](https://go.dev/doc/tutorial/getting-started).
4. **Прогнать генерацию и resolver:** `go run …oapi-codegen@v2.8.2`, TS SDK generator из ранее исследованной цепочки; реализовать только generated strict interface и small HTTP bootstrap. Добавить необходимые runtime requirements с pins таблицы, выполнить `go mod tidy`, посмотреть go.mod/go.sum/imports. `GetSpec()` загрузить и провалидировать при старте; generated health route должен быть в основном ServeMux. Источники: [generator config](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/README.md#usage), [GetSpec](https://github.com/oapi-codegen/oapi-codegen/blob/v2.8.2/internal/test/servers/strict/stdhttp/server.gen.go), [openapi3 Validate](https://pkg.go.dev/github.com/getkin/kin-openapi/openapi3#T.Validate).
5. **Запуск при ручной проверке:** после появления кода `mise exec -- go run ./cmd/server` либо собранный binary; отдельное окно PowerShell с `Invoke-WebRequest -UseBasicParsing` для визуальной проверки. Это диагностическая команда, не ещё один CI smoke. В автоматическом smoke запускать готовый executable с cleanup, как описано выше. Источники: [go run](https://pkg.go.dev/cmd/go#hdr-Compile_and_run_Go_program), [CommandContext](https://pkg.go.dev/os/exec#CommandContext).
6. **Приёмочные gates:** generation drift, format check, `go mod tidy -diff`, `go mod verify`, `go vet ./...`, `go build ./...`, `go test -count=1 ./...`, принятый golangci-lint gate и text `govulncheck`. Будущие mise tasks должны явно передавать exit codes: в PowerShell 5.1 native non-zero не является автоматически terminating exception; не использовать Bash-only syntax или `&&` как в PowerShell 7. Для Windows task можно задать `shell = "powershell -NoProfile -Command"`/`run_windows`; кроссплатформенные direct commands предпочтительнее сложных shell pipelines. Источники: [mise task config](https://github.com/jdx/mise/blob/v2026.10.25/docs/tasks/task-configuration.md), [PowerShell native exit status](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_automatic_variables?view=powershell-5.1#lastexitcode), [Go command reference](https://pkg.go.dev/cmd/go).
7. **Проверить доказательность gates:** неправильно отформатированный временный fixture должен провалить format check; неправильный response fixture — contract check; ошибка запуска/timeout — process smoke. После восстановления fixtures повторить проверки Windows и отдельно Linux, не изменяя защищённый `.github/workflows/hexlet-check.yml`. Это будущая проверка, не полученный здесь результат.

## Итог и открытые риски

Выбранная рекомендация не требует Go framework: **Go 1.27.3 + oapi-codegen 2.8.2 strict std-http** соответствует желанию попробовать простой Go backend и требованию server generation. **OpenAPI 3.0.0 достаточно; OpenAPI 3.1 уже поддержан, но полной JSON Schema/codegen equivalence мы не доказали.** Схема остаётся одна; middleware проверяет requests, OAS-aware Go smoke — реальный response. Dependencies, JSON binding nuances, formatter exit codes и linter/Go compatibility нельзя скрывать за словом «generated».

Не разрешены исследованием и остаются открытыми: фактическая сборка этой комбинации, итоговый dependency graph, generation конкретного TypeSpec output, поведение middleware вместе с ServeMux (включая HEAD/405), Windows process cleanup, Linux parity и future frontend integration. Проверено **по документации/metadata/исходникам**, не исполнением. Установка, app implementation, staging/commits и публикация ветки требуют отдельного одобренного плана.
