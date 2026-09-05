// renderVals, split by surface: the canvas view model. Everything the render layer draws is
// computed here from the store + the memoised route plan + the latest metrics snapshot.
import type { GraphEdge, GraphNode, GraphRegion, ParadigmId, Selection, View, VisualFamily } from '../model/document';
import { ARCH_CAT_FAMILY, PARADIGMS, familyOf, type ArchCat } from '../paradigms';
import type { CanvasVM, EdgeVM, EndsVM, Mode, NodeVM, PortState, RegionVM, Row, SeqVM, TierVM, Tone, ZoomLevelAttr, ChanGuide } from '../render/types';
import type { EdgeGeo, RouteMap, SeqGeo, Channels } from '../router';
import { BT, DT, HG, HW, fL, fmt, fmtMin, hasPackets, pktRank, pktStyleFor, rateText, sparkPts, unitFor, weightOf, type Metrics, type NodeStat } from '../sim';
import type { Finding } from '../analyze';
import { isCulled, type WorldBox } from '../view/cull';

export const W = 200;

const row = (k: string, v: unknown, o?: Partial<Row>): Row => ({ k, v: v == null || v === '' ? '—' : String(v), cfg: null, dk: null, hasShort: false, short: '', ...(o ?? {}) });
/** node body rows per paradigm (WB 743–757). design working zoom shows the `dk` row's short form */
export function bodyRows(p: ParadigmId, n: GraphNode): Row[] {
  const t = PARADIGMS[p].TYPES[n.type];
  const thr = (n.ms ?? 0) > 0 ? ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / (n.ms ?? 1) : 0;
  const inst = n.inst ?? 1;
  if (p === 'architecture') return [row('instances', n.inst, { dk: '1', hasShort: true, short: inst + (inst > 1 ? ' instances' : ' instance') }), row('service', (n.ms ?? 0) > 0 ? n.ms + ' ms' : 'pass-through', { cfg: '1' }), row('capacity', thr ? fmt(thr) + '/s' : 'unbounded', { cfg: '1' })];
  if (p === 'workflow') { const d = n.dur != null ? n.dur : t?.dur; return [row('owner', n.owner, { dk: '1', hasShort: true, short: n.owner || '—' }), row('duration', d != null ? fmtMin(d) : '—', { cfg: '1' }), row('pass rate', Math.round((n.pass != null ? n.pass : t?.pass == null ? 1 : t.pass) * 100) + '%', { cfg: '1' })]; }
  if (p === 'sequence') return [row('role', n.role, { dk: '1', hasShort: true, short: n.role || '—' }), row('concurrency', (n.conc ?? 0) >= 1e9 ? 'unbounded' : n.conc, { cfg: '1' })];
  if (p === 'dataflow') {
    // data describes what it holds; process describes what it does
    if (t?.form === 'process') return [row('instances', n.inst, { dk: '1', hasShort: true, short: inst + (inst > 1 ? ' instances' : ' instance') }), row('per event', (n.ms ?? 0) > 0 ? n.ms + ' ms' : 'pass-through', { cfg: '1' }), row('capacity', thr ? fmt(thr) + '/s' : 'unbounded', { cfg: '1' }), row('pii', n.pii ? 'yes' : 'no', { cfg: '1' })];
    return [row('schema', n.schema, { dk: '1', hasShort: true, short: n.schema || '—' }), row('retention', n.retention == null ? '—' : n.retention === 0 ? 'unbounded' : n.retention + ' d', { cfg: '1' }), row('partitions', n.parts || '—', { cfg: '1' }), row('pii', n.pii ? 'yes' : 'no', { cfg: '1' })];
  }
  if (p === 'state') { const d = n.dwell != null ? n.dwell : t?.dwell; return [row('dwell', d != null ? fmtMin(d) : '—', { dk: '1', hasShort: true, short: d != null ? '~' + fmtMin(d) + ' in state' : '—' }), row('entry', n.entry, { cfg: '1' }), row('exit', n.exit, { cfg: '1' })]; }
  return [];
}

/** tiers as the drawing reads them: columns of aligned nodes. Band edges land on the midpoint
 * between neighbouring columns, so the slabs tile and never overlap. Architecture only. */
export function tiersOf(pid: ParadigmId, nodes: GraphNode[], footH: (id: string) => number): TierVM[] {
  const T = PARADIGMS.architecture; if (!nodes.length || pid !== 'architecture') return [];
  const cols: Array<{ min: number; max: number; ns: GraphNode[] }> = [];
  [...nodes].sort((a, b) => a.x - b.x).forEach(n => {
    const c = cols[cols.length - 1];
    if (c && n.x - c.min <= W * 0.6) { c.ns.push(n); c.max = Math.max(c.max, n.x); }
    else cols.push({ min: n.x, max: n.x, ns: [n] });
  });
  // one shared vertical extent: the bands read as drafting columns, not ragged blobs
  const gy0 = Math.min(...nodes.map(n => n.y)) - 32, gy1 = Math.max(...nodes.map(n => n.y + footH(n.id))) + 20;
  return cols.map((c, i) => {
    const ns = c.ns, prev = cols[i - 1], next = cols[i + 1];
    const lo = Math.min(...ns.map(n => n.x)), hi = Math.max(...ns.map(n => n.x + W));
    const x0 = prev ? (Math.max(...prev.ns.map(n => n.x + W)) + lo) / 2 : lo - 20;
    const x1 = next ? (hi + Math.min(...next.ns.map(n => n.x))) / 2 : hi + 20;
    const cc: Record<string, number> = {}; ns.forEach(n => { const cat = T.TYPES[n.type]?.cat ?? ''; cc[cat] = (cc[cat] || 0) + 1; });
    const cat = Object.keys(cc).sort((a, b) => cc[b]! - cc[a]!)[0] ?? '';
    return { id: 'tier' + i, family: ARCH_CAT_FAMILY[cat as ArchCat] ?? 'stone', label: 'tier ' + (i + 1) + ' · ' + (T.CATS[cat]?.label ?? ''), left: x0, top: gy0, width: x1 - x0, height: gy1 - gy0 };
  });
}

/** regions as drawn: sequence phases come from the timeline, bands alternate tint (WB 2089–2101) */
export function regionsViewOf(pid: ParadigmId, mode: Mode, regions: GraphRegion[], sel: Selection | null, seq: SeqGeo | null): RegionVM[] {
  const rs = regions || []; if (!rs.length) return [];
  const selR = sel && sel.kind === 'region' ? sel.id : null;
  const mk = (r: GraphRegion, x: number, y: number, w: number, h: number, alt: boolean | '1' | null): RegionVM => ({
    id: r.id, variant: r.variant, family: r.family ?? 'stone', alt: alt ? '1' : null, dashed: r.dashed ? '1' : null, label: r.label,
    owner: r.owner ? (r.ownerKind ? r.ownerKind + ' · ' : '') + r.owner : '', hasOwner: !!r.owner,
    needsOwner: r.variant === 'lane' && !r.owner && mode === 'design', state: selR === r.id ? 'selected' : null,
    selectable: r.variant === 'lane', aria: r.variant + ' ' + r.label, left: x, top: y, width: w, height: h,
  });
  if (pid === 'sequence') return seq ? seq.phases.map(p => mk(p, p.x, p.y, p.w, p.h, p.alt)) : [];
  let bandI = 0;
  return rs.filter(r => r.w > 0 && r.h > 0).map(r => { const band = r.variant === 'lane' || r.variant === 'stage' || r.variant === 'phase'; return mk(r, r.x, r.y, r.w, r.h, band && (bandI++ % 2 === 1)); });
}

export interface Focus { key: string; nodes: Record<string, 1>; edges: Record<string, 1>; keep: Record<string, 1> }
export interface CanvasInput {
  paradigm: ParadigmId; mode: Mode; nodes: GraphNode[]; edges: GraphEdge[]; regions: GraphRegion[]; view: View; rps: number;
  nodeH: Record<string, number>; footH: (id: string) => number; zoomLevel: ZoomLevelAttr;
  metrics: Metrics | null; nhist: Record<string, number[]>;
  sel: Selection | null; hoverEdge: string | null; rewire: { edgeId: string; end: 'from' | 'to' } | null; connect: { from: string; side: string } | null; connectInvalid: Record<string, 1> | null;
  focus: Focus | null; findings: Finding[];
  routes: RouteMap; chans: Channels | null; seq: SeqGeo | null;
  ui: { pixel: boolean; tiers: boolean; packets: boolean; channels: boolean; trace: boolean; labels: boolean; rates: boolean; spark: boolean; semantic: boolean };
  motion: boolean; touch: boolean; rect: { width: number; height: number } | null; worldBox: WorldBox | null;
  chanGap: 'tight' | 'normal' | 'loose';
  viewStyle: { zoom: string; transform: string }; gridStyle: { backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string };
}

export interface CanvasBuild extends CanvasVM { portConn: Record<string, 1>; cardEdge: GraphEdge | null; cardGeo: EdgeGeo | null }

export function buildCanvasVM(s: CanvasInput): CanvasBuild {
  const T = PARADIGMS[s.paradigm], p = s.paradigm, m = s.metrics, simOn = s.mode !== 'design', zl = s.zoomLevel;
  const nById: Record<string, GraphNode> = {}; s.nodes.forEach(n => nById[n.id] = n);
  const an = s.mode === 'analyze' ? s.findings : [];
  const fc = s.mode === 'analyze' && s.focus && an.some(f => f.key === s.focus!.key) ? s.focus : null;
  const annBy: Record<string, Finding> = {}; an.forEach(f => { if (f.nodeId && f.mark && !annBy[f.nodeId]) annBy[f.nodeId] = f; });
  const setOf = (arr: string[] | undefined): Record<string, 1> => (arr || []).reduce<Record<string, 1>>((o, id) => (o[id] = 1, o), {});
  const pathE: Record<string, 1> = fc ? fc.edges : (an[0] ? setOf(an[0].edges) : {});
  const rw = s.rewire;
  const hoverObj = s.edges.find(e => e.id === (rw ? rw.edgeId : s.hoverEdge));
  const lit: Record<string, 1> = {}; if (hoverObj) { lit[hoverObj.from] = 1; lit[hoverObj.to] = 1; }
  const portConn: Record<string, 1> = {};
  const rank = pktRank(s.edges, m);
  const stm = !!T.structured, motion = s.motion && s.ui.packets;
  const edges: EdgeVM[] = [];
  const wb = s.worldBox, runEdge = m?.run?.edge ?? null;
  s.edges.forEach(e => {
    if (!nById[e.from] || !nById[e.to]) return;
    const geo = s.routes[e.id]; if (!geo) return;
    portConn[e.from + ':' + geo.s1] = 1; portConn[e.to + ':' + geo.s2] = 1;
    const seld = !!s.sel && s.sel.kind === 'edge' && s.sel.id === e.id;
    const hov = s.hoverEdge === e.id || (!!rw && rw.edgeId === e.id);
    // large sequences: a message row outside the viewport halo is not drawn — unless it is selected,
    // hovered or the traced execution sits on it, so selection and ↑↓ navigation keep working
    if (p === 'sequence' && wb && !seld && !hov && runEdge !== e.id && (geo.ly < wb.y0 || geo.ly > wb.y1)) return;
    const rate = m ? m.edges[e.id] || 0 : 0;
    const hasLabel = !!e.label, hasGuard = stm && !!e.guard, hasAction = stm && !!e.action;
    const parts: string[] = []; if (hasLabel) parts.push('l'); if (hasGuard) parts.push('g'); if (hasAction) parts.push('a');
    const ly0 = geo.ly - (parts.length ? (parts.length - 1) * 6 : 0), yOf = (k: string): number => ly0 + parts.indexOf(k) * 12;
    const th = m && m.nodes[e.to];
    edges.push({
      id: e.id, d: geo.d, rel: T.EDGES[e.kind]?.rel ?? 'flow', run: null, msg: geo.self ? 'self' : null,
      aria: T.a11y(nById[e.from]!.name, e, nById[e.to]!.name, T),
      state: seld ? 'selected' : (fc && !fc.keep[e.id] ? 'muted' : ''),
      onPath: !!pathE[e.id],
      weight: simOn ? weightOf(s.rps, rate) : '1',
      stress: simOn && th ? (th.health === 'ok' ? '' : (th.health === 'crit' ? 'critical' : 'warn')) : '',
      hasLabel, labelText: e.label, labelRole: stm ? 'event' : null, lx: geo.lx, ly: hasLabel ? yOf('l') : geo.ly,
      hasGuard, guardText: hasGuard ? '[' + e.guard + ']' : '', lyG: yOf('g'), hasAction, actionText: hasAction ? '/ ' + e.action : '', lyA: yOf('a'),
      ly2: ly0 + (parts.length ? 12 * parts.length : 4),
      rateText: rateText(p, s.mode, e, rate),
      packets: motion && s.mode === 'simulate' && hasPackets(p), pktStyle: pktStyleFor(rate, seld || hov, rank[e.id]),
    });
  });
  const portStateFor = (id: string, side: string): PortState => { const c = s.connect; if (c && c.from === id && c.side === side) return 'origin'; return portConn[id + ':' + side] ? 'connected' : ''; };
  const isSeq = p === 'sequence';
  const nodes: NodeVM[] = [];
  s.nodes.forEach(n => {
    const t = T.TYPES[n.type]; if (!t) return;
    const st: NodeStat | undefined = m ? m.nodes[n.id] : undefined;
    const seld = !!s.sel && s.sel.kind === 'node' && s.sel.id === n.id;
    let state = '';
    if (seld) state = 'selected';
    else if (lit[n.id]) state = 'highlighted';
    else if (fc && !fc.nodes[n.id]) state = 'muted';
    else if (s.connect && s.connectInvalid && s.connectInvalid[n.id] && n.id !== s.connect.from) state = 'muted';
    const culled = isCulled(n, s.nodeH[n.id] || 88, W, s.worldBox);
    const showTel = !!st && simOn && !culled;
    const ann = annBy[n.id];
    nodes.push({
      id: n.id, kind: n.type, family: familyOf(p, n), state, x: n.x, y: n.y, w: W, pixel: s.ui.pixel, title: n.name, typeLbl: t.label.toLowerCase(),
      terminal: t.terminal ? '1' : null, initial: t.initial || t.source ? '1' : null, side: t.side ? '1' : null, form: t.form ?? null, run: null, density: isSeq ? 'compact' : null,
      aria: (t.form ? t.form + ' · ' : '') + t.label + ' ' + n.name,
      rows: culled ? [] : bodyRows(p, n),
      showTel: (showTel && !isSeq) || (showTel && isSeq && zl !== 'overview'), showBody: !culled && !isSeq && (!showTel || zl === 'detail' || !simOn), showStatus: showTel && !isSeq, showPorts: !culled,
      showHdot: simOn && !culled,
      rate: st ? fmt(st.arr) + T.HUD.rate : '', unit: st ? unitFor(p, n, st) : '',
      p99: st ? fL(p, st.lat * 2.2) : '', q: st ? fmt(st.q) : '',
      spark: sparkPts(s.nhist[n.id]),
      utilV: st ? Math.min(1, st.util) : 0,
      tone: (st ? BT[st.health] : 'ok') as Tone, dotTone: (st ? DT[st.health] : 'ok') as Tone,
      health: simOn && st && st.health !== 'ok' ? st.health : '',
      hasAnn: !!ann && !culled, annSev: ann ? ann.sev : '', annText: ann ? ann.mark : '',
      glyph: st ? HG[st.health] : '○', hword: st ? HW[st.health] : 'idle',
      pl: portStateFor(n.id, 'left'), pr: portStateFor(n.id, 'right'), pt: portStateFor(n.id, 'top'), pb: portStateFor(n.id, 'bottom'),
    });
  });
  // endpoint handles: the rewired, selected or hovered edge — in that order
  const selEdge = s.sel && s.sel.kind === 'edge' ? s.edges.find(x => x.id === s.sel!.id) : undefined;
  const activeEdge = (rw ? s.edges.find(x => x.id === rw.edgeId) : undefined) || selEdge || hoverObj;
  let ends: EndsVM | null = null;
  if (activeEdge && nById[activeEdge.from] && nById[activeEdge.to]) {
    const geo = s.routes[activeEdge.id];
    if (geo) {
      const isSel = !!selEdge && selEdge.id === activeEdge.id, k = Math.max(0.15, s.view.k);
      ends = { edgeId: activeEdge.id, x1: geo.p1[0], y1: geo.p1[1], x2: geo.p2[0], y2: geo.p2[1], hr: (s.touch ? 30 : 20) / k, vr: (isSel ? (s.touch ? 9 : 7) : (s.touch ? 7 : 5.5)) / k, isSel, strokeWidth: (isSel ? 3 : 2) / k };
    }
  }
  // no hover on touch: the card would only sit over the edge it describes, and the inspector already carries reverse / detach.
  const cardEdge = s.touch ? null : (selEdge || hoverObj) ?? null;
  const ce = cardEdge && !rw && nById[cardEdge.from] && nById[cardEdge.to] ? cardEdge : null;
  const tiers = s.mode === 'design' && s.ui.tiers ? tiersOf(p, s.nodes, s.footH) : [];
  const regions = regionsViewOf(p, s.mode, s.regions, s.sel, s.seq);
  const inY = (y: number, h = 0): boolean => !wb || (y + h >= wb.y0 && y <= wb.y1);
  const seq: SeqVM | null = s.seq ? { lines: s.seq.lines, ticks: wb ? s.seq.ticks.filter(t => inY(t.y)) : s.seq.ticks, acts: wb ? s.seq.acts.filter(a => inY(a.y, a.h)) : s.seq.acts, cursor: s.ui.trace && simOn ? { x1: s.seq.x0, x2: s.seq.x1, y: s.seq.y0 - 44 * 0.5 } : null } : null;
  const chanGuides: ChanGuide[] = s.ui.channels && s.chans ? [...s.chans.x.map(c => ({ x1: c.c, y1: c.a - 8, x2: c.c, y2: c.b + 8 })), ...s.chans.y.map(c => ({ x1: c.a - 8, y1: c.c, x2: c.b + 8, y2: c.c }))] : [];
  return {
    attrs: { paradigm: p, mode: s.mode, zoom: zl, trace: s.ui.trace && s.mode === 'simulate' ? 'on' : 'off', touch: s.touch ? '1' : '0', oLabels: s.ui.labels ? 'on' : 'off', oRates: s.ui.rates ? 'on' : 'off', oPackets: s.ui.packets ? 'on' : 'off', oSpark: s.ui.spark ? 'on' : 'off', oChan: s.ui.channels ? 'on' : 'off', chan: s.chanGap },
    viewStyle: s.viewStyle, gridStyle: s.gridStyle, tiers, regions, chanGuides, seq, edges, nodes, hasConnect: !!s.connect, ends,
    portConn, cardEdge: ce, cardGeo: ce ? s.routes[ce.id] ?? null : null,
  };
}

export const familyOfRegion = (r: GraphRegion): VisualFamily => r.family ?? 'stone';
