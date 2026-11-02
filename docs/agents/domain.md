# Domain Docs

## Before exploring, read these

This repo uses a single-context layout:

- `GLOSSARY.md` at the repo root: read it for domain terminology.
- `docs/adr/`: read ADRs relevant to the area being explored.

If these files do not exist, proceed silently. Do not flag their
absence or suggest creating them upfront. The `/domain-modeling`
skill creates them lazily when terms or decisions are resolved.

## Use the glossary's vocabulary

When naming a domain concept in an issue title, refactor proposal,
hypothesis, or test name, use the term defined in `GLOSSARY.md`.
Respect its explicitly avoided synonyms.

If a needed concept is missing, reconsider whether it belongs to
the project's language; note a genuine gap for `/domain-modeling`.

## Flag ADR conflicts

If a proposal contradicts an existing ADR, identify the conflict
explicitly and explain why the decision is worth reopening.
