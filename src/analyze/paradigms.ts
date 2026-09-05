// Analyze lens for the four non-architecture paradigms. Pure functions over the flat document
// plus the latest metrics snapshot; same finding shape the architecture analyzer emits.
import type { GraphEdge, GraphNode, GraphRegion, ParadigmId } from '../model/document';
import { PARADIGMS } from '../paradigms/registry';
import type { EdgeKindDef, NodeTypeDef } from '../paradigms/types';
import { timeline } from '../sim/paradigms';
import type { Metrics, NodeStat } from '../sim/types';
import { isWarm, nodeLag, p99Text, samplesOf } from '../sim/metrics';
import { fmt } from '../sim/format';
import { laneOf } from '../layout/lanes';
import { finish, mkAdd, type Analysis, type Finding } from './types';

interface G { byId: Record<string, GraphNode>; outs: Record<string, GraphEdge[]>; ins: Record<string, GraphEdge[]> }
const graph = (nodes: GraphNode[], edges: GraphEdge[]): G => {
  const byId: Record<string, GraphNode> = {}, outs: Record<string, GraphEdge[]> = {}, ins: Record<string, GraphEdge[]> = {};
  nodes.forEach(n => { byId[n.id] = n; outs[n.id] = []; ins[n.id] = []; });
  edges.forEach(e => { if (byId[e.from] && byId[e.to]) { outs[e.from]!.push(e); ins[e.to]!.push(e); } });
  return { byId, outs, ins };
};
const reach = (starts: string[], outs: Record<string, GraphEdge[]>, filter?: (e: GraphEdge) => boolean): Record<string, 1> => { const seen: Record<string, 1> = {}, q = starts.slice(); q.forEach(id => seen[id] = 1); for (let i = 0; i < q.length; i++) (outs[q[i]!] || []).forEach(e => { if ((!filter || filter(e)) && !seen[e.to]) { seen[e.to] = 1; q.push(e.to); } }); return seen; };
/** the analyzer's own minute format (differs from sim/format fmtMin on purpose — PORT-NOTES §4.6) */
const fmtMin = (v: number): string => v >= 60 ? (v / 60).toFixed(1) + 'h' : Math.round(v) + 'm';
const EMPTY_T: NodeTypeDef = { label: '', cat: '', family: 'stone', icon: '' };
const EMPTY_E: EdgeKindDef = { label: '', rel: 'flow', desc: '' };
const name = (byId: Record<string, GraphNode>, id: string): string => byId[id]?.name ?? id;

export { laneOf };
export function ownerOf(n: GraphNode, regions: GraphRegion[] | undefined): string | null { const l = laneOf(n, regions); return l ? (l.owner || l.label) : (n.owner || null); }
export interface Handoff { e: GraphEdge; from: GraphRegion; to: GraphRegion; boundary: boolean; back: boolean }
// edges whose two ends sit in different lanes; `boundary` when either lane is an ownership boundary
export function handoffs(nodes: GraphNode[], edges: GraphEdge[], regions: GraphRegion[] | undefined): Handoff[] {
  const byId: Record<string, GraphNode> = {}; nodes.forEach(n => byId[n.id] = n);
  const T = PARADIGMS.workflow, out: Handoff[] = [];
  edges.forEach(e => {
    const a = byId[e.from], b = byId[e.to]; if (!a || !b || (T.EDGES[e.kind] ?? EMPTY_E).side) return;
    const la = laneOf(a, regions), lb = laneOf(b, regions); if (!la || !lb || la.id === lb.id) return;
    out.push({ e, from: la, to: lb, boundary: la.ownerKind === 'boundary' || lb.ownerKind === 'boundary', back: !!(T.EDGES[e.kind] ?? EMPTY_E).alt });
  });
  return out;
}

export function analyzeWorkflow(nodes: GraphNode[], edges: GraphEdge[], m: Metrics | null, regions: GraphRegion[] | undefined): Analysis {
  const T = PARADIGMS.workflow, { byId, outs, ins } = graph(nodes, edges), F: Finding[] = [], add = mkAdd(F);
  const ty = (n: GraphNode): NodeTypeDef => T.TYPES[n.type] ?? EMPTY_T, ek = (e: GraphEdge): EdgeKindDef => T.EDGES[e.kind] ?? EMPTY_E, st = (id: string): NodeStat | undefined => m?.nodes[id];
  const nm = (id: string): string => name(byId, id);
  // ownership: handoffs, boundary crossings, ownerless steps
  const lanes = (regions || []).filter(r => r.variant === 'lane');
  if (lanes.length) {
    const H = handoffs(nodes, edges, regions), owners: Record<string, 1> = {}; lanes.forEach(l => owners[l.owner || l.label] = 1);
    const nOwn = Object.keys(owners).length;
    if (H.length) add({ cat: 'own', sev: H.length > nOwn * 2 ? 'warn' : 'info', mark: '', nodeId: null, title: H.length + ' handoff' + (H.length > 1 ? 's' : '') + ' across ' + nOwn + ' owner' + (nOwn > 1 ? 's' : ''), detail: H.slice(0, 3).map(h => nm(h.e.from) + ' → ' + nm(h.e.to) + ' (' + (h.from.owner || h.from.label) + ' → ' + (h.to.owner || h.to.label) + ')').join(' · '), rec: 'every handoff is a wait and a context switch · merge lanes or move steps to the owner already holding the work', edges: H.map(h => h.e.id) });
    lanes.filter(l => l.ownerKind === 'boundary').forEach(l => {
      const into = H.filter(h => h.to.id === l.id), backOut = H.filter(h => h.from.id === l.id && h.back);
      const viaApproval = into.filter(h => ty(byId[h.e.to]!).human);
      if (into.length > 1) add({ cat: 'own', sev: 'warn', mark: 'boundary', nodeId: viaApproval[0] ? viaApproval[0].e.to : into[0]!.e.to, title: (viaApproval.length ? 'approval' : 'work') + ' crosses the ' + (l.owner || l.label) + ' boundary ' + into.length + ' times', detail: into.map(h => nm(h.e.from) + ' → ' + nm(h.e.to)).join(' · '), rec: 'a boundary should be crossed once per run · consolidate the entry point or move the check inside the requesting lane', edges: into.map(h => h.e.id) });
      if (backOut.length) add({ cat: 'own', sev: 'info', mark: '', nodeId: null, title: 'rework leaves the ' + (l.owner || l.label) + ' boundary ' + backOut.length + ' time' + (backOut.length > 1 ? 's' : ''), detail: backOut.map(h => nm(h.e.from) + ' → ' + nm(h.e.to) + ' (' + (h.to.owner || h.to.label) + ')').join(' · '), rec: 'each denial re-enters another owner\'s queue · state what must be true before the boundary is entered', edges: backOut.map(h => h.e.id) });
    });
    // bounce: A → B → A between two owners within three steps
    const bounce = H.filter(h => H.some(k => k.from.id === h.to.id && k.to.id === h.from.id && k.e.from === h.e.to));
    if (bounce.length) add({ cat: 'own', sev: 'info', mark: '', nodeId: null, title: 'work bounces between ' + (bounce[0]!.from.owner || bounce[0]!.from.label) + ' and ' + (bounce[0]!.to.owner || bounce[0]!.to.label), detail: bounce.slice(0, 2).map(h => nm(h.e.from) + ' → ' + nm(h.e.to) + ' → back').join(' · '), rec: 'a round trip between owners is usually one step in the wrong lane', edges: bounce.map(h => h.e.id) });
    const orphan = nodes.filter(n => !ty(n).side && !ty(n).source && !ty(n).terminal && !laneOf(n, regions));
    if (orphan.length) add({ cat: 'own', sev: 'warn', mark: 'no owner', nodeId: orphan[0]!.id, title: orphan.length + ' step' + (orphan.length > 1 ? 's have' : ' has') + ' no owning lane', detail: orphan.map(n => n.name).slice(0, 4).join(' · '), rec: 'drag the step into a lane, or add a lane for its owner', nodes: orphan.map(n => n.id) });
  }
  const sources = nodes.filter(n => ty(n).source || (!ins[n.id]!.length && !ty(n).side && !ty(n).terminal));
  const seen = reach(sources.map(n => n.id), outs);
  nodes.forEach(n => { if (!seen[n.id] && !ty(n).side && !ty(n).source) add({ cat: 'reach', sev: 'warn', mark: 'unreachable', nodeId: n.id, title: n.name + ' cannot be reached', detail: 'no path from a start step leads here', rec: 'connect it, or remove the dead step' }); });
  nodes.forEach(n => { const t = ty(n); if (t.terminal || t.side || t.source) return; if (!outs[n.id]!.filter(e => !ek(e).side).length) add({ cat: 'dead', sev: 'crit', mark: 'dead path', nodeId: n.id, title: n.name + ' is a dead end', detail: 'work arrives and never leaves · no terminal outcome', rec: 'add a next step or a terminal outcome' }); });
  // approvals: longest waits, share of time
  const totalDur = nodes.reduce((s, n) => s + (n.dur != null ? n.dur : ty(n).dur || 0), 0) || 1;
  nodes.filter(n => ty(n).human || n.type === 'wait').forEach(n => {
    const d = n.dur != null ? n.dur : ty(n).dur || 0, s = st(n.id);
    if (d / totalDur > 0.35) add({ cat: 'wait', sev: d / totalDur > 0.55 ? 'crit' : 'warn', mark: 'long wait', nodeId: n.id, title: n.name + ' holds ' + Math.round(d / totalDur * 100) + '% of cycle time', detail: fmtMin(d) + ' expected wait' + (s ? ' · ' + s.q + ' waiting now' : ''), rec: 'set an SLA, add approvers, or auto-approve low-risk changes', evidence: [{ metric: 'expected wait', scope: n.name + ' · document', value: fmtMin(d) }, ...(s ? [{ metric: 'waiting', scope: n.name + ' · instant', value: String(s.q) }] : [])] });
    if (s && s.util > 0.85) add({ cat: 'wait', sev: s.util > 1 ? 'crit' : 'warn', mark: 'approval bottleneck', nodeId: n.id, title: n.name + ' is the approval bottleneck', detail: s.q + ' items waiting for ' + (n.cap != null ? n.cap : 6) + ' approvers', rec: 'add approvers or parallelise the review', evidence: [{ metric: 'waiting', scope: n.name + ' · instant', value: String(s.q) }, { metric: 'occupancy', scope: n.name + ' · instant', value: Math.round(s.util * 100) + '%' }] });
  });
  // gates without failure handling; high failure rate
  nodes.forEach(n => {
    const t = ty(n), p = n.pass != null ? n.pass : t.pass == null ? 1 : t.pass; if (p >= 1) return;
    const alt = outs[n.id]!.filter(e => ek(e).alt);
    if (!alt.length) add({ cat: 'fail', sev: 'crit', mark: 'unhandled', nodeId: n.id, title: n.name + ' has no failure path', detail: Math.round((1 - p) * 100) + '% of runs fail here and fall through as success', rec: 'add a fail / deny / retry transition' });
    const s = st(n.id);
    if (s && s.err > 0.25) add({ cat: 'fail', sev: 'warn', mark: 'high retry', nodeId: n.id, title: n.name + ' fails ' + Math.round(s.err * 100) + '% of the time', detail: 'rework loops back upstream · every retry re-pays the earlier steps', rec: 'move the check earlier or make it cheaper', edges: alt.map(e => e.id), evidence: [{ metric: 'fail share', scope: n.name + ' · smoothed', value: Math.round(s.err * 100) + '%' }] });
  });
  // retry cycles
  const cyc: GraphEdge[] = [];
  edges.forEach(e => { if (ek(e).alt && reach([e.to], outs)[e.from]) cyc.push(e); });
  if (cyc.length > 2) add({ cat: 'loop', sev: 'info', mark: '', nodeId: null, title: cyc.length + ' rework loops in the process', detail: cyc.map(e => nm(e.from) + ' → ' + nm(e.to)).slice(0, 3).join(' · '), rec: 'each loop is a place work can circulate indefinitely', edges: cyc.map(e => e.id) });
  // observability
  const hasEv = nodes.some(n => ty(n).side);
  const prodLike = nodes.filter(n => /release|deploy|prod|publish/i.test(n.name));
  if (!hasEv && nodes.length > 3) add({ cat: 'obs', sev: 'info', mark: 'no evidence', nodeId: prodLike[0] ? prodLike[0].id : null, title: 'no evidence or observability step', detail: 'nothing records what happened and why', rec: 'attach an evidence node to the release step' });
  // terminal outcomes
  const terms = nodes.filter(n => ty(n).terminal);
  if (!terms.length && nodes.length > 2) add({ cat: 'dead', sev: 'warn', mark: '', nodeId: null, title: 'no terminal outcome', detail: 'runs have nowhere to end', rec: 'add a Terminal or Failed outcome' });
  const inflight = m ? m.sys.qtot : 0;
  return finish(F, { label: 'cycle p99', value: p99Text('workflow', m) }, { label: 'in flight', value: m ? String(inflight) : '—' });
}

export function analyzeSequence(nodes: GraphNode[], edges: GraphEdge[], _m: Metrics | null): Analysis {
  const T = PARADIGMS.sequence, { byId } = graph(nodes, edges), F: Finding[] = [], add = mkAdd(F);
  const ek = (e: GraphEdge): EdgeKindDef => T.EDGES[e.kind] ?? EMPTY_E, nm = (id: string): string => name(byId, id);
  const tl = timeline(edges), total = tl.total || 1;
  const pair: Record<string, GraphEdge[]> = {}; tl.msgs.forEach(x => { const d = ek(x.e); if (d.back) return; const k = x.e.from + '|' + x.e.to; (pair[k] = pair[k] || []).push(x.e); });
  Object.keys(pair).forEach(k => { const l = pair[k]!; if (l.length >= 3) add({ cat: 'chatty', sev: l.length >= 5 ? 'crit' : 'warn', mark: 'chatty', nodeId: l[0]!.to, title: nm(l[0]!.from) + ' calls ' + nm(l[0]!.to) + ' ' + l.length + ' times', detail: 'each call is a network round trip', rec: 'batch into one request or a single bulk endpoint', edges: l.map(e => e.id), nodes: [l[0]!.from, l[0]!.to] }); });
  // sequential independent calls from the same caller
  for (let i = 0; i < tl.msgs.length - 1; i++) {
    const a = tl.msgs[i]!.e, b = tl.msgs[i + 1]!.e;
    if (a.kind === 'request' && b.kind === 'request' && a.from === b.from && a.to !== b.to) {
      add({ cat: 'parallel', sev: 'info', mark: 'parallelisable', nodeId: a.from, title: nm(a.from) + ' issues two independent calls in series', detail: (a.label || nm(a.to)) + ' then ' + (b.label || nm(b.to)) + ' · ' + ((a.lat ?? 0) + (b.lat ?? 0)) + ' ms serial', rec: 'fan out concurrently · saves ~' + Math.min(a.lat ?? 0, b.lat ?? 0) + ' ms', edges: [a.id, b.id] });
    }
  }
  // slow dependency
  const slow = tl.msgs.filter(x => !ek(x.e).nowait).sort((p, q) => q.lat - p.lat)[0];
  if (slow && slow.lat / total > 0.4) add({ cat: 'latency', sev: slow.lat / total > 0.6 ? 'crit' : 'warn', mark: 'dominant', nodeId: slow.e.to, title: nm(slow.e.to) + ' is ' + Math.round(slow.lat / total * 100) + '% of the round trip', detail: (slow.e.label || 'call') + ' · ' + slow.lat + ' ms of ' + Math.round(total) + ' ms', rec: 'cache the result or move it off the request path', edges: [slow.id], evidence: [{ metric: 'latency', scope: (slow.e.label || nm(slow.e.to)) + ' · document', value: slow.lat + ' ms' }, { metric: 'critical path', scope: 'system · document', value: Math.round(total) + ' ms' }] });
  // cache inefficiency
  const miss = tl.msgs.find(x => /miss/i.test(x.e.label || '')), cacheNodes = nodes.filter(n => n.type === 'cache');
  if (miss && cacheNodes.length) { const after = tl.msgs.filter(x => x.start >= miss.end && x.e.kind === 'request' && byId[x.e.to] && byId[x.e.to]!.type === 'db'); if (after.length) add({ cat: 'cache', sev: 'info', mark: 'miss path', nodeId: miss.e.from, title: 'cache miss falls through to the database', detail: after.map(x => x.lat + ' ms').join(' + ') + ' extra on a miss', rec: 'warm the cache or raise the TTL for this key', edges: [miss.id].concat(after.map(x => x.id)) }); }
  // retries / timeouts
  const bad = tl.msgs.filter(x => ek(x.e).alt);
  if (bad.length) add({ cat: 'retry', sev: bad.some(x => x.e.kind === 'timeout') ? 'warn' : 'info', mark: 'amplification', nodeId: bad[0]!.e.to, title: bad.length + ' retry / timeout / error message' + (bad.length > 1 ? 's' : ''), detail: 'each retry multiplies load on ' + nm(bad[0]!.e.to), rec: 'bound retries and add jitter', edges: bad.map(x => x.id) });
  // auth overhead
  const auth = tl.msgs.filter(x => byId[x.e.to] && byId[x.e.to]!.type === 'auth');
  if (auth.length > 1) add({ cat: 'auth', sev: 'info', mark: 'auth overhead', nodeId: auth[0]!.e.to, title: 'authentication is checked ' + auth.length + ' times', detail: auth.reduce((s, x) => s + x.lat, 0) + ' ms of the path', rec: 'verify once at the edge and pass claims downstream', edges: auth.map(x => x.id) });
  // round trips
  const rt = tl.msgs.filter(x => x.e.kind === 'request').length;
  if (rt >= 6) add({ cat: 'trips', sev: 'info', mark: '', nodeId: null, title: rt + ' synchronous round trips per request', detail: Math.round(total) + ' ms critical path', rec: 'target ≤ 4 · collapse hops behind a gateway' });
  return finish(F, { label: 'critical path', value: Math.round(total) + ' ms' }, { label: 'round trips', value: String(rt) });
}

export function analyzeDataflow(nodes: GraphNode[], edges: GraphEdge[], m: Metrics | null): Analysis {
  const T = PARADIGMS.dataflow, { byId, outs, ins } = graph(nodes, edges), F: Finding[] = [], add = mkAdd(F);
  const ty = (n: GraphNode | undefined): NodeTypeDef => (n && T.TYPES[n.type]) ?? EMPTY_T, ek = (e: GraphEdge): EdgeKindDef => T.EDGES[e.kind] ?? EMPTY_E, st = (id: string): NodeStat | undefined => m?.nodes[id];
  // orphaned data: stores with no consumer
  nodes.filter(n => ty(n).cat === 'sto').forEach(n => { if (!outs[n.id]!.length) add({ cat: 'orphan', sev: 'warn', mark: 'orphaned', nodeId: n.id, title: n.name + ' has no consumer', detail: 'data lands here and is never read', rec: 'attach a consumer or stop writing it' }); });
  // unbounded retention
  nodes.filter(n => (ty(n).cat === 'sto' || ty(n).cat === 'str') && (n.retention === 0)).forEach(n => add({ cat: 'retention', sev: n.pii ? 'crit' : 'info', mark: 'unbounded', nodeId: n.id, title: n.name + ' keeps data forever', detail: 'retention 0 = unbounded' + (n.pii ? ' · contains PII' : ''), rec: 'set a retention window' }));
  // PII leakage: PII reaches a non-governance node without crossing a governed edge or gate
  const piiSrc = nodes.filter(n => n.pii && !ty(n).gov);
  const govd = reach(piiSrc.map(n => n.id), outs, e => !ek(e).gov && !ty(byId[e.to]).gov && !(ty(byId[e.from]).gov));
  const leaks = nodes.filter(n => govd[n.id] && !n.pii && !ty(n).gov && ty(n).cat !== 'src' && n.type !== 'producer');
  // only flag paths that carry identity: the source must itself be PII-marked and the path ungoverned
  leaks.forEach(n => { if (ty(n).cat === 'con' || ty(n).cat === 'sto') add({ cat: 'pii', sev: 'warn', mark: 'pii reach', nodeId: n.id, title: n.name + ' can receive ungoverned PII', detail: 'a PII-marked source reaches it without a consent gate or governed edge', rec: 'strip identity upstream or route through the consent gate', nodes: piiSrc.map(x => x.id).concat([n.id]) }); });
  if (piiSrc.length && !nodes.some(n => ty(n).gov)) add({ cat: 'pii', sev: 'crit', mark: 'no governance', nodeId: piiSrc[0]!.id, title: 'PII sources with no governance boundary', detail: piiSrc.map(n => n.name).join(', '), rec: 'add a consent gate and a PII vault' });
  // fan-out risk
  nodes.forEach(n => { if (outs[n.id]!.length >= 4) add({ cat: 'fanout', sev: 'info', mark: 'fan-out', nodeId: n.id, title: n.name + ' fans out to ' + outs[n.id]!.length + ' consumers', detail: 'schema changes here break every downstream', rec: 'publish a versioned contract', edges: outs[n.id]!.map(e => e.id) }); });
  // consumer lag / backpressure from the queueing metrics
  nodes.forEach(n => { const s = st(n.id); if (!s) return; if (s.util > 0.9 && ty(n).role !== 'buffer') add({ cat: 'lag', sev: s.util > 1 ? 'crit' : 'warn', mark: 'lagging', nodeId: n.id, title: n.name + ' cannot keep up', detail: Math.round(s.util * 100) + '% busy · lag grows at ' + Math.round(nodeLag(s)) + ' events/s', rec: 'add ' + Math.ceil((n.inst || 1) * s.util / 0.6 - (n.inst || 1)) + ' instances or more partitions upstream', evidence: [{ metric: 'util', scope: n.name + ' · instant', value: Math.round(s.util * 100) + '%' }, { metric: 'lag', scope: n.name + ' · instant', value: fmt(nodeLag(s)) + '/s' }] }); });
  // streams without dead letter
  nodes.filter(n => ty(n).role === 'buffer' && n.type !== 'dlq').forEach(q => { if (!outs[q.id]!.some(e => byId[e.to]!.type === 'dlq')) add({ cat: 'dlq', sev: 'info', mark: 'no dlq', nodeId: q.id, title: q.name + ' has no dead-letter path', detail: 'a poison event blocks its partition', rec: 'attach a dead-letter topic' }); });
  // duplicate pipelines: two transforms with the same input and output kind
  const sig: Record<string, GraphNode[]> = {}; nodes.filter(n => ty(n).cat === 'tr').forEach(n => { const k = ins[n.id]!.map(e => e.from).sort().join(',') + '>' + outs[n.id]!.map(e => e.to).sort().join(','); (sig[k] = sig[k] || []).push(n); });
  Object.values(sig).forEach(l => { if (l.length > 1) add({ cat: 'dup', sev: 'info', mark: 'duplicate', nodeId: l[0]!.id, title: l.length + ' transforms do the same movement', detail: l.map(n => n.name).join(' · '), rec: 'merge into one governed pipeline', nodes: l.map(n => n.id) }); });
  // lineage gaps: consumers with no store upstream
  nodes.filter(n => ty(n).cat === 'con').forEach(n => { if (!ins[n.id]!.length) add({ cat: 'lineage', sev: 'warn', mark: 'no lineage', nodeId: n.id, title: n.name + ' has no lineage', detail: 'nothing feeds it', rec: 'connect its source dataset' }); });
  const gov = nodes.filter(n => ty(n).gov).length, pii = nodes.filter(n => n.pii).length;
  return finish(F, { label: 'pii datasets', value: pii + ' · ' + gov + ' governed' }, { label: 'end-to-end p99', value: p99Text('dataflow', m) });
}

export function analyzeState(nodes: GraphNode[], edges: GraphEdge[], m: Metrics | null): Analysis {
  const T = PARADIGMS.state, { byId, outs, ins } = graph(nodes, edges), F: Finding[] = [], add = mkAdd(F);
  const ty = (n: GraphNode): NodeTypeDef => T.TYPES[n.type] ?? EMPTY_T, ek = (e: GraphEdge): EdgeKindDef => T.EDGES[e.kind] ?? EMPTY_E, st = (id: string): NodeStat | undefined => m?.nodes[id], nm = (id: string): string => name(byId, id);
  const inits = nodes.filter(n => ty(n).initial || (!ins[n.id]!.length && !ty(n).terminal));
  if (!inits.length && nodes.length) add({ cat: 'init', sev: 'crit', mark: '', nodeId: null, title: 'no initial state', detail: 'every state has an inbound transition', rec: 'mark one state as Initial' });
  const seen = reach(inits.map(n => n.id), outs);
  nodes.forEach(n => { if (!seen[n.id] && !ty(n).initial) add({ cat: 'reach', sev: 'warn', mark: 'unreachable', nodeId: n.id, title: n.name + ' is unreachable', detail: 'no transition leads here from the initial state', rec: 'add a transition or delete the state' }); });
  nodes.forEach(n => { const t = ty(n); if (!t.terminal && !outs[n.id]!.length) add({ cat: 'dead', sev: 'crit', mark: 'dead end', nodeId: n.id, title: n.name + ' has no exit', detail: 'objects that enter never leave', rec: 'add a transition or make it terminal' }); if (t.terminal && outs[n.id]!.length) add({ cat: 'term', sev: 'warn', mark: 'not terminal', nodeId: n.id, title: n.name + ' is terminal but has exits', detail: outs[n.id]!.length + ' outgoing transition' + (outs[n.id]!.length > 1 ? 's' : ''), rec: 'remove the exits or change the state type', edges: outs[n.id]!.map(e => e.id) }); });
  // missing failure handling on active states
  nodes.filter(n => ty(n).cat === 'st' && !ty(n).initial).forEach(n => { if (!outs[n.id]!.some(e => ek(e).alt)) add({ cat: 'fail', sev: 'warn', mark: 'no failure path', nodeId: n.id, title: n.name + ' has no failure or timeout exit', detail: 'a stuck object stays here forever', rec: 'add a timeout or failure transition' }); });
  // waits without timeout
  nodes.filter(n => ty(n).cat === 'wait' || ty(n).cat === 'appr' || n.type === 'blocked').forEach(n => { if (!outs[n.id]!.some(e => e.kind === 'timeout' || e.timeout)) add({ cat: 'wait', sev: 'warn', mark: 'no timeout', nodeId: n.id, title: n.name + ' can wait indefinitely', detail: 'no timeout transition', rec: 'add a timeout to Expired or Cancelled' }); });
  // retry cycles
  const cyc = edges.filter(e => e.kind === 'retry' || ek(e).alt).filter(e => reach([e.to], outs)[e.from]);
  if (cyc.length) add({ cat: 'loop', sev: 'info', mark: 'retry cycle', nodeId: cyc[0]!.from, title: cyc.length + ' retry cycle' + (cyc.length > 1 ? 's' : ''), detail: cyc.map(e => nm(e.from) + ' ↺ ' + nm(e.to)).slice(0, 3).join(' · '), rec: 'bound the retry count with a counter guard', edges: cyc.map(e => e.id) });
  // occupancy from the walk
  nodes.forEach(n => { const s = st(n.id); if (s && s.util > 0.85 && !ty(n).terminal) add({ cat: 'occ', sev: s.util > 1 ? 'crit' : 'warn', mark: 'crowded', nodeId: n.id, title: s.q + ' objects sit in ' + n.name, detail: Math.round(s.util * 100) + '% of capacity ' + (n.cap != null ? n.cap : ty(n).cap), rec: ty(n).human ? 'add approvers or auto-approve low risk' : 'raise capacity or shorten the dwell', evidence: [{ metric: 'objects', scope: n.name + ' · instant', value: String(s.q) }, { metric: 'occupancy', scope: n.name + ' · instant', value: Math.round(s.util * 100) + '%' }] }); });
  // bad-exit share — an OBSERVED share of completed objects in the sample window, never a ratio of terminal types
  const badTypes = nodes.filter(n => ty(n).bad), terms = nodes.filter(n => ty(n).terminal).length, bad = badTypes.length;
  if (m && isWarm(m) && m.sys.err > 0.25) {
    const done = samplesOf(m), badN = m.prov?.bad ?? Math.round(m.sys.err * done);
    add({ cat: 'exit', sev: 'warn', mark: '', nodeId: null, title: Math.round(m.sys.err * 100) + '% of objects end in a bad state',
      detail: (m.prov ? badN + ' of ' + done + ' objects completed in the sample window' : 'the observed share of completed objects') + ' ended in ' + (badTypes.map(n => n.name).join(' / ') || 'a bad terminal state'),
      rec: 'trace the dominant failure transition', nodes: badTypes.map(n => n.id),
      evidence: [{ metric: 'bad exits', scope: 'system · ' + (m.prov?.window ?? 'run'), value: (m.prov ? badN + ' / ' + done + ' · ' : '') + Math.round(m.sys.err * 100) + '%' }] });
  }
  return finish(F, { label: 'lifetime p99', value: p99Text('state', m) }, { label: 'terminal', value: terms + ' · ' + bad + ' bad' });
}

export function analyzeParadigm(pid: ParadigmId, nodes: GraphNode[], edges: GraphEdge[], m: Metrics | null, regions: GraphRegion[] | undefined): Analysis {
  if (pid === 'workflow') return analyzeWorkflow(nodes, edges, m, regions);
  if (pid === 'sequence') return analyzeSequence(nodes, edges, m);
  if (pid === 'dataflow') return analyzeDataflow(nodes, edges, m);
  if (pid === 'state') return analyzeState(nodes, edges, m);
  return { list: [], a: null, b: null };
}
