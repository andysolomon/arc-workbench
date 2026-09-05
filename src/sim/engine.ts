// Analytic queueing approximation, ticked ~4Hz. Not discrete-event; tuned for plausible live behavior.
// Paradigm-neutral since v8: a node's queueing ROLE (source | buffer | limiter | work) is read from
// n.role when the paradigm sets it (data flow), else derived from the architecture type.
import type { GraphEdge, GraphNode } from '../model/document';
import type { Metrics, NodeStat, QueueSim } from './types';

const ASYNC: Record<string, 1> = { queue: 1, event: 1, cdc: 1, repl: 1, stream: 1, batch: 1, replay: 1, deadletter: 1, replication: 1, lineage: 1 };
const BUF: Record<string, 1> = { queue: 1, broker: 1, pubsub: 1, dlq: 1 };
export type Role = 'source' | 'buffer' | 'limiter' | 'work';
export function roleOf(n: Pick<GraphNode, 'role' | 'type'>): Role { return (n.role as Role | undefined) || (n.type === 'client' ? 'source' : BUF[n.type] ? 'buffer' : n.type === 'limiter' ? 'limiter' : 'work'); }

export function makeSim(): QueueSim { return { q: {}, retry: {}, hist: [], noise: Math.random() * 100 }; }

/** max throughput of a capacity node: inst · cap · 1000 / ms, unbounded when ms ≤ 0 */
const maxThrOf = (n: GraphNode): number => (n.ms ?? 0) > 0 ? ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / (n.ms ?? 1) : Infinity;

export function tick(sim: QueueSim, nodes: GraphNode[], edges: GraphEdge[], rps: number, dt: number): Metrics {
  const byId: Record<string, GraphNode> = {}; nodes.forEach(n => byId[n.id] = n);
  const outs: Record<string, GraphEdge[]> = {}, indeg: Record<string, number> = {};
  nodes.forEach(n => { outs[n.id] = []; indeg[n.id] = 0; });
  edges.forEach(e => { if (byId[e.from] && byId[e.to]) { outs[e.from]!.push(e); indeg[e.to] = (indeg[e.to] ?? 0) + 1; } });
  // topo order (Kahn), cycles dropped
  const order = nodes.filter(n => indeg[n.id] === 0).map(n => n.id);
  const seen: Record<string, 1> = {}; order.forEach(id => seen[id] = 1);
  for (let i = 0; i < order.length; i++) (outs[order[i]!] ?? []).forEach(e => { indeg[e.to] = (indeg[e.to] ?? 0) - 1; if (!indeg[e.to] && !seen[e.to]) { seen[e.to] = 1; order.push(e.to); } });
  nodes.forEach(n => { if (!seen[n.id]) order.push(n.id); });

  const arr: Record<string, number> = {}, isAsync: Record<string, 1> = {}, edgeRate: Record<string, number> = {};
  nodes.forEach(n => { arr[n.id] = 0; });
  const srcs = nodes.filter(n => roleOf(n) === 'source');
  srcs.forEach(c => arr[c.id] = (arr[c.id] ?? 0) + rps * (c.share != null ? c.share : 1 / srcs.length));
  const stats: Record<string, NodeStat> = {};
  const wob = (t: number): number => 0.96 + 0.08 * Math.sin(sim.noise + t);
  sim.noise += dt * 2.1;

  for (const id of order) {
    const n = byId[id]!, role = roleOf(n);
    const a = (arr[id] ?? 0) * (sim.retry[id] || 1);
    const maxThr = maxThrOf(n);
    const rho = maxThr === Infinity ? 0 : a / maxThr;
    // queue nodes buffer; others shed/degrade
    let q = sim.q[id] || 0;
    if (role === 'buffer') {
      const drain = Math.min(...(outs[id] ?? []).map(e => maxThrOf(byId[e.to]!)), Infinity);
      q = Math.max(0, q + (a - (drain === Infinity ? a : drain)) * dt);
    } else if (rho > 1) q = Math.min(50000, q + (a - maxThr) * dt);
    else q = Math.max(0, q - maxThr * 0.25 * dt);
    sim.q[id] = q;
    const rhoC = Math.min(rho, 0.965);
    const ms = n.ms ?? 0;
    let lat = ms > 0 ? ms / (1 - rhoC) : 0;
    if (rho > 1 && ms > 0) lat += (q / maxThr) * 1000;
    lat = Math.min(lat, 30000) * wob(id.length);
    const cap = n.cap ?? 0;
    const limiterShed = role === 'limiter' && a > cap ? 1 - cap / a : 0;
    const err = limiterShed || (rho > 1.02 ? Math.min(0.85, (rho - 1) * 0.55 + (q > 8000 ? 0.15 : 0)) : rho > 0.9 ? (rho - 0.9) * 0.08 : 0);
    // retry pressure builds on saturated sync nodes, decays otherwise
    const target = !ASYNC[n.type] && rho > 1 ? 1 + Math.min(1.6, (rho - 1) * 1.4) : 1;
    sim.retry[id] = (sim.retry[id] || 1) + ((target - (sim.retry[id] || 1)) * Math.min(1, dt * 1.4));
    const served = Math.min(a, maxThr) * (1 - limiterShed);
    stats[id] = { arr: a, util: Math.min(rho, 1.4), lat, q, err, async: !!isAsync[id],
      health: err > 0.05 || rho > 1 ? 'crit' : rho > 0.72 || err > 0.005 ? 'warn' : 'ok' };
    (outs[id] ?? []).forEach(e => {
      const r = (ASYNC[e.kind] ? a : served) * e.w;
      edgeRate[e.id] = (edgeRate[e.id] || 0) + r;
      arr[e.to] = (arr[e.to] ?? 0) + r;
      if (ASYNC[e.kind] || isAsync[id]) isAsync[e.to] = 1;
    });
  }
  nodes.forEach(n => { stats[n.id]!.async = !!isAsync[n.id]; });

  // system view: latency over sync request path (visit-weighted)
  let lsum = 0, esum = 0, wsum = 0;
  nodes.forEach(n => { const s = stats[n.id]!; if (!s.async && s.arr > 0.5) { const v = Math.min(1.2, s.arr / Math.max(rps, 1)); lsum += s.lat * v; esum += s.err * v; wsum += v; } });
  const p50 = lsum, err = Math.min(0.98, wsum ? esum / Math.max(1, wsum * 0.7) : 0);
  const sat = Math.max(0, ...nodes.map(n => stats[n.id]!.util));
  const goodput = rps * (1 - err);
  const sys = { rps, goodput, p50, p95: p50 * (1.7 + sat * 0.8), p99: p50 * (2.3 + sat * 2.2), err, qtot: nodes.reduce((s, n) => s + stats[n.id]!.q, 0), sat, drop: Math.max(0, rps - goodput) };
  sim.hist.push({ t: Date.now(), ...sys });
  if (sim.hist.length > 140) sim.hist.shift();
  return { nodes: stats, edges: edgeRate, sys };
}
