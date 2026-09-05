// The 4 Hz telemetry pass and the imperative layers beside it (WB 1519–1647, 2060–2066):
// zero React involvement, cached element refs, identical strings never touch the DOM.
import type { GraphEdge, GraphNode, ParadigmId } from '../model/document';
import type { Metrics, Health, RunState } from '../sim/types';
import { BT, DT, HG, HW, fL, pktRank, pktStyleFor, rateText, sparkPts, unitFor, weightOf, p99Tone, dropTone } from '../sim/hud';
import { hudD, isWarm, nodeP99Text, p99Text, windowNote } from '../sim/metrics';
import { fmt, polyline } from '../sim/format';
import type { HistPoint } from '../sim/format';
import type { EdgeGeo, RouteMap } from '../router/types';
import type { Refs } from './refs';

const txt = (el: Element | null, v: string): void => { if (el && el.textContent !== v) el.textContent = v; };
const setA = (el: Element | null | undefined, k: string, v: string | null): void => { if (!el) return; if (v) { if (el.getAttribute(k) !== v) el.setAttribute(k, v); } else if (el.hasAttribute(k)) el.removeAttribute(k); };

export interface PatchCtx {
  paradigm: ParadigmId; mode: string; rps: number; rateUnit: string;
  nodes: GraphNode[]; edges: GraphEdge[]; metrics: Metrics; nhist: Record<string, number[]>;
  refs: Refs; sel: { kind: string; id: string } | null; hoverEdge: string | null;
  motion: boolean; packets: boolean; trace: boolean; drawerOpen: boolean; hist: HistPoint[]; uptimeS: number;
  seqCursor: ((run: RunState) => number | null) | null;
}

export function patchNodes(c: PatchCtx): void {
  const m = c.metrics, p = c.paradigm;
  for (const n of c.nodes) {
    const st = m.nodes[n.id], r = c.refs.node(n.id); if (!st || !r) continue;
    const rate = fmt(st.arr) + c.rateUnit; if (r.vRate !== rate) { r.vRate = rate; txt(r.rate, rate); }
    const unit = unitFor(p, n, st); if (r.vUnit !== unit) { r.vUnit = unit; txt(r.unit, unit); }
    const p99 = nodeP99Text(p, st); if (r.vP99 !== p99) { r.vP99 = p99; txt(r.p99, p99); }
    const q = fmt(st.q); if (r.vQ !== q) { r.vQ = q; txt(r.q_, q); }
    const sp = sparkPts(c.nhist[n.id]); if (r.spark && r.vSpark !== sp) { r.vSpark = sp; r.spark.setAttribute('points', sp); }
    if (r.util) { const u = String(Math.min(1, st.util)); if (r.vUtil !== u) { r.vUtil = u; r.util.style.setProperty('--v', u); } const tone = BT[st.health]; if (r.vTone !== tone) { r.vTone = tone; r.util.dataset['tone'] = tone; } }
    const gl = HG[st.health], hw = HW[st.health];
    if (r.dot && r.vGlyph !== gl) { r.dot.textContent = gl; r.dot.dataset['tone'] = DT[st.health]; }
    if (r.vHword !== hw) { r.vHword = hw; txt(r.hword, hw); }
    const hd = st.health === 'ok' ? '' : st.health; if (r.vHealth !== hd || r.el.dataset['health'] !== hd) { r.vHealth = hd; r.el.dataset['health'] = hd; }
    if (r.hdot && r.vGlyph !== gl) { r.hdot.textContent = gl; r.hdot.title = hw; }
    r.vGlyph = gl;
  }
}
export function patchEdges(c: PatchCtx): void {
  const m = c.metrics;
  for (const e of c.edges) {
    const r = c.refs.edge(e.id); if (!r) continue;
    const rate = m.edges[e.id] || 0;
    const rt = rateText(c.paradigm, c.mode, e, rate); if (r.vRate !== rt) { r.vRate = rt; txt(r.erate, rt); }
    const w = weightOf(c.rps, rate); if (r.path && r.vWeight !== w) { r.vWeight = w; r.path.dataset['weight'] = w; }
    const th = m.nodes[e.to], sv = th && th.health !== 'ok' ? (th.health === 'crit' ? 'critical' : th.health) : '';
    if (r.vHealth !== sv) { r.vHealth = sv; if (r.path) r.path.dataset['health'] = sv; if (r.pkt) r.pkt.dataset['health'] = sv; }
  }
}
/** traffic packets: opacity, width and period derive from log10(rate); bounded to the busiest 28 edges */
export function patchPackets(c: PatchCtx): Record<string, 1> {
  const rank = pktRank(c.edges, c.metrics), sel = c.sel, hov = c.hoverEdge;
  for (const e of c.edges) {
    const r = c.refs.edge(e.id); if (!r || !r.pkt) continue;
    const st = pktStyleFor(c.metrics.edges[e.id] || 0, hov === e.id || (!!sel && sel.kind === 'edge' && sel.id === e.id), rank[e.id]);
    r.pkt.style.opacity = String(st.opacity); r.pkt.style.strokeWidth = st.strokeWidth || '1px';
    if (st.dur) r.pkt.style.setProperty('--dur', st.dur);
  }
  return rank;
}
/** run layer: ONE traced execution. Nodes/edges get data-run outside React (like health), cleared on exit. */
export function patchRun(c: PatchCtx): void {
  const m = c.metrics, on = c.trace && !!m.run, run = on ? m.run! : null, p = c.paradigm;
  for (const id in c.refs.nodes) setA(c.refs.nodes[id]!.el, 'data-run', run && run.node === id ? 'active' : null);
  for (const id in c.refs.edges) {
    const r = c.refs.edge(id); if (!r || !r.path) continue;
    let v: string | null = null;
    if (run) { if (p === 'sequence') v = run.edge === id ? 'active' : run.done && run.done[id] ? 'done' : 'pending'; else v = run.edge === id ? 'active' : null; }
    setA(r.path, 'data-run', v);
  }
  if (c.refs.cursor && run && p === 'sequence' && c.seqCursor) {
    const y = c.seqCursor(run); if (y != null) { c.refs.cursor.setAttribute('y1', String(y)); c.refs.cursor.setAttribute('y2', String(y)); }
  }
}
export function patchHud(c: PatchCtx): void {
  const m = c.metrics, sys = m.sys, drop = hudD(c.paradigm, m), R = c.refs;
  if (R.hud) {
    const q = (s: string): HTMLElement | null => R.hud!.querySelector(s);
    const a = q('[data-t="p99"]'); txt(a, p99Text(c.paradigm, m)); setA(a, 'data-hud-tone', (isWarm(m) && p99Tone(c.paradigm, sys.p99)) || ''); if (a) a.title = 'system p99 · ' + windowNote(m);
    txt(q('[data-t="good"]'), fmt(sys.goodput));
    const b = q('[data-t="err"]'); txt(b, (sys.err * 100).toFixed(1) + '%'); setA(b, 'data-hud-tone', sys.err > 0.05 ? 'crit' : sys.err > 0.005 ? 'warn' : '');
    const d = q('[data-t="drop"]'); txt(d, fmt(drop)); setA(d, 'data-hud-tone', dropTone(c.paradigm, drop, sys) || '');
  }
  if (R.strip) { const up = Math.floor(c.uptimeS); txt(R.strip.querySelector('[data-t="uptime"]'), Math.floor(up / 60) + 'm ' + String(up % 60).padStart(2, '0') + 's'); }
  if (c.drawerOpen && R.drawer) {
    const hist = c.hist, latMax = Math.max(1, ...hist.map(h => h.p99)), thrMax = Math.max(1, ...hist.map(h => h.rps));
    const setp = (t: string, pts: string): void => { const el = R.drawer!.querySelector('[data-t="' + t + '"]'); if (el) el.setAttribute('points', pts); };
    setp('c-p50', polyline(hist, 'p50', 300, 64, latMax)); setp('c-p95', polyline(hist, 'p95', 300, 64, latMax)); setp('c-p99', polyline(hist, 'p99', 300, 64, latMax));
    setp('c-rps', polyline(hist, 'rps', 300, 64, thrMax)); setp('c-good', polyline(hist, 'goodput', 300, 64, thrMax));
    setp('c-err', polyline(hist, 'err', 300, 64, 1)); setp('c-q', polyline(hist, 'qtot', 300, 64));
    txt(R.drawer.querySelector('[data-t="latmax"]'), 'max ' + fL(c.paradigm, latMax) + ' · ' + hist.length + ' ticks'); txt(R.drawer.querySelector('[data-t="thrmax"]'), 'max ' + fmt(thrMax) + ' · ' + hist.length + ' ticks');
    txt(R.drawer.querySelector('[data-t="errNow"]'), (sys.err * 100).toFixed(1) + '%'); txt(R.drawer.querySelector('[data-t="qNow"]'), fmt(sys.qtot));
  }
  const sel = c.sel;
  if (R.insp && sel && sel.kind === 'node') {
    const st = c.metrics.nodes[sel.id];
    if (st) {
      const q = (s: string): Element | null => R.insp!.querySelector(s);
      txt(q('[data-t="mArr"]'), fmt(st.arr) + c.rateUnit); txt(q('[data-t="mLat"]'), fL(c.paradigm, st.lat));
      txt(q('[data-t="mP99"]'), fL(c.paradigm, st.lat * 2.2)); txt(q('[data-t="mUtil"]'), Math.round(st.util * 100) + '%');
      txt(q('[data-t="mQ"]'), fmt(st.q)); txt(q('[data-t="mErr"]'), (st.err * 100).toFixed(1) + '%');
    }
  }
  if (R.insp && sel && sel.kind === 'edge') txt(R.insp.querySelector('[data-t="mRate"]'), fmt(c.metrics.edges[sel.id] || 0) + c.rateUnit);
}
/** one pass: nodes, edges, packets (simulate only), run layer, HUD / strip / drawer / inspector */
export function patchTelemetry(c: PatchCtx): void {
  patchNodes(c); patchEdges(c);
  if (c.motion && c.mode === 'simulate' && c.packets) patchPackets(c);
  if (c.mode === 'simulate') patchRun(c);
  patchHud(c);
}

/** live edge geometry during a drag: every path in the group, both labels, and the endpoint handles */
export function applyEdgeGeo(refs: Refs, e: GraphEdge, geo: EdgeGeo, endsFor: string | null): void {
  const r = refs.edge(e.id); if (!r) return;
  if (r.vD !== geo.d) { r.vD = geo.d; for (const p of [r.hit, r.path, r.pkt, r.hl]) if (p) p.setAttribute('d', geo.d); }
  if (r.elabel) { r.elabel.setAttribute('x', String(geo.lx)); r.elabel.setAttribute('y', String(geo.ly)); }
  if (r.erate) { r.erate.setAttribute('x', String(geo.lx)); r.erate.setAttribute('y', String(geo.ly + (r.elabel ? 12 : 4))); }
  if (refs.ends && endsFor === e.id) {
    const c: Record<string, [number, number]> = { endf: geo.p1, endfh: geo.p1, endt: geo.p2, endth: geo.p2 };
    for (const t in c) { const el = refs.ends.querySelector('[data-t="' + t + '"]'); if (el) { el.setAttribute('cx', String(c[t]![0])); el.setAttribute('cy', String(c[t]![1])); } }
  }
}
export function applyRoutes(refs: Refs, edges: GraphEdge[], rt: RouteMap, endsFor: string | null): void { for (const e of edges) { const g = rt[e.id]; if (g) applyEdgeGeo(refs, e, g, endsFor); } }

// telemetry is DOM-patched outside React, so leftover health/weight attrs can survive the
// mode-switch re-render (vdom may never have held them). Clear them on entering design.
export function clearRuntimeDom(refs: Refs): void {
  for (const id in refs.nodes) { const r = refs.nodes[id]!; if (r.el.dataset['health']) r.el.dataset['health'] = ''; if (r.el.dataset['run']) delete r.el.dataset['run']; r.vHealth = ''; }
  for (const id in refs.edges) {
    const r = refs.edge(id); if (!r) continue;
    for (const p of [r.path, r.pkt]) { if (!p) continue; if (p.dataset['health']) p.dataset['health'] = ''; if (p.dataset['run']) delete p.dataset['run']; if (p.dataset['weight'] && p.dataset['weight'] !== '1') p.dataset['weight'] = '1'; }
    r.vHealth = ''; r.vWeight = '1';
  }
}
export type { Health };
