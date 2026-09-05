// ---- analysis: annotations over the architecture, never a second screen (WB 1649–1810) ----
import type { GraphEdge, GraphNode } from '../model/document';
import { PARADIGMS } from '../paradigms/registry';
import { fmt, fmtMs } from '../sim/format';
import type { Metrics, NodeStat } from '../sim/types';
import { ORD, mkAdd, type Analysis, type Finding } from './types';

export const COST: Record<string, number> = { compute: 140, net: 90, data: 260, msg: 120, rel: 40 };

export interface ArchInput { nodes: GraphNode[]; edges: GraphEdge[]; metrics: Metrics | null; rps: number }

export function adjOut(edges: GraphEdge[]): Record<string, GraphEdge[]> { const a: Record<string, GraphEdge[]> = {}; edges.forEach(e => (a[e.from] || (a[e.from] = [])).push(e)); return a; }
export function sourceIds(nodes: GraphNode[], edges: GraphEdge[]): string[] {
  const hasIn: Record<string, 1> = {}; edges.forEach(e => hasIn[e.to] = 1);
  const src = nodes.filter(n => n.type === 'client' || !hasIn[n.id]).map(n => n.id);
  if (src.length || !nodes.length) return src;
  return [nodes.reduce((a, b) => b.x < a.x ? b : a).id];
}
export function reachFrom(nodes: GraphNode[], edges: GraphEdge[], skip: string | null): Record<string, 1> {
  const out = adjOut(edges), seen: Record<string, 1> = {}, q = sourceIds(nodes, edges).filter(id => id !== skip);
  q.forEach(id => seen[id] = 1);
  for (let i = 0; i < q.length; i++) (out[q[i]!] || []).forEach(e => { if (e.to !== skip && !seen[e.to]) { seen[e.to] = 1; q.push(e.to); } });
  return seen;
}
// the chain that actually feeds a node: at each hop take the heaviest inbound edge
export function heaviestPathTo(edges: GraphEdge[], m: Metrics | null, id: string): string[] {
  const inE: Record<string, GraphEdge[]> = {}; edges.forEach(e => (inE[e.to] || (inE[e.to] = [])).push(e));
  const ids: string[] = [], seen: Record<string, 1> = {}; let cur: string | undefined = id;
  while (cur && !seen[cur]) {
    seen[cur] = 1;
    const list: GraphEdge[] = (inE[cur] || []).filter(e => !seen[e.from]);
    if (!list.length) break;
    const rate = (e: GraphEdge): number => m ? m.edges[e.id] || 0 : 0;
    const best: GraphEdge = list.reduce((a: GraphEdge, b: GraphEdge) => rate(b) > rate(a) ? b : a);
    ids.push(best.id); cur = best.from;
  }
  return ids;
}

export interface ArchAnalysis { list: Finding[]; cost: number; headroom: number }
export function analyzeArch(s: ArchInput): ArchAnalysis {
  const T = PARADIGMS.architecture, m = s.metrics;
  if (!s.nodes.length) return { list: [], cost: 0, headroom: 0 };
  const nById: Record<string, GraphNode> = {}; s.nodes.forEach(n => nById[n.id] = n);
  const inD: Record<string, number> = {}, outD: Record<string, number> = {};
  s.edges.forEach(e => { if (!nById[e.from] || !nById[e.to]) return; outD[e.from] = (outD[e.from] || 0) + 1; inD[e.to] = (inD[e.to] || 0) + 1; });
  const F: Finding[] = [], add = mkAdd(F);
  const st = (id: string): NodeStat | null => (m && m.nodes[id]) || null;
  const util = (id: string): number => { const x = st(id); return x ? x.util : 0; };
  const capOf = (n: GraphNode): number => (n.ms ?? 0) > 0 ? ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / (n.ms ?? 1) : 0;
  const catOf = (n: GraphNode): string => T.TYPES[n.type]?.cat ?? '';
  const inst = (n: GraphNode): number => n.inst ?? 1;
  const ranked = s.nodes.filter(n => n.type !== 'client').sort((a, b) => util(b.id) - util(a.id));
  const top = ranked[0];
  if (m && top && util(top.id) > 0.68) {
    const x = st(top.id)!, need = Math.max(0, Math.ceil(inst(top) * x.util / 0.6) - inst(top));
    add({ cat: 'bottleneck', sev: x.util > 0.9 ? 'crit' : 'warn', mark: 'bottleneck', nodeId: top.id,
      title: top.name + ' is the bottleneck',
      detail: Math.round(x.util * 100) + '% busy · p99 ' + fmtMs(x.lat * 2.2) + ' · ' + fmt(x.q) + ' queued',
      rec: need ? 'add ' + need + ' instance' + (need > 1 ? 's' : '') + ' → ' + Math.round(x.util * inst(top) / (inst(top) + need) * 100) + '% busy' : 'cut the ' + top.ms + ' ms service time or raise concurrency',
      edges: heaviestPathTo(s.edges, m, top.id) });
  }
  ranked.slice(0, 5).forEach(n => {
    const x = st(n.id); if (!x || (top && n.id === top.id) || x.util <= 0.78) return;
    add({ cat: 'capacity', sev: 'warn', mark: 'at capacity', nodeId: n.id, title: n.name + ' is near capacity',
      detail: fmt(x.arr) + '/s arriving against ' + (capOf(n) ? fmt(capOf(n)) + '/s' : 'unbounded') + ' capacity',
      rec: 'scale to ' + Math.ceil(inst(n) * x.util / 0.6) + ' instances' });
  });
  s.nodes.forEach(n => { const x = st(n.id); if (x && x.err > 0.02) add({ cat: 'capacity', sev: 'crit', mark: 'shedding', nodeId: n.id, title: n.name + ' is shedding requests', detail: (x.err * 100).toFixed(1) + '% of arrivals fail or time out here', rec: 'add capacity, or buffer the caller behind a queue' }); });
  const before = reachFrom(s.nodes, s.edges, null);
  s.nodes.forEach(n => {
    if (inst(n) > 1 || n.type === 'client' || !inD[n.id]) return;
    const after = reachFrom(s.nodes, s.edges, n.id);
    const lost = Object.keys(before).filter(k => k !== n.id && !after[k]);
    if (!lost.length) return;
    const x = st(n.id), share = x && m ? x.arr / Math.max(1, m.sys.rps) : 0;
    add({ cat: 'spof', sev: share > 0.3 || lost.length > 2 ? 'crit' : 'warn', mark: 'single point', nodeId: n.id, nodes: lost,
      title: n.name + ' is a single point of failure',
      detail: 'one instance · ' + lost.length + ' component' + (lost.length > 1 ? 's' : '') + ' unreachable if it fails' + (share > 0.02 ? ' · carries ' + Math.round(share * 100) + '% of traffic' : ''),
      rec: n.type === 'sql' || n.type === 'nosql' ? 'add a replica and fail reads over' : 'run 2+ instances behind a balancer' });
  });
  s.nodes.forEach(n => {
    const x = st(n.id); if (!x || inst(n) < 2 || x.util > 0.12) return;
    const to = Math.max(1, Math.ceil(inst(n) * Math.max(x.util, 0.02) / 0.5));
    if (to >= inst(n)) return;
    add({ cat: 'idle', sev: 'info', mark: 'idle', nodeId: n.id, title: n.name + ' is over-provisioned',
      detail: inst(n) + ' instances holding ' + Math.round(x.util * 100) + '% utilisation',
      rec: 'reduce to ' + to + ' · ~$' + ((inst(n) - to) * (COST[catOf(n)] || 60)) + '/mo back' });
  });
  s.nodes.filter(n => n.type === 'sql' || n.type === 'nosql').forEach(db => {
    const readers = s.edges.filter(e => e.to === db.id && nById[e.from] && (e.kind === 'query' || e.kind === 'http' || e.kind === 'grpc'));
    if (!readers.length) return;
    if (readers.some(e => s.edges.some(x => x.from === e.from && nById[x.to] && nById[x.to]!.type === 'cache'))) return;
    add({ cat: 'arch', sev: 'warn', mark: 'uncached', nodeId: db.id, title: 'uncached read path into ' + db.name,
      detail: readers.length + ' caller' + (readers.length > 1 ? 's' : '') + ' query it directly · every read pays full latency',
      rec: 'put a cache in front of ' + db.name, edges: readers.map(e => e.id), nodes: readers.map(e => e.from).concat([db.id]) });
  });
  interface Chain { len: number; edges: string[]; names: string[]; nodes: string[] }
  const sync: Record<string, 1> = { http: 1, grpc: 1, query: 1 }, outE = adjOut(s.edges), memo: Record<string, Chain> = {}, onStack: Record<string, number> = {};
  const walk = (id: string): Chain => {
    const mm = memo[id]; if (mm) return mm;
    if (onStack[id]) return { len: 0, edges: [], names: [], nodes: [] };
    onStack[id] = 1;
    let best: Chain = { len: 1, edges: [], names: [nById[id] ? nById[id]!.name : id], nodes: [id] };
    (outE[id] || []).forEach(e => {
      if (!sync[e.kind] || !nById[e.to]) return;
      const r = walk(e.to);
      if (r.len + 1 > best.len) best = { len: r.len + 1, edges: [e.id, ...r.edges], names: [nById[id]!.name, ...r.names], nodes: [id, ...(r.nodes || [])] };
    });
    onStack[id] = 0; memo[id] = best; return best;
  };
  let chain: Chain = { len: 0, edges: [], names: [], nodes: [] }, chainHead: string | null = null;
  s.nodes.forEach(n => { const r = walk(n.id); if (r.len > chain.len) { chain = r; chainHead = n.id; } });
  if (chain.len >= 5) add({ cat: 'arch', sev: 'warn', mark: 'deep chain', nodeId: chainHead,
    title: 'synchronous chain is ' + chain.len + ' hops deep',
    detail: chain.names.slice(0, 4).join(' → ') + (chain.names.length > 4 ? ' → …' : '') + ' · latency and failure compound',
    rec: 'break the tail off behind a queue', edges: chain.edges, nodes: chain.nodes });
  s.nodes.filter(n => n.type === 'queue' || n.type === 'broker' || n.type === 'pubsub').forEach(q => {
    const consumers = s.edges.filter(e => e.from === q.id && nById[e.to]);
    if (!consumers.length) return;
    if (s.edges.some(e => (e.from === q.id || e.to === q.id) && nById[e.from] && nById[e.to] && (nById[e.to]!.type === 'dlq' || nById[e.from]!.type === 'dlq'))) return;
    add({ cat: 'arch', sev: 'info', mark: 'no dlq', nodeId: q.id, title: q.name + ' has no dead-letter path',
      detail: consumers.length + ' consumer' + (consumers.length > 1 ? 's' : '') + ' · a poison message retries forever',
      rec: 'attach a dead letter queue' });
  });
  s.nodes.filter(n => !inD[n.id] && !outD[n.id]).forEach(n => add({ cat: 'arch', sev: 'info', mark: 'unlinked', nodeId: n.id, title: n.name + ' is not connected', detail: 'no relationships · it carries no traffic', rec: 'wire it into the topology or remove it' }));
  let cost = 0; const byCat: Record<string, number> = {};
  s.nodes.forEach(n => { const c = catOf(n), v = inst(n) * (COST[c] || 60); cost += v; byCat[c] = (byCat[c] || 0) + v; });
  const topCat = Object.keys(byCat).sort((a, b) => byCat[b]! - byCat[a]!)[0];
  if (topCat && cost && byCat[topCat]! / cost > 0.5) add({ cat: 'cost', sev: 'info', mark: '', nodeId: null,
    title: (T.CATS[topCat]?.label ?? topCat).toLowerCase() + ' is ' + Math.round(byCat[topCat]! / cost * 100) + '% of estimated spend',
    detail: '$' + byCat[topCat] + ' of $' + cost + ' per month across ' + s.nodes.filter(n => catOf(n) === topCat).length + ' components', rec: '' });
  let headroom = 0, firstOut: GraphNode | null = null;
  if (m) {
    let best = 99;
    ranked.forEach(n => { const u = util(n.id); if (u <= 0.01) return; const fac = 0.85 / u; if (fac < best) { best = fac; firstOut = n; } });
    headroom = best === 99 ? 0 : best;
    const fo = firstOut as GraphNode | null;
    if (fo && headroom && headroom < 2.2) add({ cat: 'scale', sev: headroom < 1 ? 'warn' : 'info', mark: '', nodeId: fo.id,
      title: 'headroom is ' + headroom.toFixed(1) + '× current load',
      detail: fo.name + ' saturates near ' + fmt(s.rps * headroom) + ' req/s',
      rec: 'scale ' + fo.name + ' before the next traffic step' });
  }
  F.sort((a, b) => ORD[a.sev] - ORD[b.sev]);
  return { list: F.slice(0, 9), cost, headroom };
}

/** the architecture analysis with its two footer numbers */
export function analyzeArchitecture(s: ArchInput): Analysis {
  const a = analyzeArch(s);
  return { list: a.list, a: { label: 'headroom', value: a.headroom ? (a.headroom >= 6 ? '6×+' : a.headroom.toFixed(1) + '×') : '—' }, b: { label: 'est', value: '$' + (a.cost >= 1000 ? (a.cost / 1000).toFixed(1) + 'k' : a.cost) + '/mo' } };
}
