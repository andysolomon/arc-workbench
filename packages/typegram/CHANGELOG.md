# @typegram/graph

## 1.0.0 — 2026-09-05

First versioned package (`packages/typegram`, consumed by Workbench as `workspace:*`).

### Added
- `components/graph/telemetry.css` — the Graph Layer's telemetry, channel, health, annotation,
  highlight and semantic-zoom rules, previously defined only inside Workbench.
- `tokens/base.css` — `--scrim` (modal scrim).
- `docs/graph-paradigm.md` and `docs/specimens/` (five paradigms × three lenses).

### Migration (Workbench 1.x → this package)
- Import CSS from the package: `@import '@typegram/graph/tokens/colors.css'` (see `exports`
  for the allowed subpaths — `tokens/*.css`, `components/*.css`, `components/graph/*.css`,
  `components/graph/paradigms/*.css`). Relative `ds/` paths are rejected by `pnpm lint`.
- Class renames: `wb-packets → tg-packets`, `wb-hl → tg-hl`, `wb-spark → tg-spark`,
  `wb-hdot → tg-hdot`, `wb-erate → tg-erate`, `wb-elayer → tg-elayer`, `wb-chan → tg-chan`,
  `wb-ann → tg-ann`, keyframes `wb-flow → tg-flow`, token `--wb-scrim → --scrim`.
- Load `components/graph/telemetry.css` after `paradigms.css`.

### Versioning
Semantic versioning on the package: a renamed or removed class, attribute or token is a major;
a new rule or token is a minor; a value change that keeps the DOM contract is a patch.
Workbench pins `workspace:*` and records the consumed version in its lockfile.
