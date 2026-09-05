# PORT-NOTES — Workbench v10 → TypeScript

The prototype is the specification. This file records where every module came from in
`Form submission process/Workbench v10.dc.html` (line ranges below are that file), the
supporting JS modules, and every place the prototype and the spec documents disagree.
Nothing was silently picked; every conflict is resolved in favour of the prototype and
listed in §3 so it can be overruled later.

Legend: `WB` = Workbench v10.dc.html · `PS` = Paradigm Spec.dc.html · `GL2` = Graph Layer
v2.dc.html · `DMS` = Design Mode Spec.dc.html · `DS` = `_ds/…/` design system.

## 1 · Module inventory

| Module | Files | Prototype source | Notes |
| --- | --- | --- | --- |
| `model/` | `document.ts`, `guards.ts`, `migrations.ts`, `ids.ts` | `paradigms.js` 265–285 (`toDoc`/`fromDoc`), WB 1822–1835 (snapshot shape) | Imports nothing. The v3 document is the flat store shape typed. v1 exchange shape (`kind/position/data`) is a migration input only. |
| `paradigms/` | `registry.ts`, `architecture.ts`, `workflow.ts`, `sequence.ts`, `dataflow.ts`, `state.ts`, `families.ts`, `fields.ts`, `presets.ts`, `examples.ts`, `icons.ts` | `paradigms.js` (all), `presets.js` (all), `examples.js` (all) | Logic unchanged. Each type gains a public `family`; `gk` stays `@internal` and is derived, never serialized. `presets.js` `CATS.color` hex literals dropped — unused by v10 and forbidden by the token rule. |
| `layout/` | `auto.ts` (layered · lanes · ranked · stages · timeline), `deoverlap.ts`, `lanes.ts` | `layout.js` (all); WB 905–925 `deoverlap`; WB 1895–1952 `fitLanes`/`laneOf`/`laneMembers` | `deoverlap` and `fitLanes` are pure functions taking measured heights. |
| `router/` | `geometry.ts` (`sidesFor`, `anchorOf`, `routePts`, `pathFrom`), `solve.ts` (`solveRoutes`, `laneIn`), `signature.ts` (`routeSig`), `sequence.ts` (`seqRoutes`, `seqGeo`), `plan.ts` (memo) | WB 935–978, 980–1002, 1003–1131, 782–828 | The `routeSig` memo is ported, not re-derived. Sequence messages skip the corridor solver (WB 1005). |
| `sim/` | `engine.ts`, `paradigms.ts` (workflow · state · sequence), `format.ts` (`fmt`, `fmtMs`, `fmtMin`, `polyline`), `hud.ts` (tones, units) | `sim-engine.js`, `sim-paradigms.js`, WB 712–736 (`fL`, `p99Tone`, `dropTone`, `dropOf`, `weightOf`, `unitFor`, `rateText`) | Same `Math.random` call order as the prototype so goldens match. |
| `analyze/` | `architecture.ts`, `paradigms.ts`, `index.ts` | WB 1649–1810 (`analyzeArch`, `tiersOf` helpers), `analyze-paradigms.js` | Finding shape unchanged: `{key, cat, sev, mark, nodeId, title, detail, rec, edges, nodes}`. |
| `view/` | `zoom.ts` (ladder, crisp*, `zoomLevelOf`), `grid.ts`, `transform.ts` (`viewCss`), `fit.ts` (`docBounds`, `fit`, `zoomBy` math), `cull.ts` | WB 1137–1170, 1171–1208 (probe stays in app), 1838–1886, 2113–2116 | `zoomSafe` probe needs the DOM, so it lives in `app/`; `viewCss` takes the probe result as an argument. |
| `render/` | `GraphCanvas.tsx`, `GraphNode.tsx`, `GraphEdge.tsx`, `NodePort.tsx`, `GraphRegion.tsx`, `EdgeMarkerDefs.tsx`, `SequenceLayer.tsx`, `EndpointHandles.tsx`, `TierBand.tsx` | WB 301–401 (canvas markup) | Never imports `sim`. All telemetry strings arrive as props or via the patcher. |
| `telemetry/` | `refs.ts` (element registry + cached child refs), `patch.ts` (`patchTelemetry`, `patchPackets`, `patchRun`, `applyEdgeGeo`, `clearRuntimeDom`) | WB 1519–1647, 2060–2066 | Child refs are cached per element and invalidated on re-render (prototype re-queried every tick). Output strings identical. |
| `store/` | `state.ts`, `store.ts`, `history.ts`, `park.ts` | WB 708–711 (state), 1822–1828 (snap/restore), 758–774 (park/switch) | Hand-written external store; `useSyncExternalStore` on the React side. |
| `chrome/` | `Header.tsx` (title · switcher · lens · HUD · presets · settings), `ParadigmSwitcher.tsx`, `Hud.tsx` (`Hud` + `DraftingHud`), `Library.tsx`, `Inspector.tsx` (node · edge · lane), `Findings.tsx`, `EdgeCard.tsx`, `Hints.tsx`, `Strip.tsx` (strip + telemetry drawer), `CreateDialog.tsx`, `CommandPalette.tsx`, `Settings.tsx`, `ds/ZoomControl.tsx`, `ds/LogoMark.tsx` | WB 135–299, 405–457, 459–461, 463–612, 615–661, 665–703 | Never touches canvas DOM; calls controller methods only. `ZoomControl`/`LogoMark` are TSX copies of the DS JSX (identical DOM). |
| `app/` | `Workbench.tsx`, `controller.ts`, `viewModel.ts`, `keyboard.ts`, `gestures.ts`, `props.ts`, `stress.ts` (Stress Lab topology generator for the perf spec), `StaticCanvas.tsx` (chrome-less harness) | WB 707–2485 (component class), 2006–2057 (keys), 1222–1517 (gestures) | The controller is the prototype class with `this.state` → store and no render. |

Prototype method → port location (WB lines):

- 712–742 paradigm dispatch (`relOf`, `protoOf`, `transitionText`, `defaultEdgeKind`, `makeSimState`, `simTick`) → `app/controller.ts` + `paradigms/registry.ts`
- 743–757 `bodyRows` → `app/viewModel.ts` (`bodyRows`)
- 758–774 `parkDoc` / `switchParadigm` / `createDoc` → `store/park.ts` + `app/controller.ts`
- 782–828 `SEQ`, `seqMsgs`, `seqY0`, `seqRoutes`, `seqGeo` → `router/sequence.ts`
- 829–834 `UIOPTS` / `setUi` → `store/state.ts` + controller
- 856–882 mount / unmount / didUpdate → `app/Workbench.tsx` effects
- 883–933 `footH`, `maxSig`, `measureMax`, `deoverlap`, `measure` → controller (`measure`) + `layout/deoverlap.ts`
- 935–1131 router → `router/*`
- 1137–1221 zoom ladder, grid, `viewCss`, `zoomSafe`, `applyViewDom`, `commitView` → `view/*` + controller
- 1222–1296 `setCanvas` (touch pinch, ResizeObserver, wheel, card keep-alive) → `app/gestures.ts`
- 1298–1517 pointer gestures, card lifecycle, pinch, `ensureClear`, `toWorld`, `nodeAt` → `app/gestures.ts` + controller
- 1519–1647 simulation step + telemetry patching + packets + run layer → `telemetry/*` + controller
- 1649–1820 analysis → `analyze/architecture.ts` (+ `tiersOf` in `app/viewModel.ts`)
- 1822–1893 history, presets, fit latch, delete → `store/history.ts`, `view/fit.ts`, controller
- 1895–1999 lanes, model ops, inspector field plumbing → `layout/lanes.ts`, controller
- 2000–2066 hints, keys, `moveSel`, `clearRuntimeDom` → `app/keyboard.ts`, `telemetry/patch.ts`
- 2068–2088 `paletteItems` → `chrome/CommandPalette.tsx` (data from controller)
- 2089–2113 `regionsViewOf`, `addPhase`, `portStateFor` → `app/viewModel.ts`, controller
- 2114–2485 `renderVals` → `app/viewModel.ts` (split per chrome surface)

## 2 · Decisions

1. **Package manager.** The repo was npm-based (`package-lock.json`, `npm ci` in three
   workflows). The brief specifies pnpm; the lockfile was replaced with `pnpm-lock.yaml` and
   the workflows now use `pnpm/action-setup@v4` + `pnpm install --frozen-lockfile`. Node is
   pinned to 22 in CI (the brief's target); the machine that produced this port runs Node 26.
2. **Design-system copy lives at `ds/typegram/`**, outside `src/`, so the acceptance grep for
   hex literals under `src/` stays meaningful. Only tokens, `components.css`, `graph.css` and
   `paradigms.css` are copied (the runtime CSS the prototype's helmet loads), as-is.
3. **Document shape.** §7.1 of the brief (flat `GraphNode { id, type, name, x, y, … }`,
   `version: 3`) is the canonical document and the store shape. `paradigms.js` `toDoc`
   produces a v1 exchange shape (`kind / position / data`) and PS §4 documents that shape.
   `model/migrations.ts` upgrades v1 → v3; `toDoc` is kept as `exportV1` for interchange.
4. **Regions carry `family`, never a triad alias.** The example documents in `examples.js`
   stamp regions with `kind: 'service' | 'external' | …` (the legacy graph-kind alias) and the
   renderer resolves `r.family || familyOfGk(r.kind)`. To satisfy "aliases never reach the
   document", the example builder resolves `kind → family` at definition time and the store
   only ever holds `family`. Rendered `data-family` is identical; regions never emitted
   `data-kind` in v10.
5. **`gk` is derived, not authored.** Paradigm types declare `family` (public). The legacy
   `gk` alias needed by nothing in v10's DOM (chips and swatches speak family) is exposed only
   as an `@internal` accessor for tooling parity (Stress Lab) and is stripped from documents.
6. **Telemetry refs are cached.** The prototype ran `querySelector` per `data-t` target per
   node per tick (WB 1532–1547). The port caches child references at registration and
   invalidates them when a node re-renders, so the 4 Hz pass allocates nothing per node. The
   written strings and attributes are byte-identical.
7. **SVG `<text>` content.** WB 2160 sets label text through ref callbacks because the DC
   harness could not interpolate inside `<text>`. React can; the port renders text children
   directly. Same DOM.
8. **Typed numeric fallbacks.** Where the prototype relied on `undefined` arithmetic
   (`n.inst * n.cap` on a node with no `ms`), the port reads `n.ms ?? 0`, `n.inst ?? 1`,
   `n.cap ?? 1` only inside branches the prototype also guarded (`n.ms > 0`). No example
   document exercises the difference; goldens confirm.
9. **Palette/dialog scrim.** `rgba(28,25,23,0.42)` in two inline styles became the app token
   `--wb-scrim` (the only added token). The `a{color:var(--link,#0d9488)}` hex fallbacks were
   removed because the tokens exist.
10. **Minimap.** §5 lists `Minimap` under `chrome/`. Workbench v10 has no minimap (the DS has
    `.tg-gminimap` classes but the prototype never renders one). Building one would be a
    redesign (§9 non-goal), so it is not built. Open issue #1.
11. **Props.** The DC harness fed `theme · motion · grid · pixelFill · router · channelGap ·
    zoomMode · zoomSnap` as component props with defaults (`dark`, `true`, `true`, `true`,
    `channels`, `normal`, `crisp`, `free`). They are `WorkbenchProps` on the root with the same
    defaults. Default theme is dark (WB data-props), while `applyTheme` reads
    `state.theme || props.theme || 'dark'`.

## 3 · Spec conflicts (prototype wins unless stated)

| # | Topic | Prototype (WB) | Spec | Resolution |
| --- | --- | --- | --- | --- |
| C1 | Node health attribute value | `data-health="warn" \| "crit"` on `.tg-gnode` (WB 1544), app CSS keys `[data-health="crit"]` | GL2 / graph.css v2 canonical `critical`; `error` deprecated | Nodes write `crit` (byte-compat with WB CSS); edges and packets write `critical` exactly as WB 1553 does. |
| C2 | Edge corner radius | `r = clamp(3, gap − 2, 6)` → 6px at the default 8px channel gap (WB 1123) | GL2: `--edge-radius: 5px`, "5px wins" | Prototype formula ported; token unused by the router. |
| C3 | Arrow markers | Five painted markers, `markerWidth 11`, `userSpaceOnUse` (WB 316–321) | DS `EdgeMarkerDefs.jsx`: one `context-stroke` marker, width 7 | Prototype set (GL2 itself explains why `context-stroke` fails in WebKit). |
| C4 | Culling threshold | `cullOn = nodes.length > 40` (WB 2193) | Brief §4 and PS §18: "past ~100 nodes" | 40, per prototype. |
| C5 | Overlay toggle attributes | `data-o-labels/rates/packets/spark/chan` + `.wb-packets` (WB 68, 301) | GL2 / graph.css: `data-layer-labels/metrics/flow/spark/grid` + `.tg-edge-flow`; brief §4 names `data-layer-flow` | Prototype attributes and classes kept for DOM byte-compat; `data-layer-trace` is the only `data-layer-*` the prototype emits. |
| C6 | Packet cap | `PKT_CAP = 28` (WB 1597) | `--edge-flow-cap: 28` token | Same value; the constant is code, the token is documentation. |
| C7 | Document version / node shape | `toDoc` v1 `{kind, position, data}` | Brief §7.1 v3 flat; PS §4 v1 shape | Brief wins (it is the type contract); v1 accepted via migration. See D3. |
| C8 | Region colour key | Examples author `kind:` aliases; renderer accepts `family` | Brief §8: aliases never reach the document/store | Brief wins at the data layer, prototype DOM unchanged. See D4. |
| C9 | Keyboard delete | `Delete` **or** `Backspace` (WB 2032) | Brief §4 lists `Delete` only | Both kept (superset). |
| C10 | Inspector width | app CSS `.wb-insp{width:264px}` / dense 214px | DS `.tg-ginspector{width:236px}` | Prototype; the app never uses `.tg-ginspector`. |
| C11 | Overview title clamp | `max-width:172px` on `.tg-gnode-title` at overview (WB 82) | graph.css sets 20px without a clamp | Prototype's clamp kept in the app stylesheet. |
| C12 | Zoom-band re-measure | Crossing a density band re-measures heights and re-solves routes (WB 1201–1207) | DMS §9: "Zoom-band density is CSS on data-zoom — no React re-render on zoom" | Prototype: the re-measure bumps `geo` and re-renders once per band crossing, never per frame. |
| C13 | `css zoom` re-raster | `zoomMode='crisp'` probes 24 nodes and swaps `transform` for `zoom` when layout is identical (WB 1171–1195) | Not in any spec | Kept behind the `zoomMode` prop exactly as written; noted as a DOM-probe cost in README. |
| C14 | Lane label grammar | `NN / NAME` (examples), owner as `kind · owner` | DS readme: `LANE · NAME` | PS §4 documents `NN / NAME`; examples use it. Prototype wins. |
| C15 | Sequence `ly` for a self-message | `ly = y + 12` (WB 797) vs straight `y − 6` | — | Ported as-is (no spec statement). |

## 4 · Open issues

1. Minimap: not present in v10, listed in the brief's module layout. Needs a design before
   code (§9 forbids chrome redesign).
2. `zoomSafe` probe (C13) reads `getBoundingClientRect` for up to 24 nodes on each new zoom
   key. It is memoised per `k@dpr` and runs only on commit, but it is the one place a commit
   can exceed budget on a slow machine. Perf test measures commit with `zoomMode='smooth'`
   and `'crisp'`.
3. `CATS.color` hex values from `presets.js` were dropped (unused). If a future surface needs a
   category colour it must come from a family token.
4. Sequence virtualisation beyond ~300 messages remains unbuilt (PS §24).
5. `share` on source nodes (`c.share`, sim-engine 24) is read but no paradigm exposes a field
   for it. Typed as optional; never written.
6. `analyze-paradigms.js` `fmtMin` differs from `sim-paradigms.js` `fmtMin` (no `d` unit, no
   decimal minutes). Both are ported as separate functions to keep finding text identical.
7. `edgeRate` for an edge whose `from`/`to` is missing is never written; the HUD shows `0`.
   Unchanged.
8. Palette command `change diagram type · …` runs `switchParadigm`, which never clears
   `palette` (WB 2072 · 762). The palette stays open after the switch; Escape closes it. Kept
   as the prototype has it — flag if it should close like every other palette command.
9. Imperative `data-state` writes (dragging · compatible · invalid-target) desynchronise React's
   view of the attribute: React will not rewrite a value it believes is unchanged. The port
   restores the React-known value (`selected` or empty) when a drag ends instead of writing
   `''` as WB 1397 did, otherwise a clicked node lost its selection ring until the next render.
   Same visible result as the prototype under its harness, which re-applied attributes per render.
10. React propagates synthetic pointer events on its own tree, so a node's native
    `stopPropagation` (WB 1310) no longer stops the canvas `onPointerDown`. The handler wrappers
    stop the synthetic event as well; without it every node press also started a pan that
    cleared the selection on release.
11. The inspector (`right:14px; top:12px; bottom:12px; z-index:7`) covers the zoom control
    (`right:16px; bottom:16px`) whenever something is selected — in the prototype too. Kept; the
    wheel, `f` and the palette still zoom. A chrome change is out of scope (§9).
12. The pan-frame budget cannot be verified on a software rasteriser. Headless Chromium
    (SwiftShader) repaints the four-layer gradient grid in ~2 vsyncs whatever the app does; the
    app's own main-thread cost per pan frame measures 0.4–0.6 ms at p95. The perf spec asserts the
    main-thread cost strictly everywhere and the vsync cadence strictly only on a hardware
    renderer or with `PERF_STRICT=1`.

## 5 · Verification

- Goldens (`tests/golden/`): produced by `scripts/goldens.mjs`, which runs the **original**
  `sim-engine.js`, `sim-paradigms.js`, `layout.js`, `analyze-paradigms.js` and a verbatim
  extract of the WB router / analyzer / lane code (`scripts/extract-proto.sh` →
  `scripts/proto-app.mjs`) with `Math.random` and `Date.now` stubbed. The TS port reproduces
  every path string exactly and every metric within 1e-6 across the twelve example documents.
- Parity (`tests/unit/paradigms.parity.test.ts`): registry, defaults, families, a11y sentences,
  examples and the v1 export compared against the prototype modules imported from the export.
- DOM contract (`tests/unit/render.test.tsx`): the attribute set on nodes, edges, regions, canvas.
- Playwright (`tests/e2e/`): every shortcut in §4 of the brief, all five paradigms through
  load · layout · simulate · analyze · trace, park/restore, edge-card timing and pinning,
  endpoint handles, the three perf budgets, and visual parity.
- Visual parity: the original prototype is served from the export folder (port 4180) and the
  canvas is diffed against the port at four zoom levels × two themes. Measured: overview 0.10 %,
  compact 0.17 %, working 0.43 %, detail 0.00 % (dark; light within 0.05 % of these). The DOM is
  identical at the selector level; the residue is anti-aliasing around the DC harness's
  `<span class="sc-interp">` interpolation wrappers, which the port does not emit. Working is
  compared at 100 % — at the fitted 0.82 css zoom those wrappers shift glyph runs by a sub-pixel
  and the same identical DOM reads as 1.4 %.
