# Repository guidance

- This Hexlet calendar-booking exercise currently implements a technical scaffold, not booking functionality; see `README.md` for the intended behavior.
- Go `net/http` starts at `cmd/server/main.go` and implements the generated strict API in `internal/server/`. The React/Vite frontend is in `frontend/`; Vite proxies `/health` to the Go server on port 8080.
- The API source is `api/main.tsp`. After changing it, run `mise run generate` then `mise run check`. Generated `api/generated/`, `internal/api/`, and `frontend/src/api/generated/` are committed and generator-owned: do not edit them by hand; generation replaces these directories.

## Development and checks

- Tool versions are pinned in `mise.toml` and `mise.lock`. From the root, use `mise run dev:backend` and `mise run dev:frontend` in separate terminals; setup and daemon instructions are in `README.md`.
- On Windows, fresh terminals and shells do not have `mise` on PATH: prepend `$env:PATH = "$HOME\.local\bin;$env:PATH"` for the current terminal (see `README.md`; `scripts/install-mise.ps1` is the documented installer).
- `mise run check` is the CI/pre-push check: generation drift, formatting, Go modules, lint, typecheck, build, tests, hooks validation, and commit messages. It checks rather than fixes; `npm run format` modifies files.
- Documentation-only changes (prose, glossary, ADRs, plans, `AGENTS.md`, or skill instructions): manually check only the changed documents' formatting/content and `git diff --check` (`git diff --cached --check` after staging). Skip the full check, code lint/typecheck/build/tests, generation, and toolchain/dependency setup unless explicitly requested. Determine docs-only from the actual diff, including staged and untracked files, not the commit type or file extension; API contracts, scripts, dependencies, executable configuration, and code changes require the relevant code checks.
- Existing hooks and CI still run as configured, including the full pre-push check. Do not bypass or alter them for docs-only changes, or manually repeat their full pipeline just to commit documentation. When reporting results, distinguish targeted checks from a full check that was not run.
- Focused tasks: `mise run lint`, `mise run typecheck`, `mise run build`, `mise run test`; a focused smoke run is `mise exec -- go test ./tests/smoke -run TestServerStartsAndMatchesContract -count=1`. It starts a real server; browser behavior is checked separately.
- Keep the single TypeScript 6 compiler: Hey API uses the JavaScript compiler API absent from TypeScript 7. The package overrides patch vulnerable transitive dependencies; review them on upgrades.
- Use Conventional Commits; commitlint checks new history and commit-msg after `mise run setup:hooks` explicitly installs local hooks.

## Hexlet checks

- Do not edit, delete, or rename `.github/workflows/hexlet-check.yml`, and do not rename the repository. These restrictions come from the workflow header and `.github/workflows/README.md`.
- The workflow runs on branch and tag pushes, uses `hexlet/project-action@release` on Ubuntu, and requires the GitHub Actions secret `HEXLET_ID`. It exposes no local test command.
- `.github/workflows/README.md` says automatic tests become available after all project tasks are completed in Hexlet; a subsequent pushed commit triggers the workflow.

## Agent skills

Project skills are installed in `.agents/skills/` and pinned by `skills-lock.json`.
Invoke a skill by name or by its `SKILL.md` path.

### Issue tracker

Issues and specs live in GitHub Issues for `yurapriv/ai-for-developers-project-386`. Read `docs/agents/issue-tracker.md` before creating, reading, or updating tickets.

### Triage labels

Use the five default GitHub triage labels. Read `docs/agents/triage-labels.md` when triaging issues.

### Domain docs

Read `docs/agents/domain.md` before exploring the codebase or proposing domain changes. It defines the single-context `GLOSSARY.md` / `docs/adr/` convention; these documents are created lazily.
