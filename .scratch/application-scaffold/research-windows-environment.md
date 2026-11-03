# Воспроизводимое окружение: native Windows и Ubuntu CI

Дата исследования: **2026-11-02**. Метод: официальная документация, GitHub Releases/API и исходники опубликованных тегов. Это **docs-only**, не результат установки или smoke-теста. Ветки исходников `main` не использованы как доказательство наличия функций в выбранном релизе.

Рабочая область исследования: `C:\Users\prive\AppData\Local\Temp\opencode\scaffold-windows-research`, ветка `research/scaffold-windows`. Создан только этот отчёт; staging, commit, push, установка, изменение PATH/профилей/Git config и запуск серверов не выполнялись.

## Краткий ответ

**Native Windows — допустимый основной вариант**, а не обязательный переход на WSL: mise, hk и pitchfork публикуют Windows-бинарники. Рекомендуется начать с mise и явных задач; hk устанавливать отдельно на клон после согласования; управление frontend/backend сначала оставить двум терминалам, затем при необходимости включить экспериментальные mise daemons с закреплённым pitchfork. WSL2 — альтернативный Linux-путь для POSIX-зависимостей, а не условие работоспособности этих инструментов. Поддержка бинарника не доказывает переносимость выбранного приложения, линтеров и команд. [Релизы mise](https://github.com/jdx/mise/releases/tag/v2026.10.25), [hk](https://github.com/jdx/hk/releases/tag/v2.11.0), [pitchfork](https://github.com/jdx/pitchfork/releases/tag/v2.33.0), [backends mise](https://mise.jdx.dev/dev-tools/backends/).

| Компонент/возможность | Native Windows | WSL2 / Ubuntu CI | Существенное ограничение |
| --- | --- | --- | --- |
| mise 2026.10.25 | Windows x64, ARM64 | Linux x64, ARM64 и другие сборки | `asdf:` backend недоступен на Windows; проверять платформу каждого tool |
| mise tasks и env | Да; inline shell по умолчанию `cmd /c` | Да; Unix shell | PowerShell терминала не становится автоматически shell задачи |
| hk 2.11.0 | Windows MSVC x64, ARM64 | Linux GNU/musl x64, ARM64 | Некоторые builtins требуют POSIX shell; линтеры устанавливаются отдельно |
| Pkl для hk 2.11.0 | Встроенный pklr | Встроенный pklr | Внешние Pkl CLI/JVM не нужны для evaluator; собственные шаги могут требовать runtimes |
| pitchfork 2.33.0 | Windows MSVC x64, ARM64 | Linux GNU x64, ARM64 | Windows: нет Unix user switching и PTY; сигналы имеют другие семантики |
| mise daemons | Да, experimental; ручные start/stop | Да, experimental | Базовый минимум pitchfork 2.25.0; task daemon — 2.28.0 |
| Daemon auto-start/stop при `cd` | Не заявлен для PowerShell; нужны Bash/Zsh/Fish | Bash/Zsh/Fish после activation | Нужен глобальный experimental и заранее установленный pitchfork |

Источники таблицы: [mise install](https://mise.jdx.dev/installing-mise.html), [task reference](https://mise.jdx.dev/tasks/task-configuration.html), [hk Windows/configuration](https://github.com/jdx/hk/blob/v2.11.0/docs/configuration.md#shell-commands-on-windows), [hk evaluator](https://github.com/jdx/hk/blob/v2.11.0/docs/pkl_introduction.md#evaluators), [pitchfork configuration](https://github.com/jdx/pitchfork/blob/v2.33.0/docs/reference/configuration.md), [daemons](https://github.com/jdx/mise/blob/v2026.10.25/docs/daemons.md).

## Исходные данные и границы

Переданные результаты отдельной read-only проверки: Windows PowerShell Desktop **5.1.26100.9711**, Git **2.55.0.windows.3** доступны; `node/npm/pnpm/mise/hk/pitchfork/gh/docker` не найдены в PATH; `wsl.exe --version` сообщил, что WSL не установлен. Эти данные здесь не перепроверялись. **«Не найден в PATH» не означает «на компьютере нет файлов/инсталляции»**. Наличие winget, архитектура CPU, сетевые политики, ExecutionPolicy, виртуализация и права администратора не установлены. Версию Node, стек и пакетный менеджер выбирает другое исследование.

Репозиторий пока scaffold. Защищённый `.github/workflows/hexlet-check.yml` запускает `hexlet/project-action@release` на `ubuntu-latest` при push веток/тегов и требует `HEXLET_ID`. Его нельзя редактировать, удалять или переименовывать; будущий собственный CI должен быть **отдельным workflow**. Источники внутри репозитория: [AGENTS.md](../../AGENTS.md), [workflow](../../.github/workflows/hexlet-check.yml), [правила workflow](../../.github/workflows/README.md).

## Проверенные опубликованные версии

GitHub API `releases/latest` на дату исследования вернул следующие stable-релизы (`draft=false`, `prerelease=false`). Ниже реальные опубликованные pins, а не номера из примеров документации:

| Инструмент | Предлагаемый pin для первоначальной проверки | Публикация UTC | Проверенные артефакты |
| --- | --- | --- | --- |
| mise | `2026.10.25` | 2026-10-31 10:24:21 | `mise-v2026.10.25-windows-x64.zip`, `windows-arm64.zip`, Linux-сборки, `SHASUMS256.txt` |
| hk | `2.11.0` | 2026-11-01 10:29:40 | `hk-x86_64-pc-windows-msvc.zip`, ARM64, Linux GNU/musl, пакет `hk@2.11.0` |
| pitchfork | `2.33.0` | 2026-11-01 10:33:29 | `pitchfork-x86_64-pc-windows-msvc.zip`, ARM64, Linux GNU |

Источники: [mise release API](https://api.github.com/repos/jdx/mise/releases/latest), [фиксированный релиз mise](https://github.com/jdx/mise/releases/tag/v2026.10.25); [hk API](https://api.github.com/repos/jdx/hk/releases/latest), [фиксированный hk](https://github.com/jdx/hk/releases/tag/v2.11.0); [pitchfork API](https://api.github.com/repos/jdx/pitchfork/releases/latest), [фиксированный pitchfork](https://github.com/jdx/pitchfork/releases/tag/v2.33.0). `latest` изменяем; для последующей проверки использовать ссылки на теги. Это предложение baseline, не утверждение об испытанной совместимости всей комбинации.

## mise: платформы, shell, env и cwd

- Windows поддержан официально; рекомендованный установочный канал — winget, есть самостоятельный PowerShell installer и ручной ZIP. Installer требует **PowerShell 5.1+**, не POSIX shell, проверяет checksum, устанавливает в пользовательский `~\.local\bin` и меняет user PATH без admin. Ручной ZIP содержит **оба** `mise.exe` и `mise-shim.exe`: держать их рядом. Установка mise через npm здесь не решает bootstrap, поскольку доступность Node/npm ещё не обеспечена. [Установка](https://github.com/jdx/mise/blob/v2026.10.25/docs/installing-mise.md#windows).
- Backend `asdf:` не работает на native Windows; наличие инструмента в registry не гарантирует артефакт конкретной версии для OS/CPU. Для hk/pitchfork registry этого тега предпочитает встроенный `packslip:` backend, а не `cargo install`; установка Rust не является обязательным условием этого пути. [Backends](https://mise.jdx.dev/dev-tools/backends/), [hk registry](https://github.com/jdx/mise/blob/v2026.10.25/registry/hk.toml), [pitchfork registry](https://github.com/jdx/mise/blob/v2026.10.25/registry/pitchfork.toml).
- **Shell задачи не равен shell терминала**: default inline и fallback file shell Windows — `cmd /c`. Для отдельной задачи есть `shell`, для проекта — `[task_config].shell`, для Windows-реализации — `run_windows`. `.ps1` file tasks используют `pwsh`, поэтому нельзя предполагать, что имеющегося `powershell.exe` 5.1 достаточно для произвольных `.ps1` tasks: либо явно задать interpreter `powershell -NoProfile -Command` для inline, либо согласованно установить PowerShell 7, либо не использовать такие file tasks. [Settings исходники](https://github.com/jdx/mise/blob/v2026.10.25/settings.toml), [task configuration](https://github.com/jdx/mise/blob/v2026.10.25/docs/tasks/task-configuration.md), [file tasks](https://mise.jdx.dev/tasks/file-tasks.html#windows).
- По умолчанию задача работает от **config root**, а не от каталога вызова; `dir = "backend"` / `"frontend"` задавать явно при разделении каталогов. Исходный каталог доступен как `MISE_ORIGINAL_CWD`; `dir = "{{ cwd }}"` нужен только при намеренном поведении «от каталога пользователя». [Task reference: dir](https://mise.jdx.dev/tasks/task-configuration.html#dir).
- `[env]` применяется к `mise exec`, `mise run`, shims и activated shell. Использовать TOML env вместо Unix `VAR=value command` и вместо строк `%VAR%`/`$env:VAR`, если нужна общая команда. `_.file = ".env"` загружает dotenv относительно config root; отсутствующий файл допускается. `_.path` управляет PATH без ручного склеивания `:`/`;`. Локальные секреты не коммитить; общий `.env.example` не должен содержать настоящие credentials. `_.source` исполняет Bash даже при другом shebang и на Windows требует Git Bash/MSYS2, поэтому для простых значений предпочтительнее dotenv. [Env](https://mise.jdx.dev/environments/).
- Activation необязательна для задач/CI: `mise exec` и `mise run` сами готовят окружение. В PowerShell 5.1 activation обновляет env **на следующем prompt**, а не сразу после `cd`: команда на той же строке может увидеть прежние tools. PowerShell 7 устраняет именно это ограничение, но не добавляет daemon auto lifecycle в PowerShell. [Shell setup опубликованного тега](https://github.com/jdx/mise/blob/v2026.10.25/docs/shell-setup.md#powershell), [daemons shell requirements](https://mise.jdx.dev/daemons.html#automatic-start-and-stop).

### Install hooks — три разных механизма

Не смешивать `[hooks].postinstall` mise, tool `postinstall` и `hk install`:

1. `[hooks].preinstall/postinstall` запускаются при установке tools, **без activation**; cwd — корень проекта. `mise install` вызывает project `postinstall` даже если tools уже установлены. Hook failure документирован как warning с продолжением остальных hooks; такой hook не следует считать достаточной fail-fast гарантией setup. [Hooks](https://github.com/jdx/mise/blob/v2026.10.25/docs/hooks.md#install-hooks-preinstall-postinstall-hook).
2. Tool-level `postinstall` выполняется после установки конкретного tool; флаг `--no-hooks` не отключает этот tool option. [Hooks: disable](https://mise.jdx.dev/hooks.html#disable-hooks).
3. `hk install --mise` регистрирует Git hooks локально, меняя состояние клона. Делать это явным шагом `setup:hooks` после review конфигурации; не запускать автоматически в CI и не менять user-global Git config без отдельного согласия. Это рекомендация проекта: upstream допускает и рекомендует global scope. [hk installation](https://hk.jdx.dev/getting_started.html#install-hooks).

Предложение: отдельная обязательная задача `setup` с проверяемым exit code устанавливает зависимости и валидирует конфигурацию; `setup:hooks` вызывается отдельно. Не помещать запуск dev-серверов, обновление lockfiles или привилегированные установки в project postinstall. Причины — повторяемый запуск hook, предупреждения вместо обязательного отказа и код из доверенной конфигурации. [Hooks](https://mise.jdx.dev/hooks.html), [configuration trust](https://mise.jdx.dev/security.html#configuration-trust).

## hk: Pkl, дополнительные runtimes и fallback

**Для hk 2.11.0 внешний `pkl` не нужен.** Встроен pklr; loader всегда выбирает его. Внешний Pkl CLI — не runtime dependency и не fallback evaluator; `HK_PKL_BACKEND` с иным значением отклоняется. Также в hk v2 удалены TOML/YAML/JSON project configurations: Windows fallback нельзя строить на выдуманном `hk.toml`. [Evaluator docs](https://github.com/jdx/hk/blob/v2.11.0/docs/pkl_introduction.md#evaluators), [реальный loader](https://github.com/jdx/hk/blob/v2.11.0/src/config.rs), [Cargo dependency pklr](https://github.com/jdx/hk/blob/v2.11.0/Cargo.toml).

Предсобранный hk не требует установки Rust/Cargo/JVM ради Pkl. Но **builtins не устанавливают линтеры**: выбранный ESLint, Python-линтер и т. п. требуют своих tools/runtimes; builtin `pkl`, если его сознательно выбрать для проверки Pkl-файлов, — отдельная потребность в CLI, не evaluator hk. Встроенные `trailing_whitespace`/`newlines` используют `hk util` без дополнительных линтеров. [Getting started](https://hk.jdx.dev/getting_started.html), [Windows builtin exceptions](https://github.com/jdx/hk/blob/v2.11.0/docs/configuration.md#shell-commands-on-windows).

`hk.pkl` должен закреплять schema и Builtins на одной версии, например `package://github.com/jdx/hk/releases/download/v2.11.0/hk@2.11.0#/Config.pkl` и соответствующий `Builtins.pkl`. Обновление binary само не меняет эти imports. Встроенный evaluator содержит пакет своей версии; другие imports могут потребовать сеть/cache, для offline есть `HK_PKL_OFFLINE`. [Pkl essentials](https://hk.jdx.dev/pkl_introduction.html).

На Windows string commands hk используют `cmd.exe`, на Unix — POSIX shell. POSIX builtins требуют явного `shell = "sh -o errexit -c"` и найденного Git for Windows `sh.exe`; доступность `git.exe` сама по себе **не подтверждает**, что `sh` доступен через PATH. Есть structured `Command { argv = List(...) }` без shell: это предпочтительно для переносимых имён файлов с пробелами и метасимволами, если executable можно запустить непосредственно. `dir`/`env` остаются доступны. Не навязывать POSIX shell всем steps: `shell` несовместим со structured Command. [Configuration Windows/argv](https://github.com/jdx/hk/blob/v2.11.0/docs/configuration.md), [shell parsing/quoting](https://github.com/jdx/hk/blob/v2.11.0/src/step/shell.rs).

Имеющийся Git 2.55 удовлетворяет документированному порогу **2.54+** для configuration-based hooks; в таком случае hk не обязан писать shell shims. Для ограниченного scope использовать после согласования `mise exec -- hk install --mise`. Local launcher требует mise в runtime PATH Git; GUI Git не наследует activation автоматически. Upstream global launcher (`hk install --global --mise`) сохраняет путь mise и лучше переживает GUI PATH, но затрагивает user Git config всех репозиториев — здесь **не выполнялся и не предлагается как скрытый setup**. [hk mise integration](https://hk.jdx.dev/mise_integration.html), [install reference](https://hk.jdx.dev/cli/install.html).

### Native fallback без hk

Если hk откладывается, оставить те же `mise run check` / `mise run test` и вызывать их вручную и в CI. Для текущего Git официально доступны локальные named hooks; схема возможного bootstrap (не выполнялась):

```text
git config --local hook.scaffold-check.event pre-commit
git config --local hook.scaffold-check.command "mise run check"
```

Это **проектное предложение на официальном механизме Git**, не функция hk и не полноценный эквивалент hk: нет его file selection, stash/restore и обработки partial commits. Проверки должны быть read-only; не использовать без review для автоформатирования незастейдженных файлов. Существующие hooks сначала исследовать, не перезаписывать; не устанавливать fallback параллельно с hk, иначе проверки могут дублироваться. Для старого Git возможен conventional `.git/hooks/pre-commit` с `#!/bin/sh`, LF и `exec mise run check` через Git for Windows, но не предполагается автоматическое выполнение просто файла `pre-commit.ps1`. [Git 2.55 named hook config](https://github.com/git/git/blob/v2.55.0/Documentation/config/hook.adoc), [Git hooks, cwd и bypass](https://git-scm.com/docs/githooks), [hk stashing](https://hk.jdx.dev/hooks.html).

## pitchfork / mise daemons: что действительно поддержано

В mise daemon declarations экспериментальны: нужен `[settings] experimental = true` либо `MISE_EXPERIMENTAL=1`. Нужен project config; safe mode не допускает обычный запуск. mise при start/register/restart и задачах с `daemons` может установить pitchfork автоматически — **версию из `[tools]`, иначе latest**. Поэтому pitchfork надо явно закрепить, а не полагаться на скрытый latest. Базовый минимум **2.25.0**, daemon `task = "..."` — **2.28.0**, корректная остановка PostgreSQL Windows — **2.29.0**, deferred env/vars в `run` — **2.30.0**. Предлагаемый 2.33.0 покрывает эти минимумы. [Daemons тега mise](https://github.com/jdx/mise/blob/v2026.10.25/docs/daemons.md), [runtime capability checks](https://github.com/jdx/mise/blob/v2026.10.25/crates/mise-daemons/src/runtime.rs), [experimental gate](https://github.com/jdx/mise/blob/v2026.10.25/crates/mise-daemons/src/lib.rs).

Windows custom `run` и `init` используют **`cmd /C`**: Unix `exec`, `export`, `$PORT` не переносимы. Не копировать `run = "exec ..."` из POSIX-примеров. `task` daemon **без init** запускает mise task напрямую без промежуточного shell; сама task затем использует свой настроенный shell. Аргументы передаются массивом без дополнительной shell-интерпретации. Это удобная общая граница между native Windows и Linux. [Windows/task daemons](https://mise.jdx.dev/daemons.html#windows), [pitchfork shell исходники](https://github.com/jdx/pitchfork/blob/v2.33.0/src/shell.rs).

Прямой pitchfork также умеет argv `run`, но на Windows имя без расширения ищется как `.exe`; `.cmd/.bat` требуют cmd, для npm пример — `npm.cmd`, а не Unix `npm`. Поэтому отсутствие shell не означает одинаковые имена launchers пакетных менеджеров. Предпочесть `task` daemon и скрыть OS-разницу внутри обычной mise task. [pitchfork run reference](https://github.com/jdx/pitchfork/blob/v2.33.0/docs/reference/configuration.md#run-required).

Другие ограничения, важные для dev-процессов:

- `[tasks.*].daemons` ждёт readiness, но **не останавливает** daemons после task; они продолжают жить до явного stop. Порты/HTTP/command probes задаются явно. Task daemon не использует собственное task `daemons` повторно: зависимости сервисов задавать daemon `depends`, не циклом task → тот же daemon. [Daemons guide](https://mise.jdx.dev/daemons.html).
- Окружение mise берётся из toolset проекта, commands выполняются в проектном контексте; direct pitchfork имеет собственные `dir`, `env`, `env_file` с путями относительно project root. Чтобы не дублировать cwd/env, для приложения задавать их на mise task. После изменения env/config выполнять явный restart; не предполагать, что живой процесс сам получит новый env. [mise glue](https://github.com/jdx/mise/blob/v2026.10.25/src/daemons/glue.rs), [pitchfork env/cwd](https://pitchfork.jdx.dev/reference/configuration).
- Windows: `user` и `pty=true` приводят к ошибке запуска, а не эмулируются. При `stop_signal = "SIGINT"` pitchfork пробует Ctrl+C и затем завершает дерево по timeout; другие сигналы ведут к немедленной остановке дерева. Foreground supervisor с общей консолью не посылает Ctrl+C. Job objects покрывают большинство дочерних процессов, но документированы исключения для MSYS/Cygwin и breakaway-процессов. **Нужен отдельный smoke-тест отсутствия сирот**, особенно если запуск идёт через shell/package manager. [Windows stop/user/PTY](https://github.com/jdx/pitchfork/blob/v2.33.0/docs/reference/configuration.md).
- mise shell auto lifecycle поддерживает Bash/Zsh/Fish, требует global experimental и уже установленного pitchfork. PowerShell 5.1/7 сюда не входит. На Windows можно рассмотреть Git Bash, но это уже дополнительный POSIX-слой и его процессные ограничения. Для PowerShell оставить ручные start/stop. [Automatic start/stop](https://mise.jdx.dev/daemons.html#automatic-start-and-stop).
- Нельзя считать все service presets переносимыми: Redis preset **без Windows build**, shared-server providers **не доступны Windows**. PostgreSQL нельзя запускать elevated; другие presets используют cmd, alternative `windows_shell` для них не поддержан. Контейнерный путь потребует отдельно Docker/Podman; для простых frontend/backend pitchfork сам Docker не требует. [Preset Windows constraints](https://github.com/jdx/mise/blob/v2026.10.25/docs/daemons/presets.md#windows), [containers](https://mise.jdx.dev/daemons/containers.html).
- У pitchfork **есть Windows login autostart**, в отличие от boot-on-system-start macOS/Linux. `pitchfork boot enable` пишет HKLM при доступе, иначе HKCU; изменение существующей HKLM регистрации может требовать elevation. На installation overview встречается обобщение про Unix-specific boot integrations: более конкретная CLI-документация и Windows implementation подтверждают login path. Для scaffold autostart не нужен; не включать его автоматически. [boot enable](https://pitchfork.jdx.dev/cli/boot/enable.html), [Windows implementation 2.33.0](https://github.com/jdx/pitchfork/blob/v2.33.0/src/boot_manager/windows.rs).

### Предлагаемое управление frontend/backend

Сначала определить обычные задачи `dev:frontend`, `dev:backend` (cwd на каждую папку, tools/env общие). Реальные команды зависят от ещё не выбранного стека. **Без experiment** запускать `mise run dev:backend` и `mise run dev:frontend` в двух терминалах; останавливать Ctrl+C. Не использовать shell `&`, PowerShell `Start-Process` или Unix `nohup` как общий интерфейс supervisor. Это рекомендация, основанная на переносимом task API. [Tasks](https://mise.jdx.dev/tasks/).

При необходимости background lifecycle следующий фрагмент станет дополнением к будущему `mise.toml`; это **не готовая конфигурация приложения**, пока отсутствуют task definitions и согласованные порты:

```toml
[settings]
experimental = true

[tools]
hk = "2.11.0"
pitchfork = "2.33.0"

[daemons.backend]
task = "dev:backend"
ready_port = 3000
stop_signal = "SIGINT"

[daemons.frontend]
task = "dev:frontend"
ready_port = 5173
stop_signal = "SIGINT"
```

Числа 3000/5173 — **иллюстрация**, не выбор framework или обещание свободного порта. Не ставить `init` с установкой dependencies на каждый restart: mise запускает init при каждом старте/перезапуске, включая автоматический. Readiness frontend/backend и необходимость `depends = ["backend"]` определяются приложением, а не наличием двух процессов. [Task daemon/init](https://mise.jdx.dev/daemons.html#daemons-that-run-a-task).

После создания конфигурации общий интерфейс PowerShell/Bash/CI:

```text
mise daemons start backend frontend
mise daemons ls
mise daemons logs backend frontend
mise daemons restart backend frontend
mise daemons stop backend frontend
```

Вызов start ждёт readiness и повторно использует уже работающие daemons; закрытие вызывающего терминала не заменяет stop. При изменении профиля `MISE_ENV` сначала останавливать daemons прежнего профиля: одновременно один профиль проекта. [Manage daemons](https://mise.jdx.dev/daemons.html#manage-daemons).

## Вариант A — native Windows, рекомендуемый первый путь

Все нижеследующие установки и изменения — **будущие действия человека после согласования**, не сделанные исследователем.

1. Уточнить CPU/права и уже существующие установки вне PATH; выбрать **один** источник mise. Для точного baseline скачать ZIP релиза 2026.10.25 нужной архитектуры и проверить `Get-FileHash -Algorithm SHA256` по опубликованному `SHASUMS256.txt`; подпись checksum проверять отдельным verifier при его наличии. Распаковать пару mise binaries в пользовательский каталог и добавить его в user PATH. Альтернатива — reviewed PowerShell installer с `$env:MISE_VERSION = 'v2026.10.25'`; winget возможен только если действительно доступен и нужная версия есть в его manifest. Не запускать слепой `irm | iex` автоматически. [Official install options](https://mise.jdx.dev/installing-mise.html#windows).
2. Перезапустить терминал после PATH update. Проверить ожидаемую версию mise и `mise doctor`. Для начала **не менять PowerShell profile**, работать через `mise run`/`mise exec`. PowerShell 7 опционален, пока tasks не требуют `pwsh`; PowerShell 5.1 достаточен для официального installer и явных команд. [Installation verification](https://mise.jdx.dev/installing-mise.html#verify-the-executable), [shell setup](https://mise.jdx.dev/shell-setup.html#powershell).
3. После появления reviewable project config доверить его, установить locked tools; Node/package-manager pin согласовать с отдельным исследованием. Установка предсобранных hk/pitchfork через mise не требует дополнительного Cargo/Rust bootstrap. POSIX Bash устанавливать/настраивать только для реально выбранных steps, а не «на всякий случай». [Trust](https://mise.jdx.dev/security.html#configuration-trust), [registry](https://github.com/jdx/mise/blob/v2026.10.25/registry/hk.toml).
4. Явно установить dependencies выбранным менеджером из его lockfile, скопировать пример env средствами выбранной оболочки, отдельно зарегистрировать local Git hooks. Для ручной копии команда PowerShell `Copy-Item .env.example .env`, Bash `cp .env.example .env`; это намеренное исключение из общего CLI, не универсальная shell-команда. [Env directives](https://mise.jdx.dev/environments/), [hk integration](https://hk.jdx.dev/mise_integration.html).
5. Начать dev в двух терминалах; optional daemons включить только после проверки start/readiness/restart/stop без orphan-процессов. Ни WSL, ни Docker, ни gh не обязательны для этого базового пути. Не запускать dev supervisor elevated; не включать login autostart/firewall rules без отдельного согласия. [pitchfork installation](https://pitchfork.jdx.dev/installation), [Windows constraints](https://mise.jdx.dev/daemons/presets.html#windows).

Потенциально привилегированные/ручные шаги: системный package manager может вызвать UAC, корпоративные политики могут ограничивать запуск скачанного binary или profile scripts, прослушивание сетевого интерфейса может потребовать согласованного правила firewall. Наличие таких ограничений **не проверялось**; user-local mise install сам по себе admin не требует. Не изменять ExecutionPolicy/Defender/Firewall ради обхода без разрешения. [mise installer scope](https://mise.jdx.dev/installing-mise.html#windows-script).

## Вариант B — WSL2 с Ubuntu

1. Человек согласует установку WSL и дистрибутива. Microsoft требует Windows 10 build 19041+ / Windows 11; документированный начальный путь — PowerShell **administrator**, `wsl --install`, затем restart. Для воспроизводимого выбора дистрибутива сначала смотреть `wsl --list --online`, затем `wsl --install -d <DistroName>`; **не придумывать** доступный идентификатор/версию Ubuntu. Новые установки используют WSL2; может понадобиться включение виртуализации/Virtual Machine Platform по инструкции. Первый запуск требует создать Linux user/password. Здесь это не выполнялось. [WSL install](https://learn.microsoft.com/en-us/windows/wsl/install), [manual prerequisites](https://learn.microsoft.com/en-us/windows/wsl/install-manual).
2. Внутри Ubuntu установить Linux Git и необходимые `curl`, CA certificates, инструменты извлечения; apt операции требуют Linux `sudo`. mise установить пользователю из того же официального релиза 2026.10.25, а не использовать Windows `mise.exe`; installer можно закрепить через `MISE_VERSION`, для повышенной воспроизводимости сохранить/checksum-проверить installer опубликованного тега. Runtime/tools затем устанавливать из общего `mise.toml`/`mise.lock` для Linux. [mise Linux install](https://mise.jdx.dev/installing-mise.html), [CI bootstrap prerequisites](https://mise.jdx.dev/continuous-integration.html#bootstrapping).
3. Держать **отдельный Linux checkout** под `/home/<user>/...`, не запускать Linux dependencies в существующем Windows checkout через `/mnt/c`. Это рекомендация Microsoft ради производительности/файловых семантик. Не делить `node_modules`, compiled binaries и Git hook launchers между Windows и Linux. Различия case sensitivity всё равно проверять в Ubuntu CI. [WSL filesystems](https://learn.microsoft.com/en-us/windows/wsl/filesystems).
4. Linux hooks устанавливаются локально отдельно. Можно добавить Bash activation и global experimental для daemon auto lifecycle, но для простоты оставить те же явные commands, что в native варианте. Не включать systemd/login boot только ради двух dev-процессов. WSL ближе к Linux CI по shell, но не идентичен GitHub runner по kernel, packages и network. [mise shell hook](https://mise.jdx.dev/daemons.html#automatic-start-and-stop), [GitHub runner environment](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

Преимущество: POSIX steps без native обходов, Linux tools/presets. Цена: установка WSL, restart, отдельные credentials/config/dependencies и storage, Linux sudo; версии Ubuntu packages и WSL нельзя вывести из Windows PATH. Docker не является обязательной частью WSL-варианта и не устанавливается автоматически предлагаемой схемой. [WSL install](https://learn.microsoft.com/en-us/windows/wsl/install), [pitchfork installation prerequisites](https://pitchfork.jdx.dev/installation).

## Воспроизводимость tools и Ubuntu CI

**Одинаковые tool versions — не bit-for-bit одинаковая машина.** Рекомендуемый контракт:

1. Exact tool pins в `mise.toml`; `mise.lock` с URLs/checksums для обеих платформ; application dependency lockfile отдельно. Для x64 Windows + Ubuntu runner x64 команда подготовки — `mise lock --platform windows-x64,linux-x64`; если разработчик ARM64, добавить соответствующий `windows-arm64`/`linux-arm64`, а не предполагать x64 по версии PowerShell. `mise lock` не устанавливает tools; после review lockfile общий install — `mise install --locked`. Lockfile coverage зависит от backend; language package runtimes/builds могут иметь отдельные неполностью закреплённые входы. [Lockfile platforms/backend support](https://mise.jdx.dev/dev-tools/mise-lock.html).
2. Закрепить bootstrap mise отдельно: CI `version: 2026.10.25` или generated wrapper с `--version 2026.10.25`. `min_version` задаёт нижний порог, **не exact pin**. Shared wrapper `mise generate install-script --localize --write --windows --version 2026.10.25` возможен после установки mise: пишет `bin/mise` и `bin/mise.cmd`; Windows вызывает `.\bin\mise.cmd`, Unix `./bin/mise`. Это официальный вариант, но scripts нужно отдельно review и протестировать, не созданные этим исследованием. [Continuous integration/wrappers](https://mise.jdx.dev/continuous-integration.html).
3. Отдельный workflow на явном `ubuntu-24.04` уменьшает риск незаметной смены дистрибутива `ubuntu-latest`. Hosted image всё равно обновляется; для герметичности понадобятся контролируемый образ/digest и OS dependencies — это **не обеспечено одним mise.lock**. Hosted runner labels и изменяемые images описаны GitHub. [Runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
4. Не полагаться на globally installed Node/npm в runner; не делать `mise upgrade`/`mise lock --bump` частью test job. Dependencies устанавливать в frozen/immutable режиме выбранного package manager, затем обычные `mise run check`, `mise run test`, `mise run build`; имена задач ниже — будущий интерфейс, сейчас задач нет. hk в CI запускать `mise exec -- hk check --all`, не `hk run pre-commit`, поскольку pre-commit может stash/fix/stage. [mise CI](https://mise.jdx.dev/continuous-integration.html), [hk CI](https://hk.jdx.dev/ci.html), [hk check/fix](https://hk.jdx.dev/getting_started.html#checking-and-fixing-code).
5. Для первого CI прогона отключить install cache; восстановленные installed trees не проверяются заново по lockfile. При необходимости кешировать только checksummed downloads и разделять ключи OS/CPU/lockfile. Не давать secrets недоверенным PR; CI mise автоматически доверяет конфигурации, safe mode подходит для безопасного разрешения версий, но **не запуска тестов/tasks**. [Cache trust и CI](https://mise.jdx.dev/continuous-integration.html), [lockfile trust limits](https://mise.jdx.dev/dev-tools/mise-lock.html#restored-caches).

Пример **будущего отдельного** workflow; package-dependency install должен быть добавлен после выбора стека, иначе этот пример неполон. SHA upstream tags проверены GitHub API на дату отчёта:

```yaml
name: scaffold-ci
on: [push, pull_request]
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: jdx/mise-action@6612f0ef07ed2a736cd1e00a94a065522dd41195 # v5
        with:
          version: 2026.10.25
          cache: false
          install_args: --locked
      # Здесь обязательна frozen-install команда зависимостей приложения.
      - run: mise exec -- hk check --all
      - run: mise run test
      - run: mise run build
```

Источники pins/inputs: [checkout tag API](https://api.github.com/repos/actions/checkout/git/ref/tags/v7), [mise-action tag API](https://api.github.com/repos/jdx/mise-action/git/ref/tags/v5), [зафиксированный action.yml](https://github.com/jdx/mise-action/blob/6612f0ef07ed2a736cd1e00a94a065522dd41195/action.yml). При использовании daemon declarations в CI учесть `experimental` action input/environment; в базовом check/build workflow фоновые сервисы **вообще не требуются**, если тесты этого не требуют.

Для интеграционных тестов запускать только нужные сервисы, ждать readiness, а stop делать отдельным CI cleanup step с `if: always()`; task `depends_post` не покрывает все ситуации, когда prerequisite не запустил основной task. Не превращать frontend dev-server в обязательный prerequisite обычного build. После выбора app/API health endpoint можно заменить port readiness на HTTP probe. [Task ordering](https://mise.jdx.dev/tasks/task-configuration.html#depends-post), [daemon readiness](https://mise.jdx.dev/daemons.html).

## Общие команды и план последующей проверки

После установки mise и появления согласованной конфигурации следующие команды одинаково пишутся в PowerShell 5.1 и Bash, без activation, Unix env assignment и shell background operators:

```text
mise --version
mise doctor
mise trust
mise install --locked
mise exec -- hk --version
mise exec -- hk validate
mise exec -- hk check --all
mise run setup
mise run check
mise run test
mise run build
```

`trust` — только после чтения config/tasks, не автоматическое «согласие со всем». `setup` обязан использовать выбранный package manager lockfile и не менять OS/user config. Отдельно и только при согласии: `mise exec -- hk install --mise`. [Trust](https://mise.jdx.dev/security.html#configuration-trust), [locked install](https://mise.jdx.dev/dev-tools/mise-lock.html), [hk validation](https://hk.jdx.dev/pkl_introduction.html#validate-and-inspect).

Что ещё необходимо **исполнить отдельной согласованной работой**, а не считать доказанным:

- Чистая установка обоих platform lock entries и application deps; работа из каталога с пробелами, вызов task из подкаталога, одинаковые cwd/env.
- hk validate/check и реальный Git hook в CLI/GUI; частично staged файл без потери unstaged work; отсутствие дублирования hooks; local launcher находит mise.
- Dev frontend/backend: start дважды, readiness, изменение файлов, restart, graceful stop и отсутствие оставшихся listening ports/дочерних процессов на Windows.
- Ubuntu cold-cache CI проходит те же check/test/build; Windows line endings и регистр имён не ломают Linux. Для доказательства native support желательно отдельный Windows smoke job, не только Ubuntu.

**Итоговая рекомендация:** не навязывать WSL и не отвергать hk/pitchfork по устаревшим ограничениям. Зафиксировать проверенные версии tools, выбрать переносимый task/env/cwd контракт и local hooks, держать daemons опциональным экспериментальным удобством. WSL2 выбирать при реальной POSIX/Linux-зависимости или предпочтении пользователя. До smoke-тестов формулировка результата — «официально поддержано и обосновано исходниками», не «проверено работающим на этом компьютере».
