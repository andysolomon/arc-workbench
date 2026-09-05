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

## Keyboard

`/` or `⌘K` palette · `⌘Z` / `⇧⌘Z` undo / redo · `f` fit · `l` auto layout · `t` trace · `n` new
diagram · `r` run / pause · `d` theme · arrows step the selection in reading order (in a sequence
`↑↓` step messages in time order) · `Delete` / `Backspace` delete · `Escape` unwinds drag → palette
→ dialogs → card → selection.

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
ds/typegram/   the design system, copied as-is (tokens + graph CSS)
```

Rules that hold: `model` imports nothing. `render` never imports `sim` — telemetry strings are
props on first paint and DOM patches after that. `chrome` never touches canvas DOM. Colour comes
only from `var(--*)` tokens; the one added token is `--wb-scrim`.

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
