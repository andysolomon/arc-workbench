# IdeaBrowser Extraction Schema

Load this when crawling subpages or building the structured extraction.

## Core subpages

Record each page as `ok`, `missing`, or `blocked` in `Subpage Coverage`.

- `main`
- `value-ladder`
- `why-now`
- `proof-signals`
- `market-gap`
- `execution-plan`
- `value-equation`
- `value-matrix`
- `acp`
- `keywords`
- `feasibility-score`
- `problem-score`
- `opportunity`
- `opportunity-score` (compat fallback only)

## Normalized fields

Include every field. Use `unknown` when not visible.

- slug/id
- title
- core problem
- audience/market
- offer/value ladder
- why-now
- proof/signals
- market gap
- execution plan
- value equation
- value matrix
- acp
- feasibility score
- problem score
- opportunity details
- top keywords

## Rules

- Do not invent values from generic startup knowledge.
- Distinguish `missing` from `blocked`: missing means the page/field appears absent; blocked means auth, network, tooling, or checkpoint prevented reading it.
- Keep extraction normalized; long verbatim page dumps belong in logs, not the final response.
