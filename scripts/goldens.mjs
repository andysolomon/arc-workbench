// Golden-file generator. Runs the ORIGINAL prototype modules (and the verbatim extraction in
// proto-app.mjs) with Math.random / Date.now stubbed, and writes tests/golden/data/*.json.
// The TypeScript port must reproduce these byte-for-byte (strings) or within 1e-6 (numbers).
import { mkdirSync, writeFileSync } from 'node:fs';
import * as S from '../Form submission process/sim-engine.js';
import * as SP from '../Form submission process/sim-paradigms.js';
import * as L from '../Form submission process/layout.js';
import * as X from '../Form submission process/examples.js';
import * as PD from '../Form submission process/paradigms.js';
import { ProtoApp } from './proto-app.mjs';

export const mulberry32 = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const realRandom = Math.random, realNow = Date.now;
function seeded(seed, fn) { Math.random = mulberry32(seed); let t = 1_700_000_000_000; Date.now = () => (t += 250); try { return fn(); } finally { Math.random = realRandom; Date.now = realNow; } }
const hOf = nodes => { const h = {}; nodes.forEach((n, i) => h[n.id] = 88 + (i % 3) * 16); return h; };
const clone = v => JSON.parse(JSON.stringify(v));
// documents carry the visual family, never the legacy alias (PORT-NOTES D4): normalise regions
const famRegion = r => { if (!r || typeof r !== 'object' || !('kind' in r)) return r; const { kind, ...rest } = r; return { ...rest, family: PD.familyOfGk(kind) }; };
const famDeep = v => Array.isArray(v) ? v.map(famDeep) : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(famRegion(v)).map(([k, x]) => [k, famDeep(x)])) : v;
const stripT = sys => { const { t, ...rest } = sys; return rest; };
const out = {};
const DIR = 'tests/golden/data';
mkdirSync(DIR, { recursive: true });

// ---- simulation: 24 ticks at dt 0.25 for every example ----
const sim = {};
for (const pid of PD.ORDER) for (const ex of X.EXAMPLES[pid]) {
  const key = pid + '/' + ex.id;
  sim[key] = seeded(42, () => {
    const st = (pid === 'architecture' || pid === 'dataflow') ? S.makeSim() : SP.makeParadigmSim(pid);
    const ticks = [];
    for (let i = 0; i < 24; i++) {
      const m = pid === 'workflow' ? SP.tickWorkflow(st, ex.nodes, ex.edges, ex.rps, 0.25)
        : pid === 'state' ? SP.tickState(st, ex.nodes, ex.edges, ex.rps, 0.25)
        : pid === 'sequence' ? SP.tickSequence(st, ex.nodes, ex.edges, ex.rps, 0.25)
        : S.tick(st, ex.nodes, ex.edges, ex.rps, 0.25);
      ticks.push({ nodes: m.nodes, edges: m.edges, sys: stripT(m.sys), run: m.run ?? null, tl: m.tl ? { total: m.tl.total, msgs: m.tl.msgs.map(x => ({ id: x.id, start: x.start, end: x.end, lat: x.lat })) } : null });
    }
    return { paradigm: pid, rps: ex.rps, ticks: clone(ticks), histLen: st.hist.length, polyline: { p99: S.polyline(st.hist, 'p99', 300, 64), rps: S.polyline(st.hist, 'rps', 300, 64, Math.max(1, ...st.hist.map(h => h.rps))), qtot: S.polyline(st.hist, 'qtot', 300, 64) } };
  });
}
out.sim = sim;

// ---- layout ----
const layout = {};
for (const pid of PD.ORDER) for (const ex of X.EXAMPLES[pid]) {
  const H = hOf(ex.nodes);
  layout[pid + '/' + ex.id] = famDeep(clone(L.autoLayout(pid, ex.nodes, ex.edges, ex.regions, { W: 200, hOf: id => H[id] })));
}
out.layout = layout;

// ---- router ----
const router = {};
for (const pid of PD.ORDER) for (const ex of X.EXAMPLES[pid]) {
  const H = hOf(ex.nodes);
  const mk = (props, ui) => new ProtoApp(pid, ex.nodes, ex.edges, ex.regions, { nodeH: H, props, ui });
  const app = mk();
  const base = { sig: app.routeSig(null, null), routes: app.routes(null, null), chans: app._chans ?? null };
  const plain = mk({ router: 'independent' });
  const nolabels = mk({}, { labels: false });
  const e0 = ex.edges[0], last = ex.nodes[ex.nodes.length - 1];
  const ptrFree = { edge: e0.id, end: 'to', x: last.x + 50, y: last.y + 300, node: null };
  const ptrSnap = { edge: e0.id, end: 'from', x: last.x, y: last.y, node: last };
  const drag = { [ex.nodes[1].id]: { x: ex.nodes[1].x + 37, y: ex.nodes[1].y - 21 } };
  router[pid + '/' + ex.id] = clone({
    base, independent: { sig: plain.routeSig(null, null), routes: plain.routes(null, null) }, noLabelsSig: nolabels.routeSig(null, null),
    ptrFree: { sig: app.routeSig(null, ptrFree), routes: app.solveRoutes(null, ptrFree) },
    ptrSnap: { sig: app.routeSig(null, ptrSnap), routes: app.solveRoutes(null, ptrSnap) },
    drag: { sig: app.routeSig(drag, null), routes: app.solveRoutes(drag, null) },
    seqGeo: pid === 'sequence' ? famDeep(clone(app.seqGeo())) : null,
    docBounds: app.docBounds(ex.nodes), tiers: app.tiersOf(),
  });
}
out.router = router;

// ---- analyze: with the 24th-tick metrics, and with none ----
const analyze = {};
for (const pid of PD.ORDER) for (const ex of X.EXAMPLES[pid]) {
  const key = pid + '/' + ex.id, m = sim[key].ticks[23];
  const metrics = { nodes: m.nodes, edges: m.edges, sys: m.sys, run: m.run, tl: m.tl };
  const withM = new ProtoApp(pid, ex.nodes, ex.edges, ex.regions, { nodeH: hOf(ex.nodes), metrics, rps: ex.rps });
  const noM = new ProtoApp(pid, ex.nodes, ex.edges, ex.regions, { nodeH: hOf(ex.nodes), metrics: null, rps: ex.rps });
  analyze[key] = clone({ withMetrics: withM.analyze(), design: noM.analyze() });
}
out.analyze = analyze;

// ---- lanes, deoverlap ----
{
  const ex = X.EXAMPLES.workflow[0], H = hOf(ex.nodes);
  const app = new ProtoApp('workflow', ex.nodes, ex.edges, ex.regions, { nodeH: H });
  const moved = ex.nodes.map(n => n.id === 'build' ? { ...n, y: 520 } : n);
  const far = ex.nodes.map(n => n.id === 'qg' ? { ...n, y: 120 } : n);
  out.lanes = famDeep(clone({
    laneOf: Object.fromEntries(ex.nodes.map(n => [n.id, (app.laneOf(n) || {}).id ?? null])),
    members: Object.fromEntries(app.lanes().map(l => [l.id, app.laneMembers(l.id).map(n => n.id)])),
    moved: app.fitLanes(ex.regions, moved, 'build'),
    far: app.fitLanes(ex.regions, far, 'qg'),
    all: app.fitLanes(ex.regions.filter(r => r.id !== 'l2'), ex.nodes),
    ownerKinds: app.OWNER_KINDS,
  }));
  const ax = X.EXAMPLES.architecture[0];
  const stacked = ax.nodes.map(n => n.id === 'apib' ? { ...n, x: 816, y: 200 } : n.id === 'pg' ? { ...n, x: 820, y: 230 } : n);
  const dapp = new ProtoApp('architecture', stacked, ax.edges, ax.regions, { nodeH: hOf(ax.nodes) });
  const hit = dapp.deoverlap(true);
  out.deoverlap = clone({ hit, nodes: dapp.state.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })) });
}

// ---- view math ----
{
  const app = new ProtoApp('architecture', [], [], [], { props: { zoomSnap: 'crisp' } });
  globalThis.window = { devicePixelRatio: 1 };
  const lad1 = app.zoomLadder(); app._lad = null;
  globalThis.window = { devicePixelRatio: 2 };
  const lad2 = app.zoomLadder(); app._lad = null;
  globalThis.window = { devicePixelRatio: 1 };
  const ks = [0.15, 0.2, 0.3, 0.44, 0.45, 0.5, 0.69, 0.7, 0.97, 1, 1.2, 1.21, 1.7, 2.5];
  out.view = clone({ ladder1: lad1, ladder2: lad2, crispK: ks.map(k => app.crispK(k)), crispDown: ks.map(k => app.crispDown(k)), up: ks.map(k => app.crispStep(k, true)), down: ks.map(k => app.crispStep(k, false)), level: ks.map(k => app.zoomLevelOf(k)) });
  const free = new ProtoApp('architecture', [], [], [], { props: { zoomSnap: 'free' } });
  out.view.freeUp = ks.map(k => free.crispStep(k, true)); out.view.freeDown = ks.map(k => free.crispStep(k, false));
  delete globalThis.window;
}

// ---- formatting + dispatch helpers ----
{
  const misc = { fmt: {}, fmtMs: {}, fmtMin: {}, rows: {}, defaultEdge: {}, spark: {}, pkt: {}, tone: {} };
  const vals = [0, 0.4, 1, 9.6, 999, 1000, 1499.5, 9999, 10000, 123456, 1e6, 2.5e6];
  for (const v of vals) { misc.fmt[v] = S.fmt(v); misc.fmtMs[v] = S.fmtMs(v); misc.fmtMin[v] = SP.fmtMin(v); }
  for (const pid of PD.ORDER) {
    const ex = X.EXAMPLES[pid][0];
    const app = new ProtoApp(pid, ex.nodes, ex.edges, ex.regions, { rps: ex.rps, mode: 'simulate' });
    misc.rows[pid] = Object.fromEntries(ex.nodes.map(n => [n.id, app.bodyRows(n, null)]));
    misc.defaultEdge[pid] = {};
    ex.nodes.forEach(a => ex.nodes.forEach(b => { if (a !== b) misc.defaultEdge[pid][a.id + '>' + b.id] = app.defaultEdgeKind(a, b); }));
    const st = { arr: 1234.5, util: 0.83, lat: 45.2, q: 12, err: 0.012, health: 'warn' };
    misc.tone[pid] = { fL: [12, 480.5, 1441, 1600, 9999].map(v => app.fL(v)), p99: [12, 401, 481, 1441, 1501].map(v => app.p99Tone(v)), drop: [0, 1.5, 1000].map(d => app.dropTone(d, { rps: ex.rps })), weight: [1, ex.rps, ex.rps * 3].map(r => app.weightOf(r)), unit: ex.nodes.map(n => app.unitFor(n, st)), rate: ex.edges.map(e => app.rateText(e, 777.7)), rateDesign: (app.state.mode = 'design', ex.edges.map(e => app.rateText(e, 777.7))) };
  }
  const app = new ProtoApp('architecture', [], [], []);
  app.nhist = { a: [1, 5, 3, 8, 0], b: [2], c: [0, 0, 0] };
  misc.spark = { a: app.sparkPts('a'), b: app.sparkPts('b'), c: app.sparkPts('c'), none: app.sparkPts('zzz') };
  misc.pkt = [[0.2, false, 1], [10, false, 1], [10, true, 1], [10, true, 0], [4000, false, 1], [90000, true, 1]].map(([r, a, k]) => app.pktStyleFor(r, a, k));
  out.misc = misc;
}

for (const [k, v] of Object.entries(out)) writeFileSync(`${DIR}/${k}.json`, JSON.stringify(v, null, 1) + '\n');
console.log('goldens written:', Object.keys(out).join(', '));
