# The Graph Paradigm

Typegram's Graph Layer draws one graph world through five grammars and three lenses. The
grammar decides what the nodes, edges and regions *mean*; the lens decides what information the
same drawing carries. Nothing changes shape when the lens changes.

## Five paradigms

| paradigm | axis | nodes | edges | regions |
| --- | --- | --- | --- | --- |
| architecture | dependency | components (compute · data · messaging · networking · reliability) | contracts: http · grpc · query · queue · event … | tier bands (derived) · boundaries |
| workflow | ownership | steps · approvals · gates · terminals | next · fail · deny · retry (+ side: evidence) | lanes — structural owners |
| sequence | time | participants (lifelines) | messages, ordered by `seq`, with latency | phases — ranges of messages |
| data flow | information | sources · streams · transforms · stores · consumers · governance | movements: event · stream · batch · query … | stages |
| state machine | lifecycle | states (initial · active · wait · terminal, bad or good) | transitions: event [guard] / action, with probability | phases |

Every node carries a semantic **kind** (`data-kind`, always printed in uppercase next to the title)
and a visual **family** (`data-family`: indigo · emerald · amber · purple · cyan · orange · stone ·
danger). Only the family drives colour; the word always ships with it.

## Three lenses

| lens | `data-mode` | what appears |
| --- | --- | --- |
| design | `design` | drafting: kind · title · configuration rows · ports · region labels |
| simulate | `simulate` | + telemetry: rate and unit, node p99, queue, sparkline, health dot and tone, packet flow on edges, edge rate text, run cursor |
| analyze | `analyze` | + findings: severity annotations on nodes (`.tg-ann[data-sev]`), highlighted evidence paths (`.tg-hl`), muted objects outside the focus |

## Semantic zoom

`data-zoom="overview | compact | working | detail"` on the canvas changes *density*, never text
scale: overview keeps the silhouette and title, compact adds the primary metric, working the full
anatomy, detail the telemetry block, ports and inline actions (`components/graph/telemetry.css`).

## The DOM contract

The renderer emits, and the package styles, exactly these attributes — renaming one is a visual
regression:

- canvas `.tg-gcanvas[data-paradigm][data-mode][data-zoom][data-touch][data-layer-trace][data-o-*][data-chan]`
- node `.tg-gnode[data-kind][data-family][data-state][data-health][data-terminal][data-initial][data-side][data-form][data-run][data-density]` with `.tg-gnode-hd · -kind · -title · -body · -row · -tel · -status`, `.tg-hdot`, `.tg-spark`, `.tg-ann`
- ports `.tg-port[data-side][data-state]`
- edges `g.tg-edge-g[data-rel]` → `.tg-edge-hit · .tg-edge[data-state][data-weight][data-health][data-run][data-msg] · .tg-packets · .tg-erate · .tg-edge-label[data-role]`, `.tg-hl`, `.tg-chan`
- regions `.tg-region[data-variant][data-family][data-alt][data-dashed][data-state]`
- sequence layer `.tg-lifeline · .tg-seq-rule · .tg-seq-tick · .tg-activation · .tg-seq-cursor`

## Live specimens

`docs/specimens/index.html` — every paradigm × lens, rendered by Workbench's renderer and frozen
with the package CSS only. Regenerate with `pnpm specimens` against a running preview.
