// Paradigm simulators. Same output contract as engine.tick so the Workbench patches telemetry
// into the DOM identically for every paradigm. Architecture and Data Flow use the queueing
// engine. Workflow is a token execution model, Sequence a deterministic timeline with a
// playback cursor, State a Markov walk. Random-call ORDER is the prototype's (goldens depend on it).
import type { GraphEdge, GraphNode, ParadigmId } from '../model/document';
import { PARADIGMS } from '../paradigms/registry';
import type { EdgeKindDef, NodeTypeDef } from '../paradigms/types';
import type { Health, Metrics, NodeStat, ParadigmSim, Run, RunState, SysStat, Timeline } from './types';

const SPEED = { workflow: 20, state: 30 }; // simulated minutes per real second
const health = (util: number, err: number): Health => err > 0.2 || util > 1 ? 'crit' : util > 0.72 || err > 0.05 ? 'warn' : 'ok';
const ema = (prev: number | undefined, v: number, a: number): number => prev == null ? v : prev + (v - prev) * a;
const pct = (arr: number[], p: number): number => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]!; };
const jitter = (): number => 0.55 + Math.random() * 0.9;
const EMPTY_T: NodeTypeDef = { label: '', cat: '', family: 'stone', icon: '' };
const EMPTY_E: EdgeKindDef = { label: '', rel: 'flow', desc: '' };

export function makeParadigmSim(pid: ParadigmId): ParadigmSim {
  return { pid, t: 0, acc: 0, runs: [], done: [], edgeN: {}, nodeN: {}, dwell: {}, doneN: 0, badN: 0, rate: {}, hist: [], cursor: 0, track: null, noise: Math.random() * 10 };
}

interface G { byId: Record<string, GraphNode>; outs: Record<string, GraphEdge[]>; ins: Record<string, GraphEdge[]> }
function graph(nodes: GraphNode[], edges: GraphEdge[]): G {
  const byId: Record<string, GraphNode> = {}, outs: Record<string, GraphEdge[]> = {}, ins: Record<string, GraphEdge[]> = {};
  nodes.forEach(n => { byId[n.id] = n; outs[n.id] = []; ins[n.id] = []; });
  edges.forEach(e => { if (byId[e.from] && byId[e.to]) { outs[e.from]!.push(e); ins[e.to]!.push(e); } });
  return { byId, outs, ins };
}
const pushHist = (sim: ParadigmSim, sys: SysStat): void => { sim.hist.push({ t: Date.now(), ...sys }); if (sim.hist.length > 140) sim.hist.shift(); };

// ---------------- workflow: token execution ----------------
export function tickWorkflow(sim: ParadigmSim, nodes: GraphNode[], edges: GraphEdge[], ratePerHour: number, dt: number): Metrics {
  const T = PARADIGMS.workflow, { byId, outs, ins } = graph(nodes, edges);
  const min = dt * SPEED.workflow, hrs = min / 60;
  sim.t += min;
  const ty = (n: GraphNode): NodeTypeDef => T.TYPES[n.type] ?? EMPTY_T;
  const ek = (e: GraphEdge): EdgeKindDef => T.EDGES[e.kind] ?? EMPTY_E;
  const side = (n: GraphNode): boolean => !!ty(n).side;
  const sources = nodes.filter(n => ty(n).source || (!ins[n.id]!.length && !side(n) && !ty(n).terminal));
  const durOf = (n: GraphNode): number => (n.dur != null ? n.dur : ty(n).dur || 0);
  const passOf = (n: GraphNode): number => { const t = ty(n); return n.pass != null ? n.pass : t.pass == null ? 1 : t.pass; };
  // arrivals
  if (sources.length && nodes.length) {
    sim.acc += ratePerHour * hrs;
    let k = Math.floor(sim.acc); sim.acc -= k;
    if (sim.runs.length > 600) k = 0; // bounded population
    for (let i = 0; i < k; i++) { const s = sources[i % sources.length]!; sim.runs.push({ at: s.id, left: durOf(s) * jitter(), t: 0, retries: 0, hops: 0, last: null }); sim.nodeN[s.id] = (sim.nodeN[s.id] || 0) + 1; }
  }
  const visits: Record<string, number> = {}, fails: Record<string, number> = {}, edgeHits: Record<string, number> = {}, spawned: Run[] = [];
  const stepRun = (r: Run): void => {
    for (let guard = 0; guard < 12 && r.left <= 0; guard++) {
      const n = byId[r.at]; if (!n) { r.dead = 1; return; }
      const t = ty(n);
      const all = outs[n.id]!.filter(e => !ek(e).side);
      outs[n.id]!.forEach(e => { if (ek(e).side) edgeHits[e.id] = (edgeHits[e.id] || 0) + 1; });
      if (t.terminal || !all.length) { r.dead = 1; r.bad = !!t.bad; return; }
      if (t.fork && all.length > 1) {
        // one token continues, the rest are spawned (bounded)
        all.slice(1).forEach(e => { if (sim.runs.length + spawned.length < 800) spawned.push({ at: e.to, left: durOf(byId[e.to]!) * jitter(), t: r.t, retries: r.retries ?? 0, hops: r.hops + 1, last: e.id }); edgeHits[e.id] = (edgeHits[e.id] || 0) + 1; });
        const e = all[0]!; edgeHits[e.id] = (edgeHits[e.id] || 0) + 1; r.at = e.to; r.left += durOf(byId[e.to]!) * jitter(); r.hops++; r.last = e.id; visits[e.to] = (visits[e.to] || 0) + 1; continue;
      }
      const alt = all.filter(e => ek(e).alt), main = all.filter(e => !ek(e).alt);
      const ok = Math.random() < passOf(n);
      if (!ok) fails[n.id] = (fails[n.id] || 0) + 1;
      const pool = ok ? (main.length ? main : alt) : (alt.length ? alt : main);
      const e = pool[Math.floor(Math.random() * pool.length)]!;
      if (e.kind === 'retry' || e.kind === 'fail' || e.kind === 'deny') r.retries = (r.retries ?? 0) + 1;
      edgeHits[e.id] = (edgeHits[e.id] || 0) + 1;
      r.at = e.to; r.hops++; r.last = e.id; visits[e.to] = (visits[e.to] || 0) + 1;
      r.left += durOf(byId[e.to]!) * jitter();
      if (r.hops > 60) { r.dead = 1; r.bad = true; return; }
    }
  };
  sim.runs.forEach(r => { r.left -= min; r.t += min; if (r.left <= 0) stepRun(r); });
  const finished = sim.runs.filter(r => r.dead);
  finished.forEach(r => { sim.done.push(r.t); if (r.bad) sim.badN++; sim.doneN++; });
  if (sim.done.length > 300) sim.done.splice(0, sim.done.length - 300);
  sim.runs = sim.runs.filter(r => !r.dead).concat(spawned);
  // per-node stats
  const stats: Record<string, NodeStat> = {}, occ: Record<string, number> = {};
  sim.runs.forEach(r => occ[r.at] = (occ[r.at] || 0) + 1);
  const a = Math.min(1, dt * 0.35);
  nodes.forEach(n => {
    const t = ty(n), v = (visits[n.id] || 0) / Math.max(hrs, 1e-6);
    sim.rate[n.id] = ema(sim.rate[n.id], v, a);
    const cap = n.cap != null ? n.cap : (t.human ? 6 : t.terminal || t.source ? 1e9 : 40);
    const active = occ[n.id] || 0;
    const fr = visits[n.id] ? (fails[n.id] || 0) / visits[n.id]! : 0;
    sim.dwell[n.id] = ema(sim.dwell[n.id], fr, a);
    const util = cap >= 1e9 ? 0 : active / cap;
    stats[n.id] = { arr: sim.rate[n.id] || 0, util: Math.min(1.4, util), lat: durOf(n), q: active, err: sim.dwell[n.id] || 0, health: t.terminal ? 'ok' : health(util, t.bad ? 0 : sim.dwell[n.id] || 0) };
  });
  const er: Record<string, number> = {};
  edges.forEach(e => { sim.edgeN[e.id] = ema(sim.edgeN[e.id], (edgeHits[e.id] || 0) / Math.max(hrs, 1e-6), a); er[e.id] = sim.edgeN[e.id] || 0; });
  const doneRate = ema(sim.doneRate, finished.length / Math.max(hrs, 1e-6), a); sim.doneRate = doneRate;
  const p50 = pct(sim.done, 0.5), p95 = pct(sim.done, 0.95), p99 = pct(sim.done, 0.99);
  const err = sim.doneN ? sim.badN / sim.doneN : 0;
  const sys: SysStat = { rps: ratePerHour, goodput: doneRate * (1 - err), p50, p95, p99, err, qtot: sim.runs.length, drop: sim.runs.length, sat: Math.max(0, ...nodes.map(n => stats[n.id]!.util)) };
  pushHist(sim, sys);
  const run = trackRun(sim);
  return { nodes: stats, edges: er, sys, run };
}

// the traced execution: one run followed until it finishes, then the next
function trackRun(sim: ParadigmSim): RunState | null {
  if (sim.track && !sim.runs.includes(sim.track)) sim.track = null;
  if (!sim.track && sim.runs.length) sim.track = sim.runs[Math.floor(Math.random() * sim.runs.length)]!;
  if (!sim.track) return null;
  const r: RunState = { node: sim.track.at, edge: sim.track.last, t: sim.track.t };
  if (sim.track.retries != null) r.retries = sim.track.retries;
  return r;
}

// ---------------- state machine: markov walk ----------------
export function tickState(sim: ParadigmSim, nodes: GraphNode[], edges: GraphEdge[], ratePerHour: number, dt: number): Metrics {
  const T = PARADIGMS.state, { byId, outs, ins } = graph(nodes, edges);
  const min = dt * SPEED.state, hrs = min / 60;
  sim.t += min;
  const ty = (n: GraphNode | undefined): NodeTypeDef => (n && T.TYPES[n.type]) ?? EMPTY_T;
  const ek = (e: GraphEdge): EdgeKindDef => T.EDGES[e.kind] ?? EMPTY_E;
  const dwellOf = (n: GraphNode): number => (n.dwell != null ? n.dwell : ty(n).dwell || 0);
  const initials = nodes.filter(n => ty(n).initial || (!ins[n.id]!.length && !ty(n).terminal));
  if (initials.length) {
    sim.acc += ratePerHour * hrs;
    let k = Math.floor(sim.acc); sim.acc -= k;
    if (sim.runs.length > 800) k = 0;
    for (let i = 0; i < k; i++) { const s = initials[i % initials.length]!; sim.runs.push({ at: s.id, left: dwellOf(s) * jitter(), t: 0, hops: 0, last: null }); }
  }
  const entries: Record<string, number> = {}, badExit: Record<string, number> = {}, exits: Record<string, number> = {}, edgeHits: Record<string, number> = {};
  sim.runs.forEach(r => {
    r.left -= min; r.t += min;
    for (let g = 0; g < 12 && r.left <= 0 && !r.dead; g++) {
      const n = byId[r.at]; if (!n) { r.dead = 1; break; }
      const t = ty(n), all = outs[n.id]!;
      if (t.terminal || !all.length) { r.dead = 1; r.bad = !!t.bad; break; }
      let tot = 0; all.forEach(e => tot += (e.p == null ? 1 : e.p));
      let x = Math.random() * tot, e = all[all.length - 1]!;
      for (const c of all) { x -= (c.p == null ? 1 : c.p); if (x <= 0) { e = c; break; } }
      exits[n.id] = (exits[n.id] || 0) + 1;
      if (ek(e).bad || ty(byId[e.to]).bad) badExit[n.id] = (badExit[n.id] || 0) + 1;
      edgeHits[e.id] = (edgeHits[e.id] || 0) + 1;
      r.at = e.to; r.hops++; r.last = e.id; entries[e.to] = (entries[e.to] || 0) + 1;
      r.left += dwellOf(byId[e.to]!) * jitter();
      if (r.hops > 80) { r.dead = 1; r.bad = true; }
    }
  });
  const finished = sim.runs.filter(r => r.dead);
  finished.forEach(r => { sim.done.push(r.t); if (r.bad) sim.badN++; sim.doneN++; });
  if (sim.done.length > 300) sim.done.splice(0, sim.done.length - 300);
  sim.runs = sim.runs.filter(r => !r.dead);
  const occ: Record<string, number> = {}; sim.runs.forEach(r => occ[r.at] = (occ[r.at] || 0) + 1);
  const a = Math.min(1, dt * 0.35), stats: Record<string, NodeStat> = {};
  nodes.forEach(n => {
    const t = ty(n);
    sim.rate[n.id] = ema(sim.rate[n.id], (entries[n.id] || 0) / Math.max(hrs, 1e-6), a);
    const bad = exits[n.id] ? (badExit[n.id] || 0) / exits[n.id]! : null;
    if (bad != null) sim.dwell[n.id] = ema(sim.dwell[n.id], bad, a);
    const cap = n.cap != null ? n.cap : t.cap || 1e9, q = occ[n.id] || 0;
    const util = cap >= 1e9 ? 0 : q / cap;
    stats[n.id] = { arr: sim.rate[n.id] || 0, util: Math.min(1.4, util), lat: dwellOf(n), q, err: sim.dwell[n.id] || 0, health: t.terminal ? 'ok' : health(util, (sim.dwell[n.id] || 0) * 0.5) };
  });
  const er: Record<string, number> = {}; edges.forEach(e => { sim.edgeN[e.id] = ema(sim.edgeN[e.id], (edgeHits[e.id] || 0) / Math.max(hrs, 1e-6), a); er[e.id] = sim.edgeN[e.id] || 0; });
  sim.doneRate = ema(sim.doneRate, finished.length / Math.max(hrs, 1e-6), a);
  const err = sim.doneN ? sim.badN / sim.doneN : 0;
  const sys: SysStat = { rps: ratePerHour, goodput: sim.doneRate * (1 - err), p50: pct(sim.done, 0.5), p95: pct(sim.done, 0.95), p99: pct(sim.done, 0.99), err, qtot: sim.runs.length, drop: sim.runs.length, sat: Math.max(0, ...nodes.map(n => stats[n.id]!.util)) };
  pushHist(sim, sys);
  return { nodes: stats, edges: er, sys, run: trackRun(sim) };
}

// ---------------- sequence: deterministic timeline + playback cursor ----------------
export function timeline(edges: GraphEdge[]): Timeline<GraphEdge> {
  const T = PARADIGMS.sequence;
  const msgs = edges.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0));
  let t = 0; const out: Timeline<GraphEdge>['msgs'] = [];
  msgs.forEach(e => {
    const d = T.EDGES[e.kind] ?? EMPTY_E, lat = e.lat == null ? 0 : +e.lat;
    const start = t; if (!d.nowait) t += lat;
    out.push({ id: e.id, start, end: d.nowait ? start + Math.max(lat, 1) : t, lat, e });
  });
  return { msgs: out, total: t };
}
export function tickSequence(sim: ParadigmSim, nodes: GraphNode[], edges: GraphEdge[], rps: number, dt: number): Metrics {
  const T = PARADIGMS.sequence, tl = timeline(edges);
  sim.t += dt;
  const busy: Record<string, number> = {}, inbound: Record<string, number> = {}, bad: Record<string, number> = {}, calls: Record<string, number> = {};
  tl.msgs.forEach(m => {
    const d = T.EDGES[m.e.kind] ?? EMPTY_E;
    busy[m.e.to] = (busy[m.e.to] || 0) + m.lat; inbound[m.e.to] = (inbound[m.e.to] || 0) + 1;
    if (!d.back) calls[m.e.to] = (calls[m.e.to] || 0) + 1;
    if (d.bad) bad[m.e.to] = (bad[m.e.to] || 0) + 1;
  });
  const stats: Record<string, NodeStat> = {}; let sat = 0;
  const wob = 0.96 + 0.08 * Math.sin(sim.noise + sim.t);
  nodes.forEach(n => {
    const t = T.TYPES[n.type] ?? EMPTY_T, conc = n.conc != null ? n.conc : t.conc || 1e9;
    const b = busy[n.id] || 0, util = conc >= 1e9 ? 0 : (rps * b / 1000) / conc;
    const err = inbound[n.id] ? (bad[n.id] || 0) / inbound[n.id]! : 0;
    stats[n.id] = { arr: rps * (calls[n.id] || 0), util: Math.min(1.4, util * wob), lat: b, q: inbound[n.id] || 0, err, health: health(util, err) };
    sat = Math.max(sat, util);
  });
  const er: Record<string, number> = {}; tl.msgs.forEach(m => er[m.id] = rps);
  const queueing = sat > 0.8 ? 1 + (sat - 0.8) * 6 : 1;
  const nBad = tl.msgs.filter(m => (T.EDGES[m.e.kind] ?? EMPTY_E).bad).length, nReq = Math.max(1, tl.msgs.filter(m => m.e.kind === 'request').length);
  const err = Math.min(0.5, nBad / nReq * 0.15), timeouts = tl.msgs.filter(m => m.e.kind === 'timeout').length;
  const p50 = tl.total * queueing;
  const sys: SysStat = { rps, goodput: rps * (1 - err), p50, p95: p50 * 1.35, p99: p50 * 1.7, err, qtot: tl.msgs.length, drop: rps * err * (timeouts ? 1 : 0.2), sat };
  pushHist(sim, sys);
  // playback cursor: one request replayed in slow motion (≈ 60 ms of request time per real second… scaled to the total)
  const span = Math.max(tl.total, 40) * 1.35;
  sim.cursor = (sim.cursor + dt * span / 6) % span;
  let active: string | null = null; const done: Record<string, 1> = {};
  tl.msgs.forEach(m => { if (m.end <= sim.cursor) done[m.id] = 1; else if (m.start <= sim.cursor && !active) active = m.id; });
  return { nodes: stats, edges: er, sys, run: { edge: active, done, cursor: sim.cursor, total: tl.total }, tl };
}
