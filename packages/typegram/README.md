# Typegram Design System

Typegram is a TypeScript-to-diagram playground: you type TypeScript in a dark code pane on the left and a live UML-style class diagram renders on the right (classes, types, unions, interfaces, functions, components, instances), with draggable nodes, connectable edges, and floating editor panels. Internally referred to as "arc-node-graph".

Sources provided:
- Shared design project: https://claude.ai/design/p/45160e5c-59ec-4afb-9f60-a03d012df806 (file "TypeScript Class Diagram.dc.html" = the full app source; examples.js; app screenshots in uploads/). The app source is the single ground truth for every value in this system.

## Content fundamentals

- Two registers. Product name and headings use sentence-case sans ("Typegram"). Everything else — buttons, labels, hints, taglines — is lowercase mono.
- Microcopy is terse, instructional, joined with middle dots: "type on the left · live diagram on the right · drag nodes to rearrange"; "click a node or edge to edit it · double-click to rename · drag the ● handle to connect".
- Group labels are UPPERCASE mono with wide tracking: ADD, PANES, TYPESCRIPT, GENERATED MERMAID SOURCE.
- Actions are bare lowercase verbs/nouns: undo, redo, reset, code, diagram, rename, delete, fit, cancel. Add-actions take a "+ " prefix: "+ class", "+ add member". Destructive copy stays plain: "delete relationship".
- No emoji. Unicode glyphs serve as icons: ↩ ↪ ✕ ✓ − + ● ○, guillemets «» for stereotypes.
- Errors are prefixed and factual: "Parse error: …", "Mermaid: …". Empty states are calm: "No classes, interfaces or enums found yet".
- Voice is tool-like and second-person-implicit (imperatives); never marketing-y, never exclamatory.

## Visual foundations

- **Color.** Warm stone neutrals (#fafaf9 page, #ffffff cards, #1c1917 ink and code pane) with indigo #6366f1 as the single accent (hover #4f46e5, deep #4338ca, tint #eef2ff). The brand gradient is 135° indigo→violet (#6366f1→#8b5cf6), used only on the logo mark. A fixed semantic palette colors node kinds: class indigo, type/union emerald & purple, interface amber, function cyan, component deep indigo, instance orange, external gray — each as a bg/border/text triad (see tokens/colors.css). Danger is soft red (#fef2f2/#fecaca/#b91c1c).
- **Type.** IBM Plex Sans (400/500/600) for the app title only; IBM Plex Mono (400/500) for everything else. Scale: 16px title, 13px code (lh 1.7), 12px diagram/errors, 11px all chrome, 10px hints. Uppercase labels track +0.08em; the title tracks −0.01em.
- **Backgrounds.** Flat surfaces; the one gradient outside the logo is the subtle white→stone header wash. The canvas is #fdfdfc with an indigo blueprint grid (16px fine + 80px major lines). No imagery, no textures beyond the grids.
- **The pixel motif.** Diagram nodes are filled with a 6px pixel-grid pattern of their kind color, have square corners, 1.5px borders, and two stacked hard offset shadows (4px/4px and 8px/8px, zero blur, kind-colored, fading). Selection = 2.5px dashed border. This is the brand's signature.
- **Radii.** Two families: chrome is rounded (6px controls, 10px floating panels, 999px pills, 9px logo, 3px swatches); diagram nodes are square (0px). Nothing else.
- **Shadows.** Three soft ones for chrome — logo glow 0 2px 6px rgba(99,102,241,.35), float 0 6px 18px rgba(28,25,23,.12), panel 0 10px 28px rgba(28,25,23,.14) — plus the hard pixel shadows on nodes. No inner shadows.
- **Borders.** 1px hairlines everywhere in chrome (#e7e5e4 dividers, #d6d3d1 controls); 1.5px colored borders on swatches and nodes.
- **Hover.** Background/border/color swaps only — stone buttons lighten to #f5f5f4, or tint to their kind color (e.g. "+ type" hovers emerald). Primary darkens. No transforms, no shadows on hover. Press states are not distinct.
- **Motion.** Essentially none: instant state changes; the only transition is a 0.15s opacity fade on connect handles. Never bounce or slide.
- **Layout.** Fixed chrome (header, legend, toolbar as full-width hairline-divided bars with 20px horizontal padding, 8-12px vertical), a resizable split with a 7px divider that highlights indigo, floating cards overlaying the canvas (zoom bottom-right, editors top-left/near selection). Density is high; row gaps are 4-8px.
- **Transparency/blur.** None — only rgba shadows and grid lines. No glass effects.
- **Dark surface.** The code pane is #1c1917 with #292524 hairlines and the syntax palette: keywords #c4b5fd, strings #86efac, types #7dd3fc, numbers #fdba74, comments #78716c italic, text #e7e5e4.

## Iconography

- No icon font, no SVG icon set, no PNGs. Icons are unicode characters set in IBM Plex Mono: ↩ undo, ↪ redo, ✕ close/delete, ✓ confirm, −/+ zoom, ● connect handle, ○ edge endpoint, · separator, «» stereotypes.
- Kind identity is carried by color swatches (11px, 3px radius, 1.5px border) and tinted pills, not glyphs.
- No emoji anywhere.
- The only pictorial asset is the logo mark: gradient rounded square + white "{ }" (assets/logo.svg, or the LogoMark component). It was rebuilt exactly from the app's own header markup, not invented.

## Fonts

IBM Plex Sans and IBM Plex Mono load from Google Fonts (tokens/fonts.css), exactly as the source app does. No binaries were provided; if you want self-hosted files, supply them and the @font-face rules can replace the @import.

## Intentional additions

- DiagramNode: the app renders nodes through mermaid + a colorize pass; DiagramNode is a static recreation of that output so consumers can place brand-true nodes without mermaid.
- LogoMark: extracted from inline header markup into a reusable component.

## Graph language

Typegram treats graph topology as the primary interface: canvas → connections → nodes → content → controls. Rounded chrome surrounds a square graph world.

- **Canvas.** #fdfdfc with the indigo blueprint grid (16px minor / 80px major). Geometry snaps to the grid; groups and nodes sit on 16px increments.
- **Nodes (GraphNode).** The pixel motif generalized: square corners, 1.5px semantic border, 6px pixel fill, hard 4px/8px offset shadows, mono type. Anatomy: header (7px swatch + uppercase kind + title), optional key/value rows, optional status line, ports. Densities: compact (header only) / standard / detailed. Graph kinds alias the UML triads: service→indigo, database→emerald, queue→amber, agent→purple, tool→cyan, input/output→orange, external→stone. Kind is always doubled with the uppercase label — never color alone.
- **Interaction vs entity state.** Interaction uses a shared grammar and never recolors the entity: selected = 2.5px dashed kind border + 1px indigo ring (outline, 3px offset) + visible ports; compatible-target = 1.5px indigo ring; muted/invalid-target = opacity .35; dragging = shadows deepen to 6/12px; error = danger border; disabled = .5 opacity, no shadow. No glows, no halos.
- **Ports (NodePort).** 7px square marks on the border, node-kind colored, hidden until node hover/selection; ::after gives a ±8px invisible hit area (±22px on coarse pointers via `--port-hit-touch`; the visual mark stays 7px). States: visible, connected (filled kind), origin/compatible (indigo, compatible adds a flat 3px ring), invalid (danger).
- **Edges (GraphEdge).** One stroke grammar, stone #a8a29e at 1.25px, orthogonal routing with 6px corners as the dominant style: solid=flow, 7-5 dash=dependency, 2-4 dash=async, hollow triangle=inheritance (dashed=implementation), diamond start=composition, faint 2-6 dash=proposed. States recolor the stroke only: hover stone-600, selected indigo, muted stone-200, invalid red, preview indigo 4-4 dash. Labels are 10px mono with a canvas-colored halo, used only when the relationship needs one. Markers live in a shared EdgeMarkerDefs; a 12px transparent twin path carries pointer events. No flowing animations.
- **Groups (GraphGroup).** Weaker than nodes: 1px fine border, ~4% kind tint, 9.5px uppercase mono label top-left. Region grammar: labels read `CONTEXT · NAME` — TIER 1 · NETWORKING, ZONE · EDGE, VPC · PRIVATE, STAGE · PROCESS, DOMAIN · PAYMENTS, REGION · US-EAST — one grammar across products.
- **Semantic zoom.** Four formal levels on GraphCanvas (`zoom` prop / `data-zoom`): overview (silhouette + title, majors-only grid, health only if critical), compact (+ primary metric, essential edges), working (full anatomy + needed labels), detail (+ telemetry, ports, inline actions). Change density, never scale text; grid density follows zoom (`--grid-canvas-major`).
- **Performance.** Hard box-shadows only (no filters/blur/backdrop-filter), one transformed viewport for pan/zoom, one shared SVG edge layer, CSS-variable state switches, opacity-only transitions (.15s).
- **Motion.** Formal tokens: `--motion-instant` 0ms, `--motion-fast` 120ms, `--motion-medium` 180ms (tokens/motion.css); opacity/transform only, zeroed under `prefers-reduced-motion`. Continuous motion is never the default — the one sanctioned animation is `state="trace"` on an edge, for an explicitly requested trace.
- **Telemetry & health.** Layers on topology, never replaces it: numbers first, then edge `weight` (1/2/3 stroke), then bars (GraphTelemetry — `transform: scaleX`, never width). Health tokens `--health-ok/warn/critical` color status dots and bar tones; entity health never recolors the node kind. Topology stays legible with telemetry off.
- **Touch & pinch.** The canvas owns every gesture: `touch-action:none` on the viewport, `manipulation` on floating chrome. Two fingers zoom about the gesture centre and pan at once, committing the view on lift. On iPadOS the pinch must be read from touch events (pointer events are unreliable) and multi-touch `touchstart`/`touchmove` plus Safari's `gesturestart`/`gesturechange` must be `preventDefault`ed — `touch-action` alone still lets the page scale instead of the graph. Under `@media (pointer:coarse)` hit areas grow to `--port-hit-touch` and selection reveals ports, since there is no hover; visual sizes are unchanged. One finger pans; nothing requires a second hand.
- **Dark theme.** One official warm-stone dark theme, `data-theme="dark"` on `<html>` (tokens/themes.css): every semantic token — surfaces, borders, text, kind triads, edges, selection, health, grid — remaps; apps never invent their own dark palettes. Node construction (pixel fill, hard shadows) derives from the triads automatically.
- **Chrome.** GraphToolbar (floating rounded bar), GraphInspector (overlay panel — selection never resizes or shifts the canvas), GraphMinimap (kind-colored marks + indigo viewport rect). Chrome floats over the canvas and gives space back when not useful.
- Tokens: `--graph-*`, `--node-*`, `--port-*`, `--edge-*`, `--selection-*` in tokens/graph.css.

### Graph layer v2 (Aug 2026)

Promoted out of the Workbench prototype, where each of these was app-local CSS.

- **Direction.** Every directed relationship carries an arrow — flow, dependency, async and proposed, not just the UML heads. The head cannot recolour itself: **WebKit implements neither `context-stroke` nor `context-fill`** (it falls back to black), so EdgeMarkerDefs ships one painted arrow per state — `tgm-arrow`, `-hover`, `-selected`, `-warn`, `-critical` — and graph.css swaps `marker-end` in the same precedence order as the stroke. That swap is the system's job, not the app's; consumers rendering their own `<defs>` must use these five ids. `markerUnits="userSpaceOnUse"` keeps the head from inflating when telemetry raises `data-weight`.
- **Router constants** are tokens now, not magic numbers: `--edge-stub` 18px off the anchor, `--edge-radius` 5px corners (the token said 6px and every router drew 5px — 5px wins), `--edge-marker-inset` 3px so the arrow tip meets the border instead of crossing it.
- **Edge health.** `data-health="warn|critical"` on an edge reports the condition of its DOWNSTREAM node. It is a third axis, distinct from interaction and from weight, and the precedence is fixed: **interaction > health > weight > rel**. Hover and selection therefore suppress health colour rather than blending with it.
- **Flow layer.** `.tg-edge-flow` is a second path over an edge, dash-animated to read throughput. This amends "continuous motion is never the default": motion is now a sanctioned rate channel, but **opt-in per surface** via `data-layer-flow="on"` on the canvas, capped at `--edge-flow-cap` (28) busiest edges, and silent under `prefers-reduced-motion`. Consumers set `--flow-o` and `--flow-dur` from the measured rate (log scale) — the animation never encodes anything a number does not already say.
- **Edge metric label.** `.tg-edge-label[data-role="metric"]` is the second line, 12px under the relationship label: protocol plus live rate.
- **Endpoint handles.** `.tg-edge-ends` / `.tg-edge-end` are the rewire affordance (○ at each anchor, filled at `[data-state="active"]`). They are **screen-constant**: divide radius and hit area by the viewport scale k, and mount the overlay above the nodes so handles always beat ports to the pointer.
- **Edge card.** `.tg-ecard` is the third chrome surface, after toolbar and inspector: from / to / protocol / reverse / detach, next to the hovered edge. It is **placed once and pinned** — never chased on later renders — with 80ms open intent, 700ms close, and a 56px keep-alive halo so the pointer can travel to it.
- **Node health.** One `data-health` attribute on `.tg-gnode` and the header mark, telemetry values and status line all inherit. The mark lives in the **header** (`.tg-gnode-health`, right-aligned) so condition survives compact zoom, where the status row is hidden. This amends "entity health never recolours the node": warn and critical **may** take the border, because kind identity still reads from the swatch and the uppercase label. Selection keeps its dashed geometry and indigo ring on top.
- **State names.** `ok | warn | critical` everywhere. `data-tone="error"` survives as a deprecated alias only.
- **Sparkline.** `.tg-tel-spark` is the second sanctioned telemetry form after the bar — 54×14, stroked in `--nt` at .8, non-scaling-stroke. Order stays: number, then bar, then sparkline.
- **Layer toggles.** `data-layer-labels|metrics|flow|spark|grid="on|off"` on the canvas is the documented way to shed overlays.
- **Compact zoom fix.** Compact keeps the primary telemetry row (`data-primary`), as the level was always specified to; the CSS had been hiding the whole block.
- **Overview counter-scale.** The one exception to "never scale text": at overview the title steps to 20px and the kind to 11px, holding constant optical size against the viewport transform.
- **Cursors.** Port `crosshair`, node `grab`, dragging node `grabbing`, endpoint handle `grab`.

### Graph layer v2.1 — design mode (Aug 2026)

Promoted out of Workbench v7's design-mode refinement. Modes are information layers over one spatially-stable canvas, declared as `data-mode="design|simulate|analyze"` on `.tg-gcanvas`.

- **Design describes what the system IS.** Identity (kind color + uppercase type + name), topology, regions and configuration. Telemetry, health marks, sparklines, flow and metric labels do not show in design — consumers should omit them from the DOM (cheaper than hiding); graph.css carries guarantee rules either way.
- **Semantic channels per mode.** Design: color = entity type, danger = invalid architecture (`data-state="error"`). Simulate: + health overlay. Analyze: + finding severity. Runtime health never recolours design — `data-health` borders and `data-weight` strokes are neutralized under `data-mode="design"`.
- **Runtime-attr hygiene.** Consumers that patch `data-health`/`data-weight` outside their framework must clear those attributes on mode exit; patches survive re-renders whose vdom never held them.
- **Configured vs measured.** Node body rows are configuration; mark detail-density rows with `data-cfg` (hidden at design working zoom, shown at detail). Measured values live only in `.tg-gnode-tel`. Working zoom shows identity plus one essential property ("4 instances"); detail reveals full configuration; no zoom level reveals telemetry in design.
- **Resting-hidden connected ports.** In design, connected ports are invisible at rest like every other port — the hit area stays live; hover, selection and the connect gesture reveal them. A compatible target now shows its ports alongside its indigo ring.
- **Shadow echo.** `--node-shadow` secondary offset lightened 12% → 7% (drag 12% → 8%): primary shadow structural, secondary a subtle echo — the node no longer reads as stacked cards. Dark theme already sat at 3%/4%.

## Graph paradigms

Canonical specification for the paradigm layer (v3, Sep 2026; promoted from the Workbench prototype's Paradigm Spec). Files: tokens/paradigms.css, components/graph/paradigms/ (GraphRegion + paradigms.css), guidelines/regions|sequence|state|trace.

### Overview

One graph world, five grammars. A paradigm is the grammar a document is drawn in; it decides what the nodes, edges and regions mean. It is orthogonal to the information lens (`mode="design|simulate|analyze"`) and to semantic zoom: switching one never changes the others.

- **Paradigm decides grammar, lens decides information.** Design / Simulate / Analyze apply identically to all five paradigms.
- **One construction.** GraphNode, GraphEdge and GraphRegion are the same components everywhere. Paradigms differ only through semantic attributes: `data-paradigm` on the canvas, `data-variant` on regions, `data-terminal` / `data-initial` / `data-side` on nodes, `data-run` on the trace layer. No paradigm introduces a second node or edge style.
- **Kind is doubled.** Colour never carries meaning alone; the uppercase kind word always accompanies it. The `failure` kind (danger triad, same construction) joins the graph kinds for bad terminal outcomes: failed, cancelled, expired, dead-letter.
- **Remove, never shrink.** Semantic zoom drops content per paradigm; text size is constant.
- **Telemetry layers on topology.** Every diagram stays legible with simulation off.
- **Motion is a request.** The trace layer is opt-in per surface; nothing else animates.
- **One document, one paradigm.** A GraphDocument is `{ version, id, title, paradigm, nodes[], edges[], regions[], metadata, view }`. Node `kind` is the paradigm type (service, approval, stream, waiting…) and maps to a graph kind triad; edge `relationship` is the paradigm edge kind and maps to one of the seven edge grammars. Lens state lives outside the document. Nothing converts between paradigms (lossy); pick the paradigm by the question, not the shape.

Taxonomy:

- Architecture — axis structure — "What exists, where does it live, and what is connected to what?" — region boundary — layered layout — queueing simulation.
- Workflow — axis process — "What steps happen, who owns them, where do decisions happen, and how can execution branch?" — region lane — lanes layout — token execution.
- Sequence — axis time — "Who calls whom, in what order, and what returns?" — region phase — timeline layout — deterministic timeline + playback.
- Data Flow — axis information — "Where does data originate, how is it transformed, where is it stored, and who consumes it?" — region stage — stages layout — queueing with buffers and lag.
- State Machine — axis lifecycle — "What states can an object occupy, and what events move it between them?" — region phase — ranked layout — Markov walk.

Paradigm chrome: the switcher is a compact `.tg-pswitch` popover (swatch · lowercase name · ▾) opening a `.tg-pmenu` of five rows (name · one-line ask · node count) — never five permanent tabs. The inspector is one shell with schema-driven fields (`.tg-fields` two-column grid, `.tg-field[data-half]` for numbers); section titles and metric nouns come from the paradigm. The library shows the paradigm's categories; non-node entries (sequence message types, "+ phase") are commands.

### Architecture

- Question: structure. Categories compute · network · data · messaging · reliability; types alias the graph kinds (compute→service, network→tool, data→database, messaging→queue, reliability→agent).
- Edges: http / grpc / sql → flow; queue / event → async; cdc / repl → dependency. Default http. Labels carry the contract (`POST /checkout`, `orders.created`); metric labels carry protocol + live rate.
- Regions: `boundary` — region · vpc · tier (`REGION · US-EAST-1`, `VPC · PRIVATE`). Nesting allowed; boundaries re-fit around members after layout. The tier overlay stays architecture-only.
- Design: free placement on the 16px grid. Simulate: load in req/s (100–100k), analytic queueing; HUD p99 · goodput · errors · dropped; node telemetry rate · % busy · p99 · queued. Packets animate on this paradigm only when the flow layer is on.
- Zoom: compact drops metric labels first, then contract labels at overview.

### Workflow

- Question: process. Categories actions · approvals · decisions · async · recovery · evidence. Kinds: action / manual task / handoff → service; approval / auto approval → queue; gate / decision → agent; async step / fork / join → tool; wait → queue; retry / recovery / escalation → input; evidence / observability → database with `side`; start → external; terminal → external with `terminal`; failed outcome → failure.
- Edges: next / if / approved / recover → flow; denied / fail / retry → dependency (alternate paths); async → async; evidence → proposed (side channel).
- Regions: `lane` — one per owner, full-width bands stacked vertically, label `LANE · NAME` top-left, owner right-aligned in faint mono, alternating 2% tint. Steps flow left → right by rank inside their lane; nodes snap into lanes.
- Design defaults: a connection out of a gate or approval defaults to `approved`; into a failed outcome defaults to `fail`. Side nodes render dashed, shadowless, behind the process.
- Simulate: runs/h (1–2000), token execution with pass rates and retry loops; HUD cycle p99 · completed · failed · in flight; node telemetry visits/h · % occupied · time in step · waiting. The trace layer follows one token.
- Analyze: unreachable steps, dead ends, approval bottlenecks, long waits as share of cycle time, gates without failure paths, rework loops, missing evidence, no terminal outcome.
- Zoom: overview hides evidence edges and fades side nodes to .45.

### Sequence

- Question: time. Participants (client → external, service, api → tool, auth → agent, cache / db → database, queue, external) are compact nodes across the top, positioned on x only. Time runs down in `--seq-row` 44px rows under a `--seq-head` 48px header.
- Primitives: lifelines are ONE shared SVG layer (`.tg-lifeline`, stone-300, 1px, 4-6 dash); activations are `--activation-w` 8px kind-tinted bars (`.tg-activation[data-kind]`); ticks are 9px faint mono (`.tg-seq-tick`); phase rules use the major grid colour (`.tg-seq-rule`).
- Messages reuse the edge grammar: request → flow (solid); response / error → dependency (7-5 dash, drawn back); async / callback / event → async (2-4 dash, no wait); retry / timeout → dependency, marked alternate. Self-messages loop out to the right. Arrow heads are the shared marker set. Messages skip the orthogonal router and overlap solver.
- Regions: `phase` — a range of message order (`from`–`to`) rendered as a horizontal band with a top hairline, not a free rectangle.
- Design: participants drag horizontally only; messages are added by arming a message type in the library and dragging between lifelines; `order` edits reorder; ↑/↓ step messages in time.
- Simulate: req/s (1–20k), deterministic timeline with slow-motion playback and a time cursor (`.tg-seq-cursor`); HUD roundtrip p99 · served · errors · timeouts; node telemetry calls · % busy · busy ms per request.
- Analyze: chatty pairs (≥3 calls), serial independent calls, dominant dependency, cache-miss fall-through, retry amplification, repeated auth, round-trip count.
- Zoom: message labels leave at compact; activations and ticks leave at overview and edges thicken to 2px so the topology still reads.

### Data Flow

- Question: information. Categories sources · streams · transforms · stores · consumers · governance. Kinds: source / producer → input; stream / topic / cdc → queue; transform / batch / enrichment → tool; warehouse / lake / database / feature store → database; dashboard / model / consumer → service; consent gate / PII vault → agent (governance); dead letter → external.
- Edges: event / stream / batch → async; transform / query → flow; replication / governed / replay / dead-letter → dependency; lineage → proposed. Default stream. Edges into a dead letter default to `dead-letter`; edges into or out of governance nodes default to `governed`.
- Regions: `stage` — vertical columns with a left hairline only, label `STAGE · NAME`, alternating 2% tint; datasets snap into stages. `zone` — governance boundary: dashed, 3% tint, label on the border, never a strong coloured panel. PII is a node flag (inspector check), not a colour.
- Simulate: events/s (10–200k), queueing with buffers, partitions and lag; HUD end-to-end p99 · delivered · errors · lagging; node telemetry events in · % busy · lag.
- Analyze: orphaned stores, unbounded retention, ungoverned PII reach, fan-out risk, consumer lag, streams without dead letter, duplicate transforms, lineage gaps.
- Zoom: compact drops metric labels; overview hides lineage edges.

### State Machine

- Question: lifecycle. Categories states · wait · approval · failure · terminal. Kinds: initial → external with `initial`; active / review → service; waiting / paused / needs approval → queue; blocked → agent; retrying / rolling back → input; completed → database with `terminal`; failed / cancelled / expired → failure with `terminal`.
- Marks: `initial` adds a ▶ prefix to the kind word; `terminal` adds a ■ suffix and an inner 1px hairline inset `--terminal-inset` 3px. Terminal states never have exits.
- Edges: event / guard / approved → flow; timeout / failure / retry / cancel / rollback → dependency (alternate). Self-transitions allowed. Edges into Expired / Cancelled default to `timeout` / `cancel`. Edge data carries event, guard, relative weight and timeout.
- Regions: `phase` — horizontal bands grouping states by lifecycle stage.
- Simulate: objects/h (1–5000), Markov walk over weighted transitions; HUD lifetime p99 · completed · bad exits · in flight; node telemetry entries/h · occupancy · dwell. The trace layer follows one object.
- Analyze: no initial, unreachable, dead ends, terminal with exits, active states without failure exit, waits without timeout, retry cycles, crowded states, bad-exit share.
- Zoom: at overview only terminal states keep their kind word; the topology reads from shape and marks.

### Shared GraphRegion

The one container across paradigms (`components/graph/paradigms/GraphRegion`, `.tg-region`). Regions are weaker than nodes: hierarchy is border > label > tint. Kind colours the hairline (45% mix into `--border-strong`) and the label (60% mix into `--text-muted`) only — never a fill beyond `--region-tint` 4% / `--region-tint-alt` 2%. `--region-border-w` 1px, label `--region-label-size` 9.5px uppercase mono tracked `--region-label-track` 0.1em, top-left; optional owner right-aligned in faint mono. Labels read `CONTEXT · NAME`. `pointer-events:none`; regions sit behind their nodes on the 16px grid.

- `boundary` — dashed enclosure, label sits ON the border with a canvas-coloured backing; nests (architecture).
- `lane` — full-width horizontal band, dashed top hairline only, `data-alt` alternates tint, min height `--lane-min-h` 144px (workflow).
- `stage` — vertical column, dashed left hairline only, alternating tint, min width `--stage-min-w` 272px (data flow).
- `phase` — horizontal band, top hairline only, min height `--phase-min-h` 160px (sequence, state).
- `zone` — dashed, 3% tint, label on the border (governance).
- `data-state="selected"` recolours the hairline indigo; nothing else changes. At overview the label steps to 15px (the counter-scale exception) and owners hide.
- GraphGroup remains as the neutral pre-paradigm container; new surfaces use GraphRegion with an explicit variant.

### Shared tracing

Run / trace is playback of ONE selected execution — a token through a workflow, an object through a state machine, one request through a sequence. It is opt-in per surface: `layers={{trace:true}}` → `data-layer-trace="on"` on the canvas, toggled by the user (`t`); never a default and never on more than one execution at once.

- Only position and the last transition move. `run="active"` node: 1.5px `--run-active` (selection indigo) outline at 3px offset, swatch turns indigo. Active edge: indigo, `--edge-w-active`, `--run-dash` 6-6 animated over `--run-dur` 0.8s with the selected arrow head. `run="done"` edges: `--run-done` (hover stone) with the hover head. `run="pending"` edges: opacity `--run-pending-opacity` .35. Sequences add a time cursor (`.tg-seq-cursor`, indigo 2-3 dash).
- Entity colour never changes; the layer sits on top of kind, health and selection.
- Zeroed under `prefers-reduced-motion` (active edge becomes solid indigo). Supersedes the v1 `state="trace"` edge, kept as an alias.
- Distinct from the flow layer (`data-layer-flow`), which reads throughput across many edges; trace reads one path.

### Shared semantic zoom

The four canvas levels are shared; each paradigm decides what leaves at each level. Remove, never shrink — text size is constant, except the documented counter-scale of node titles (20px) and region labels (15px) at overview.

- overview — silhouette + title, majors-only grid, health only if critical, region labels 15px. Workflow / data flow: evidence and lineage (proposed) edges hidden, side nodes fade. Sequence: labels, activations and ticks hidden, edges 2px. State: kind word hidden except on terminals.
- compact — + primary metric row, essential edges. Architecture / data flow: metric labels hidden. Sequence: message labels hidden.
- working — full anatomy and needed labels; everything except telemetry.
- detail — + telemetry, ports, inline actions; everything.

Grid density follows zoom (`--grid-canvas-major` at overview). Layer toggles (`data-layer-labels|metrics|flow|spark|grid|trace`) shed overlays independently of zoom.

### Shared performance contract

The graph-layer contract (Components section) applies unchanged to every paradigm; paradigms add no per-node or per-edge components.

- **No relational `:has()` on graph objects.** GraphEdge mirrors `data-rel` onto the `<g class="tg-edge-g">` as well as the path, so group-level rules (overview hiding of proposed edges) are direct attribute matches. A `:has()` per edge was a regression (Sep 2026) and is reverted.
- **Trace is inert in design.** The trace rules are gated on `.tg-gcanvas[data-layer-trace="on"]:not([data-mode="design"])` — one ancestor test — so stray `data-run` attributes cannot animate a design-mode canvas.

- One transformed viewport for pan/zoom; one shared SVG edge layer with one EdgeMarkerDefs; transparent 12px hit paths; pointer capture + rAF-coalesced pointermove; transform-based transient drag; memoized nodes; telemetry patched into the DOM without touching topology.
- Regions are absolutely positioned divs behind nodes with `pointer-events:none` — they cost no hit testing. Sequence lifelines, activations and ticks are one SVG layer, never per-message components; messages skip the channel router and overlap solver.
- Trace and flow layers are CSS attribute switches (`data-run`, `data-layer-*`), not re-renders; trace animates at most one edge, flow at most `--edge-flow-cap` 28.
- Layout (`layered` / `lanes` / `ranked` / `stages` / `timeline`) runs on request (`l`), never per frame: rank by longest path with back edges removed, barycentre ordering, 16px snap; band regions resize to content, boundaries re-fit around members.
- Budgets at preset scale: 16.7 ms pan frame, 8 ms telemetry pass, 250 ms commit. Semantic zoom + viewport culling beyond ~100 nodes; canvas/WebGL edges beyond ~500; sequence row windowing beyond ~300 messages is the known open item.
- No filters, blur or backdrop-filter on graph objects; hard box-shadows only; opacity/transform transitions only.

Tokens: `--region-*`, `--lane-min-h`, `--stage-min-w`, `--phase-min-h`, `--lifeline-*`, `--activation-w`, `--seq-*`, `--kind-failure-*`, `--terminal-*`, `--run-*` in tokens/paradigms.css.

## Components

Button, Select, TextInput, ZoomControl, Chip, KindBadge, SectionLabel, ErrorBanner, Panel, LogoMark, DiagramNode, GraphCanvas, GraphNode, NodePort, GraphEdge (+ EdgeMarkerDefs), GraphGroup, GraphToolbar (+ GraphToolbarSep), GraphInspector, GraphMinimap, GraphTelemetry, GraphRegion. Edge flow, endpoint handles and the edge card are CSS contracts (`.tg-edge-flow`, `.tg-edge-ends`, `.tg-ecard`) consumers render inside their own edge layer.

Performance contract for graph consumers: one transformed viewport for pan/zoom; one shared SVG edge layer + shared EdgeMarkerDefs; transparent 12px hit paths; pointer capture + rAF-coalesced pointermove, and touch-event pinch-zoom per Touch & pinch; transform-based transient drag (commit position on release); memoized nodes — never rerender the app per pointermove, never touch topology when telemetry changes; semantic zoom + viewport culling beyond ~100 nodes; evaluate canvas/WebGL edges beyond ~500. No filters, blur, or backdrop-filter on graph objects.

Migration: DiagramNode (.tg-node) is the legacy UML-only recreation — keep it for mermaid-style class diagrams; all new graph surfaces use GraphNode/GraphEdge and app-local graph CSS should be replaced by the `--graph-*`/`--node-*`/`--edge-*` tokens. GraphGroup is the neutral pre-paradigm container; new surfaces use GraphRegion with an explicit variant.

## Index

- styles.css — global entry; imports everything below
- tokens/ — fonts.css, colors.css, themes.css (dark), typography.css, spacing.css, motion.css, base.css, graph.css (core graph), paradigms.css (paradigm extensions)
- components/components.css — component class styles
- components/controls/ — Button, Select, TextInput, ZoomControl
- components/display/ — Chip, KindBadge, SectionLabel, ErrorBanner
- components/surfaces/ — Panel, LogoMark
- components/diagram/ — DiagramNode
- components/graph/ — Graph layer · core: GraphCanvas, GraphNode, NodePort, GraphEdge, GraphGroup, GraphToolbar, GraphInspector, GraphMinimap, GraphTelemetry + graph.css (see tokens/graph.css)
- components/graph/paradigms/ — Graph layer · paradigm extensions: GraphRegion + paradigms.css (see tokens/paradigms.css)
- guidelines/ — foundation specimen cards (type, colors, spacing, brand)
- guidelines/regions/ — GraphRegion boundary, lane, stage + zone specimens
- guidelines/sequence/ — lifelines, activations, message grammar
- guidelines/state/ — initial / terminal marks, failure triad
- guidelines/trace/ — run / trace layer
- assets/logo.svg — the brand mark
- ui_kits/typegram/ — interactive recreation of the app screen
- SKILL.md — agent skill entry point

## Package · `@typegram/graph`

This directory is the canonical, versioned design system (`package.json` · `CHANGELOG.md`).
Consumers import CSS through the package's `exports` — `tokens/*.css`, `components/*.css`,
`components/graph/*.css`, `components/graph/paradigms/*.css` — never by relative path, and never
copy a token value. The Graph Layer is documented in `docs/graph-paradigm.md` with live specimens
for all five paradigms and three lenses in `docs/specimens/` (`pnpm specimens` regenerates them
from Workbench's renderer). `components/graph/telemetry.css` holds the telemetry · channel · health
· annotation · semantic-zoom rules; nothing that styles a graph primitive lives outside this package.
