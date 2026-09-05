// ---- sequence geometry: participants across, time down. One shared layer, rows of --seq-row ----
// Messages skip the orthogonal router and the overlap solver entirely (WB 782–828).
import type { GraphEdge, GraphNode, GraphRegion, VisualFamily } from '../model/document';
import { pathFrom, type Box, type Pt, type Side } from './geometry';
import type { Overrides, Ptr, RouteMap } from './types';
import type { Timeline } from '../sim/types';

export const SEQ = { row: 44, top: 40, act: 8 } as const;

export function seqMsgs(nodes: GraphNode[], edges: GraphEdge[]): GraphEdge[] {
  const by: Record<string, 1> = {}; nodes.forEach(n => by[n.id] = 1);
  return edges.filter(e => by[e.from] && by[e.to]).slice().sort((a, b) => (a.seq || 0) - (b.seq || 0) || (a.id < b.id ? -1 : 1));
}
export function seqY0(nodes: GraphNode[], nodeH: Record<string, number>): number {
  if (!nodes.length) return 100;
  return Math.max(...nodes.map(n => n.y + (nodeH[n.id] || 60))) + SEQ.top;
}

export interface SeqInput { nodes: GraphNode[]; edges: GraphEdge[]; nodeH: Record<string, number>; geomOf: (n: GraphNode, ov: Overrides | null) => Box }
export function seqRoutes(s: SeqInput, ov: Overrides | null, ptr: Ptr | null): RouteMap {
  const by: Record<string, GraphNode> = {}; s.nodes.forEach(n => by[n.id] = n);
  const out: RouteMap = {}, msgs = seqMsgs(s.nodes, s.edges), y0 = seqY0(s.nodes, s.nodeH), row = SEQ.row, half = SEQ.act / 2;
  const cx = (n: GraphNode): number => { const g = s.geomOf(n, ov); return g.x + g.w / 2; };
  msgs.forEach((e, i) => {
    const A = by[e.from], B = by[e.to]; if (!A || !B) return;
    const y = y0 + i * row;
    let x1 = cx(A), x2 = cx(B);
    if (ptr && ptr.edge === e.id) { if (ptr.end === 'from') x1 = ptr.node ? cx(ptr.node) : ptr.x; else x2 = ptr.node ? cx(ptr.node) : ptr.x; }
    let pts: Pt[], p1: Pt, p2: Pt, s1: Side, s2: Side, lx: number, ly: number, self = false;
    if (Math.abs(x1 - x2) < 1) { self = true; p1 = [x1 + half, y]; p2 = [x1 + half + 3, y + 18]; pts = [p1, [x1 + 48, y], [x1 + 48, y + 18], p2]; s1 = 'right'; s2 = 'right'; lx = x1 + 60; ly = y + 12; }
    else { const d = x2 > x1 ? 1 : -1; p1 = [x1 + d * (half + 1), y]; p2 = [x2 - d * (half + 3), y]; pts = [p1, p2]; s1 = d > 0 ? 'right' : 'left'; s2 = d > 0 ? 'left' : 'right'; lx = (x1 + x2) / 2; ly = y - 6; }
    out[e.id] = { d: pathFrom(pts, 3), p1, p2, s1, s2, lx, ly, y, i, self };
  });
  return out;
}

export interface Lifeline { id: string; x: number; y1: number; y2: number }
export interface Activation { id: string; y: number; h: number; family: VisualFamily; x: number; w: number }
export interface SeqTick { x1: number; x2: number; y: number; ty: number; label: string }
export interface SeqPhase extends GraphRegion { alt: '1' | null }
export interface SeqGeo { lines: Lifeline[]; acts: Activation[]; ticks: SeqTick[]; phases: SeqPhase[]; y0: number; yEnd: number; x0: number; x1: number; tl: Timeline<GraphEdge> }

export interface SeqGeoInput extends SeqInput {
  regions: GraphRegion[];
  W: number;
  edgeDef: (e: GraphEdge) => { back?: true; nowait?: true } | undefined;
  familyOf: (n: GraphNode) => VisualFamily;
  timeline: (msgs: GraphEdge[]) => Timeline<GraphEdge>;
}
// activation spans: a participant is active from the first message it receives in a request
// until it sends its reply (a "back" message); open spans close at the last row.
export function seqGeo(s: SeqGeoInput): SeqGeo {
  const msgs = seqMsgs(s.nodes, s.edges), y0 = seqY0(s.nodes, s.nodeH), row = SEQ.row, n = msgs.length;
  const by: Record<string, GraphNode> = {}; s.nodes.forEach(p => by[p.id] = p);
  if (!s.nodes.length) return { lines: [], acts: [], ticks: [], phases: [], y0, yEnd: y0, x0: 0, x1: 0, tl: { msgs: [], total: 0 } };
  const yEnd = y0 + Math.max(n, 1) * row + 8;
  const lines: Lifeline[] = s.nodes.map(p => ({ id: p.id, x: p.x + s.W / 2, y1: p.y + (s.nodeH[p.id] || 60), y2: yEnd }));
  const open: Record<string, { y: number }> = {}, acts: Array<Omit<Activation, 'x' | 'w'>> = [];
  msgs.forEach((e, i) => {
    const d = s.edgeDef(e) ?? {}, y = y0 + i * row;
    if (d.back) { const o = open[e.from]; if (o) { acts.push({ id: e.from, y: o.y, h: Math.max(row * 0.35, y - o.y + 4), family: s.familyOf(by[e.from]!) }); delete open[e.from]; } }
    else if (!d.nowait && e.from !== e.to && !open[e.to]) open[e.to] = { y: y - 4 };
  });
  Object.keys(open).forEach(id => acts.push({ id, y: open[id]!.y, h: yEnd - open[id]!.y - 8, family: s.familyOf(by[id]!) }));
  const acts2: Activation[] = acts.map(a => { const p = by[a.id]!; return { ...a, x: p.x + s.W / 2 - SEQ.act / 2, w: SEQ.act }; });
  // time ruler from the deterministic timeline
  const tl = s.timeline(msgs), ticks: SeqTick[] = [];
  const x0 = Math.min(...s.nodes.map(p => p.x)) - 24, x1 = Math.max(...s.nodes.map(p => p.x + s.W)) + 24;
  tl.msgs.forEach((m, i) => { if (i % 4 === 0 || i === tl.msgs.length - 1) ticks.push({ x1: x0, x2: x1, y: y0 + i * row - row * 0.5, ty: y0 + i * row - row * 0.5 - 4, label: 't+' + Math.round(m.start) + 'ms' }); });
  // phases: regions with from/to message numbers become bands across the timeline
  const phases: SeqPhase[] = (s.regions || []).filter(r => r.variant === 'phase').map((r, k) => {
    const a = Math.max(1, r.from || 1), b = Math.max(a, r.to || n), ya = y0 + (a - 1) * row - row * 0.5, yb = y0 + (b - 1) * row + row * 0.5;
    return { ...r, x: x0, y: ya, w: x1 - x0, h: yb - ya, alt: k % 2 ? '1' : null };
  });
  return { lines, acts: acts2, ticks, phases, y0, yEnd, x0, x1, tl };
}
