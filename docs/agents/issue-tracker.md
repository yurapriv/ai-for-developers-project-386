# Issue tracker: GitHub

Issues and specs live in https://github.com/yurapriv/ai-for-developers-project-386/issues.
Use gh through the project environment: `mise exec -- gh <arguments>`.

## Target repository

Use `--repo yurapriv/ai-for-developers-project-386` for issue operations.
Before the first write in a session, verify the target with
`gh repo view --json nameWithOwner,url`.
Publish only to this project's repository.

Existing `.scratch/application-scaffold/` files are historical records.
Keep them intact; new tracker work goes to GitHub.
Migrating old records requires a separate request.

## Conventions

- Create: `gh issue create --repo yurapriv/ai-for-developers-project-386 --title "..." --body-file <file>`.
- Read: `gh issue view <number> --repo yurapriv/ai-for-developers-project-386 --json number,title,body,labels,comments`.
- List: `gh issue list --repo yurapriv/ai-for-developers-project-386 --state open --json number,title,body,labels,assignees`.
- Comment: `gh issue comment <number> --repo yurapriv/ai-for-developers-project-386 --body-file <file>`.
- Labels: `gh issue edit <number> --repo yurapriv/ai-for-developers-project-386 --add-label "..."` or `--remove-label "..."`.
- Close: post the resolution comment first, then close the issue.
- Publishing to the tracker means creating an issue; fetching a ticket means reading its issue.

Use UTF-8 body files for multiline text, including in PowerShell.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding operations

- Map: one issue labelled `wayfinder:map`.
- Child tickets: native GitHub sub-issues, labelled `wayfinder:research`,
  `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
  Use `gh issue create --parent <map>` or
  `gh issue edit <map> --add-sub-issue <child>`.
- Blocking: native dependencies, using `--blocked-by` on creation or
  `--add-blocked-by` on editing. An issue is unblocked when all blockers are closed.
- Frontier: the map's open children with no open blockers and no assignee,
  in map order. Read native sub-issues and dependencies rather than inferring from labels.
- Claim: assign the ticket to the driving developer before work.
- Resolve: post the answer as a comment, close the ticket, and add its title,
  link, and a short gist to Decisions so far.
- Wayfinder issues use wayfinder labels, not triage labels.

If native relationships are unavailable, document the limitation and use
a parent task list, `Part of #<parent>` and `Blocked by: #<number>` references.
Use real issue numbers after creation.
