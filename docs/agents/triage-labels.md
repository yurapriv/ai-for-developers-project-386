# Triage Labels

Map canonical triage roles to values in local issue `Status:` lines.

| Canonical role | Local status | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an unattended agent |
| `ready-for-human` | `ready-for-human` | Requires human implementation |
| `wontfix` | `wontfix` | Will not be actioned |

When a skill mentions a triage role, use the corresponding local status.
Edit the Local status column to change this repo's vocabulary.

Wayfinder's claimed/resolved lifecycle is defined separately in
`issue-tracker.md`.
