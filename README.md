# Workbench

Five diagram grammars on one graph world: **architecture · workflow · sequence · data flow ·
state machine**. Draft a system, put load through it, and read what the drawing says about it —
without the drawing ever changing shape. One document per paradigm; three lenses (design ·
simulate · analyze) that change the information on the canvas, never the layout.

This is the production TypeScript port of the `Workbench v10` prototype. The prototype is the
specification: every pixel, token, attribute name, keyboard binding and simulation formula was
kept. Where a spec document disagreed with the prototype, the prototype won and the conflict is
listed in [`PORT-NOTES.md`](./PORT-NOTES.md).

## Run it

```sh
pnpm install
pnpm dev            # http://localhost:5173
pnpm build && pnpm preview
```

Node 22+, pnpm 9. Zero UI dependencies: React 18 and nothing else at runtime.

| script | what it does |
| --- | --- |
| `pnpm typecheck` | `tsc` strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| `pnpm test` | Vitest: unit + parity + golden files |
| `pnpm test:e2e` | Playwright: keyboard map, paradigms, edge card, perf budgets, visual parity |
| `pnpm lint` | typecheck + the acceptance greps (no hex literals, no aliases in `model`/`store`, no `any`, no TODO) |
| `pnpm goldens` | regenerate `tests/golden/data` from the **original** prototype modules |

## Documents

Every paradigm holds one named document; all five and the active paradigm are **autosaved** to the
browser (600 ms after the last edit, and on tab hide / close) and restored on reload. The status
strip shows whether the latest edit is durable — `unsaved` · `saved` · `save failed` (with retry and
export-copy). Saves go through a small key/value seam (`src/persist/store.ts`) so the graph model is
never tied to one provider; records are versioned and wrap a versioned `GraphDocument`, so older
documents migrate on read (v1 → v3 is covered). Writes are interrupted-save safe: a crash mid-save
leaves either a complete pending record (recovered) or the previous good one (restored); a record
that cannot be read opens a recovery dialog with an export of the unreadable copy instead of a silent
reset. `commands → export / import document · json` move documents as files; the title in the header
is editable.

**Presets** replace the live document as one undoable transaction: a single `⌘Z` brings back the
previous graph, preset selection and load. If the document has edits since it was loaded, the preset
picker asks first; cancelling changes nothing. Loading a preset — or undoing / redoing across one —
restarts the simulation clock, metrics and findings; run / pause is left as it was.

**share** puts the whole document in the URL fragment (`#d=<base64url json>`), copies the link and
confirms with a toast; opening the link restores the diagram (as the `Shared link` preset). Nothing
leaves the browser — the fragment is never sent to a server.

`?static=1&p=<paradigm>&z=<overview|compact|working|detail>&mode=<design|simulate>` mounts the
chrome-less canvas harness; `?zoomMode=smooth|crisp` mirrors the DC prop.

The parity tests, the golden generator and the visual spec read the prototype export from
`Form submission process/` at the repo root. Without that folder they skip; everything else runs.
`scripts/` also holds the probes used during the port (`smoke`, `shot`, `perf-probe`,
`visual-probe`, `dom-probe`, `proto-shot`): `node scripts/<name>.mjs <out-dir>` against a
running `pnpm preview` (and `pnpm serve:proto` for the prototype).

## Tablet

Two supported tablet forms, chosen by viewport width and written to `<html data-form>` (`src/app/form.ts`):
**tablet-landscape** ≤ 1180 px (iPad landscape, split view) and **tablet-portrait** ≤ 900 px (iPad
portrait); everything wider is the desktop shell. On both, the library is an overlay drawer (a canvas
tap dismisses it) and the canvas keeps at least half the viewport with every panel open. Landscape keeps
the inspector and findings as side panels (240 / 264 px); portrait turns them into bottom sheets capped
at half the canvas height that split the width when both are open, and moves the zoom control and toasts to the top.
Coarse pointers get 44 × 44 px targets on every control and port; ports stay faintly visible on touch;
tap selects, one-finger drag moves or pans, two fingers pinch-zoom, dragging a port connects, and the
inspector edits everything hover would. `viewport-fit=cover` + safe-area insets, `100dvh` and
`interactive-widget=resizes-content` handle notches, rotation, browser chrome and the virtual keyboard.
`tests/e2e/tablet.spec.ts` drives both forms with touch emulation.

## Keyboard

Everything on the canvas is reachable without a pointer: `Tab` to the canvas, arrows select (focus
follows the selection), `⇧`+arrows move the node a grid step, `c` starts a connection from it (arrows
pick the target, `Enter` connects, `Escape` cancels), `Enter` moves into the inspector, where the
relationship rows reach each edge and its `from` / `to` selects rewire it. Lenses are a radio group,
toggles carry `aria-pressed` / `role=switch`, the load slider has `aria-valuetext`, the palette is a
combobox over a listbox, and a polite live region announces selection, lens, run state and edits.
`pnpm test:a11y` runs axe on every lens and dialog plus this keyboard-only path; it gates CI.

`/` or `⌘K` palette · `?` keyboard help · `⌘Z` / `⇧⌘Z` undo / redo · `f` fit · `l` auto layout · `t` trace · `n` new
diagram · `r` run / pause · `d` theme · arrows step the selection in reading order (in a sequence
`↑↓` step messages in time order) · `Delete` / `Backspace` delete · `Escape` unwinds drag → palette
→ dialogs → card → selection.

## Metrics

One definition per measure lives in `src/sim/metrics.ts`; the HUD, the telemetry patcher, the
inspector, the drawer and the findings all derive their numbers from it, so one value cannot read
two ways. Every snapshot carries provenance (`metrics.prov`: timestamp · tick · sample window ·
warm-up), and the findings header says whether analysis is **live** (re-derived each second while
the simulation runs) or **frozen** at the stamped tick, and over which window.

| measure | scope | unit | window | definition |
| --- | --- | --- | --- | --- |
| end-to-end · cycle · lifetime · roundtrip p99 | system | ms · min | queueing: instant · token: last ≤300 completions | queueing: visit-weighted mean latency × (2.3 + 2.2·saturation), data flow counting async hops · token: p99 of completed run durations |
| node p99 | node | ms · min | instant | 2.2 × the node's mean latency (an estimate) |
| lag | node | events/s | instant | arrivals × (1 − 1/util) while util > 1 |
| lagging | system | events/s | instant | Σ node lag (the data-flow HUD) |
| dropped · timeouts | system | /s | instant | offered load − goodput |
| errors · failed · bad exits | system | share | as p99 | queueing: visit-weighted node error share · token: bad completions ÷ completions **in the same window** |
| drawer `max` | system | as charted | last ≤140 ticks | the maximum of the charted series — never the current value |

Percentiles and outcome shares report `—` ("warming up · n of 20 completions") until the window has
enough samples. Metric-backed findings carry `evidence` (metric · scope · value) and point at the
nodes and edges they judge; outcome claims cite observed object counts, never terminal-type ratios.
`tests/unit/metrics.test.ts` fails when any surface drifts from the definitions, and pins the
analyzer's output on seeded fixtures (`tests/unit/__snapshots__/analyze-*.json`).

## Layout

```
src/
  model/       GraphDocument types, guards, migrations (v1 → v3), ids        imports nothing
  paradigms/   registry: five grammars, shared field kinds, presets, examples
  layout/      layered · lanes · ranked · stages · timeline, de-overlap, lane fitting
  router/      port sides, channel corridors, cost-ranked candidates, path emit, routeSig memo
  sim/         queueing engine, token / markov / timeline simulators, HUD formatting
  analyze/     per-paradigm findings
  view/        viewport transform, zoom ladder, semantic zoom levels, culling
  render/      GraphCanvas, GraphNode, GraphEdge, NodePort, GraphRegion, EdgeMarkerDefs, sequence layer
  chrome/      header, switcher, HUD, library, inspector, findings, edge card, palette, strip
  telemetry/   element registry + the imperative 4 Hz patch pass
  store/       state, history, park / restore per paradigm
  app/         Workbench root, controller, gestures, keyboard, view model
packages/typegram/  @typegram/graph — the canonical design system (tokens · chrome · Graph Layer · docs + specimens)
```

Rules that hold: `model` imports nothing. `render` never imports `sim` — telemetry strings are
props on first paint and DOM patches after that. `chrome` never touches canvas DOM. Colour comes
only from `var(--*)` tokens.

The design system is a workspace package, **`@typegram/graph`** (`packages/typegram`), and the
app only *consumes* it: `src/theme/index.css` imports it by name through the package `exports`;
`src/theme/workbench.css` is app chrome only. Everything that styles a graph primitive — including
the telemetry, channel, health, annotation and semantic-zoom rules that used to live in the app —
is in `packages/typegram/components/graph/telemetry.css`. `pnpm lint` enforces the boundary:
no relative reach into the package, no deep import outside `exports`, no custom property in the
app outside the `--wb-` namespace, no copied token value or raw colour, no `.tg-*` primitive rule
in app CSS, and every package stylesheet reachable through `exports`. The Graph Paradigm is
documented in `packages/typegram/docs/graph-paradigm.md`; `pnpm specimens` freezes every paradigm ×
lens from the real renderer into `docs/specimens/` with the package CSS alone. Versioning and
migration notes: `packages/typegram/CHANGELOG.md`.

## Two colour channels

A node has a semantic **kind** (`data-kind="approval"`) and a visual **family**
(`data-family="amber"`). Only the family drives colour; the uppercase kind word always ships with
it. The legacy triad names (`service`, `queue`, `agent` …) are an internal rendering alias behind
`@internal` accessors — they never reach a document, the store, or an inspector label
(`pnpm lint` checks).

## Performance contract

Requirements, asserted by `tests/e2e/perf.spec.ts` at preset scale (60 nodes / ~90 edges):

- **Pan frame.** One transformed viewport element; pan and zoom write `transform` (and the grid's
  background offset) on that element and nothing else re-renders — the store is not written during
  a gesture, once on release. Measured: ~0.4 ms main-thread per frame.
- **Telemetry pass, 4 Hz.** Metrics are patched imperatively through cached `[data-t]` element
  refs; a tick never calls `setState`, never touches topology. Measured ~1.9 ms average, 4.4 ms max.
- **Commit.** Add / delete / relayout of a preset-scale document commits under 250 ms; nodes and
  edges are memoized by shallow view-model equality. Measured 60–175 ms in headless Chromium.
- Pointer capture + one rAF-coalesced `pointermove`; transient drags move the node with
  `transform` and commit on `pointerup`. One shared SVG edge layer, one `EdgeMarkerDefs`, 12 px
  transparent hit twins. Regions are `pointer-events: none` divs. Layout runs on request; the
  router re-solves only when `routeSig` changes. Sequence messages skip the corridor solver.
  Culling past 40 nodes.

The vsync-cadence assertion is strict on a hardware renderer (or with `PERF_STRICT=1`). Headless
Chromium rasterises with SwiftShader, where the full-canvas gradient grid costs ~2 vsyncs
regardless of the app's work; there the guard is "never worse than three".

One known cost: `zoomMode="crisp"` (the default) probes up to 24 nodes with
`getBoundingClientRect` once per new zoom key to decide whether css `zoom` lays out identically
to `transform`. It runs only on commit and is memoized per `k@dpr`.

### Stress Lab · benchmark matrix

`commands → stress lab` (or `?stress=1`) opens the Stress Lab: deterministic fixtures from
`src/app/stress.ts`, measured in-page by `src/app/bench.ts` and judged against the budgets in
`src/app/budgets.ts` — the single source for both the dialog and CI. Loading a fixture is one undo
away from your document and is never autosaved.

| scenario | fixture | what is measured |
| --- | --- | --- |
| `arch-100` · `arch-500` · `arch-1000` | 100 / 500 / 1000 architecture nodes, 1.5× edges | pan frame main-thread p95 + rAF cadence p95 · long tasks · telemetry pass avg with node / edge **render counts (must stay 0)** · findings refresh during simulation · cold route solve · commit add / delete / relayout · DOM / SVG / path counts |
| `seq-500` · `seq-2000` | 40 participants, 500 / 2000 messages | the same, plus **messages rendered** — row culling (`SEQ_CULL_FROM` = 200) keeps the DOM flat; the selected, hovered and traced messages are always drawn and `↑↓` reveals a culled row |
| `flow-300` | 300 data-flow nodes across 6 stages | the same, dense orthogonal routing |
| `heap` | 12 cycles of paradigm switch → blank → example | JS heap before / after (with `--expose-gc`), growth ≤ 30 MB |

`pnpm bench` runs the matrix headless and writes `bench-results/latest.json` plus a timestamped copy
(schema: results + verdicts per scenario, each result carrying the `env` it was measured in);
`.github/workflows/bench.yml` runs it on every push to `main` and on demand, and uploads the file as
an artifact — that artifact is the repeatable, all-green record of the contract. `pnpm bench:compare
before.json after.json` prints every budget side by side and exits non-zero when a budget that
passed now fails — regressions are numbers, not impressions. `tests/e2e/perf.spec.ts` keeps the
quick preset-scale check on every PR.

#### Supported environment · skipped measurements

Every scenario first probes where it is running (`probeEnv` in `src/app/bench.ts`): renderer,
tab visibility, and the **idle frame-clock cadence** — the median gap between animation frames
with nothing queued (~16.7 ms on a 60 Hz display). The lab shows this line before you run anything.

- **Supported** = a visible tab whose frame clock is not throttled (idle cadence ≤ 100 ms). Headless
  Chromium in CI is supported; so is a foreground tab on a laptop. Timing budgets are asserted only
  here. A background / occluded tab or a remote "cloud" browser throttles `requestAnimationFrame` to
  ~1 Hz and often the CPU with it; there every millisecond budget is **skipped with a reason**
  (`unsupported environment: frame clock throttled (1017 ms between idle frames)`), and only the
  structural budgets — DOM / SVG counts, zero topology re-renders, sequence culling, heap growth —
  are judged. A skipped verdict is never a pass: it carries `reason` in the JSON, the dialog, the
  bench log and `bench:compare`.
- **rAF cadence** additionally needs a hardware renderer and a ≥ 50 Hz display (idle cadence
  ≤ 20 ms); headless SwiftShader drops vsyncs whatever the app does, and a 30 Hz screen cannot
  meet 18.2 ms. Otherwise it is skipped as `software renderer` / `display below 50 Hz`.
- **Heap** needs `performance.memory` (Chromium; `--expose-gc` for a clean before / after).
- CI asserts `env.supported` and allows only the renderer / memory skips, so a throttled runner
  fails loudly instead of skipping its way to green.

**Commit latency is main-thread time to layout**, not time to paint: the edit, the React render
(external-store updates flush synchronously in a microtask, plus commit-triggered follow-ups until
the store is quiet) and a forced style + layout. It used to wait two animation frames, which on a
throttled frame clock added ≈2 s to every commit — the "≈2 s add / delete / relayout" of a
production run in a cloud browser (ARC-170) was two 1 Hz frame waits, not app work. The frame clock
is the environment's, and is judged on its own by the cadence budget.

Baselines (2026-09-05, headless Chromium): pan main-thread ≤ 0.8 ms and zero topology re-renders at
every scale; sequence culling keeps 2000 messages at ~1.8k DOM elements; heap growth 0 MB over 12
switch cycles. The large-scale ceilings are honest, not aspirational: at 500 architecture nodes a
cold route solve is ~0.9 s and an add commits in ~2.4 s (three commits, each re-routing every edge
because the obstacle set changed); at 1000 nodes ~4.4 s / ~10 s. Those budgets are set at ~2× the
baseline (headless timings jitter ~1.5× under load) so regressions show as numbers; the fix is a spatial index for routing obstacles, tracked
separately.

## Verification

- **Goldens.** `scripts/goldens.mjs` runs the original `sim-engine.js`, `sim-paradigms.js`,
  `layout.js`, `analyze-paradigms.js` and a verbatim extraction of the prototype's router,
  analyzer and lane code with seeded randomness. The port reproduces every path string exactly
  and every metric within 1e-6 across all twelve example documents.
- **Parity.** The paradigm registry and examples are compared against the prototype's JS modules,
  imported directly from the export folder.
- **DOM contract.** jsdom tests pin the attribute set on nodes, edges, regions and the canvas.
- **Visual.** `tests/e2e/visual.spec.ts` serves the original prototype from the export folder and
  diffs the canvas against the port at the four zoom levels in both themes, budget 1 %.

## Non-goals

Multiplayer, server persistence, a second theme, new paradigms, new node or edge styles,
conversion between paradigms, a minimap (not in v10), any redesign of the chrome.
