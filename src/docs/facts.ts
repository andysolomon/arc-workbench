// The numbers the System designs page states, derived from the example documents and the same
// engines the Workbench simulates them with. Nothing here is typed by hand: change a preset and
// the page changes with it (tests/unit/docs-facts.test.ts pins the headline figures).
import type { GraphEdge, GraphNode, ParadigmId } from '../model/document';
import { EXAMPLES, PARADIGMS, toDocument, type Example } from '../paradigms';
import { makeSim, tick, timeline } from '../sim';
import { encodeDocument } from '../app/share';

export interface CapacityRow { id: string; name: string; type: string; inst: number; cap: number; ms: number; max: number; util: number; err: number }
export interface QueueFacts { kind: 'queueing'; rps: number; rows: CapacityRow[]; first: { name: string; at: number } | null; health: 'ok' | 'warn' | 'crit'; errors: number }
export interface FlowFacts { kind: 'execution'; path: string[]; minutes: number; yieldShare: number; rework: number; owners: number }
export interface TimelineFacts { kind: 'timeline'; total: number; messages: number; async: number; slowest: { label: string; lat: number; share: number } | null }
export interface MarkovFacts { kind: 'markov'; outcomes: Array<{ name: string; share: number; bad: boolean }>; humanGates: number }
export type Facts = QueueFacts | FlowFacts | TimelineFacts | MarkovFacts;

const DT = 0.25;
/** steady state of the queueing engine at a constant load (noise phase pinned so runs agree) */
export function steady(nodes: GraphNode[], edges: GraphEdge[], rps: number, includeAsync = false): ReturnType<typeof tick> {
  const sim = makeSim();
  sim.noise = 0;
  let m = tick(sim, nodes, edges, rps, DT, { includeAsync });
  for (let i = 0; i < 240; i++) m = tick(sim, nodes, edges, rps, DT, { includeAsync });
  return m;
}
const capacityOf = (n: GraphNode): number => ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / (n.ms ?? 1);

function queueing(pid: ParadigmId, ex: Example): QueueFacts {
  const async = pid === 'dataflow';
  const T = PARADIGMS[pid].TYPES;
  const atLoad = steady(ex.nodes, ex.edges, ex.rps, async);
  // below saturation utilization is linear in load, so a light probe finds where the first node tips over
  const probe = steady(ex.nodes, ex.edges, 100, async);
  let first: QueueFacts['first'] = null;
  for (const n of ex.nodes) {
    const u = probe.nodes[n.id]?.util ?? 0;
    if (u > 0 && (!first || 100 / u < first.at)) first = { name: n.name, at: 100 / u };
  }
  const rows = ex.nodes
    .filter((n) => (n.ms ?? 0) > 0)
    .map((n) => ({ id: n.id, name: n.name, type: T[n.type]?.label ?? n.type, inst: n.inst ?? 1, cap: n.cap ?? 1, ms: n.ms ?? 0, max: capacityOf(n), util: atLoad.nodes[n.id]?.util ?? 0, err: atLoad.nodes[n.id]?.err ?? 0 }))
    .sort((a, b) => b.util - a.util);
  const healths = ex.nodes.map((n) => atLoad.nodes[n.id]?.health ?? 'ok');
  const health = healths.includes('crit') ? 'crit' : healths.includes('warn') ? 'warn' : 'ok';
  return { kind: 'queueing', rps: ex.rps, rows, first, health, errors: atLoad.sys.err };
}

function execution(ex: Example): FlowFacts {
  const E = PARADIGMS.workflow.EDGES;
  const T = PARADIGMS.workflow.TYPES;
  const into = new Set(ex.edges.map((e) => e.to));
  const byId = new Map(ex.nodes.map((n) => [n.id, n]));
  let at = ex.nodes.find((n) => !into.has(n.id)) ?? ex.nodes[0];
  const path: GraphNode[] = [];
  const seen = new Set<string>();
  while (at && !seen.has(at.id)) {
    seen.add(at.id);
    path.push(at);
    const next = ex.edges.find((e) => e.from === at?.id && !E[e.kind]?.alt && !E[e.kind]?.side && !seen.has(e.to));
    at = next ? byId.get(next.to) : undefined;
  }
  const minutes = path.reduce((s, n) => s + (n.dur ?? T[n.type]?.dur ?? 0), 0);
  const yieldShare = path.reduce((s, n) => s * (n.pass ?? T[n.type]?.pass ?? 1), 1);
  const rework = ex.edges.filter((e) => E[e.kind]?.alt).length;
  const owners = new Set(ex.nodes.map((n) => n.owner).filter(Boolean)).size;
  return { kind: 'execution', path: path.map((n) => n.name), minutes, yieldShare, rework, owners };
}

function timed(ex: Example): TimelineFacts {
  const E = PARADIGMS.sequence.EDGES;
  const tl = timeline(ex.edges);
  const sync = tl.msgs.filter((m) => !E[m.e.kind]?.nowait);
  const slow = sync.reduce<(typeof sync)[number] | null>((a, m) => (!a || m.lat > a.lat ? m : a), null);
  return {
    kind: 'timeline',
    total: tl.total,
    messages: tl.msgs.length,
    async: tl.msgs.length - sync.length,
    slowest: slow ? { label: slow.e.label ?? slow.e.kind, lat: slow.lat, share: tl.total ? slow.lat / tl.total : 0 } : null,
  };
}

/** where a run ends up: the transition weights as a Markov chain, iterated until the mass settles */
function markov(ex: Example): MarkovFacts {
  const T = PARADIGMS.state.TYPES;
  const outs = new Map<string, GraphEdge[]>();
  for (const e of ex.edges) outs.set(e.from, [...(outs.get(e.from) ?? []), e]);
  let mass = new Map<string, number>();
  const start = ex.nodes.find((n) => T[n.type]?.initial) ?? ex.nodes[0];
  if (start) mass.set(start.id, 1);
  const done = new Map<string, number>();
  for (let step = 0; step < 4000; step++) {
    const next = new Map<string, number>();
    for (const [id, m] of mass) {
      const list = outs.get(id) ?? [];
      const total = list.reduce((s, e) => s + (e.p ?? 1), 0);
      if (!list.length || !total) {
        done.set(id, (done.get(id) ?? 0) + m);
        continue;
      }
      for (const e of list) next.set(e.to, (next.get(e.to) ?? 0) + (m * (e.p ?? 1)) / total);
    }
    mass = next;
    if ([...mass.values()].reduce((s, v) => s + v, 0) < 1e-9) break;
  }
  const outcomes = ex.nodes
    .filter((n) => T[n.type]?.terminal)
    .map((n) => ({ name: n.name, share: done.get(n.id) ?? 0, bad: !!T[n.type]?.bad }))
    .sort((a, b) => b.share - a.share);
  return { kind: 'markov', outcomes, humanGates: ex.nodes.filter((n) => T[n.type]?.human).length };
}

export function factsOf(pid: ParadigmId, ex: Example): Facts {
  const model = PARADIGMS[pid].sim;
  if (model === 'execution') return execution(ex);
  if (model === 'timeline') return timed(ex);
  if (model === 'markov') return markov(ex);
  return queueing(pid, ex);
}

export function exampleOf(pid: ParadigmId, id: string): Example {
  const ex = EXAMPLES[pid].find((e) => e.id === id);
  if (!ex) throw new Error(`no ${pid} example ${id}`);
  return ex;
}

/** a Workbench share link that opens this exact document */
export function workbenchHref(pid: ParadigmId, ex: Example): string {
  const doc = toDocument(pid, ex.name, { nodes: ex.nodes, edges: ex.edges, regions: ex.regions, rps: ex.rps, view: { x: 0, y: 0, k: 1 } });
  return '../#d=' + encodeDocument({ ...doc, id: 'docs-' + ex.id });
}
