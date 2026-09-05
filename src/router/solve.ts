// gen-2 edge router — port lanes, shared corridors, cost-ranked candidates (WB 995–1131).
// every edge is routed against every other edge, so the solve is per-graph and memoized on geometry
import type { GraphEdge } from '../model/document';
import { DIRV, anchorOf, pathFrom, sidesFor, type Box, type Pt, type Side } from './geometry';
import type { Channels, Corridor, Overrides, Ptr, RouteMap, RouterInput } from './types';

// a corridor holds parallel lanes one channel-gap apart; disjoint spans reuse the same lane
export function laneIn(ch: Corridor, a: number, b: number, commit: boolean): number {
  for (let n = 0; n < 16; n++) {
    const li = n === 0 ? 0 : (n % 2 ? Math.ceil(n / 2) : -Math.ceil(n / 2));
    const occ = ch.lanes[li] || (ch.lanes[li] = []);
    if (occ.every(s => b < s.a - 5 || a > s.b + 5)) { if (commit) occ.push({ a, b }); return li; }
  }
  return 0;
}

interface Item { e: GraphEdge; A: Box; B: Box; aId: string | null; bId: string | null; s1: Side; s2: Side; o1: number; o2: number; p1: Pt; p2: Pt; q1: Pt; q2: Pt; axis: 'x' | 'y'; span: number; pts: Pt[]; lx: number; ly: number }
interface Seg { v: 0 | 1; c: number; a: number; b: number }
interface Rect { x0: number; x1: number; y0: number; y1: number }

export interface SolveResult { routes: RouteMap; chans: Channels }

export function solveRoutes(input: RouterInput, ov: Overrides | null, ptr: Ptr | null): SolveResult {
  const { gap, plain } = input, ST = 18, PAD = 9;
  const nById: Record<string, 1> = {}; input.nodes.forEach(n => nById[n.id] = 1);
  const box: Record<string, Box> = {}; input.nodes.forEach(n => { const g = input.geomOf(n, ov); g.id = n.id; box[n.id] = g; });
  const boxes = input.nodes.map(n => box[n.id]!);
  const items: Item[] = [];
  input.edges.forEach(e => {
    if (!nById[e.from] || !nById[e.to]) return;
    let A: Box | undefined = box[e.from], B: Box | undefined = box[e.to], aId: string | null = e.from, bId: string | null = e.to;
    // a dragged end follows the pointer as a zero-size box — unless it has snapped to a
    // node, in which case route against the real geometry so the preview IS the result
    if (ptr && ptr.edge === e.id) {
      if (ptr.end === 'from') { aId = ptr.node ? ptr.node.id : null; A = aId ? box[aId] : { x: ptr.x, y: ptr.y, w: 0, h: 0 }; }
      else { bId = ptr.node ? ptr.node.id : null; B = bId ? box[bId] : { x: ptr.x, y: ptr.y, w: 0, h: 0 }; }
    }
    if (!A || !B) return;
    const ss = sidesFor(A, B);
    items.push({ e, A, B, aId, bId, s1: ss[0], s2: ss[1], o1: 0, o2: 0, p1: [0, 0], p2: [0, 0], q1: [0, 0], q2: [0, 0], axis: 'x', span: 0, pts: [], lx: 0, ly: 0 });
  });
  // 1. port lanes — edges sharing a node side fan out, ordered by the far end so they don't cross at the border
  if (!plain) {
    const grp: Record<string, Array<[Item, 0 | 1]>> = {};
    items.forEach(it => {
      if (it.aId) (grp[it.aId + '|' + it.s1] = grp[it.aId + '|' + it.s1] || []).push([it, 0]);
      if (it.bId) (grp[it.bId + '|' + it.s2] = grp[it.bId + '|' + it.s2] || []).push([it, 1]);
    });
    for (const key in grp) {
      const g = grp[key]!, n = g.length; if (n < 2) continue;
      const side = key.slice(key.indexOf('|') + 1), hz = side === 'left' || side === 'right';
      const G = g[0]![1] ? g[0]![0].B : g[0]![0].A;
      const cross = (m: [Item, 0 | 1]): number => { const F = m[1] ? m[0].A : m[0].B; return hz ? F.y + F.h / 2 : F.x + F.w / 2; };
      g.sort((p, q) => cross(p) - cross(q) || (p[0].e.id < q[0].e.id ? -1 : 1));
      const pitch = Math.min(gap * 2, Math.max(gap, ((hz ? G.h : G.w) - 28) / n));
      g.forEach((m, i) => { const o = pitch * (i - (n - 1) / 2); if (m[1]) m[0].o2 = o; else m[0].o1 = o; });
    }
  }
  items.forEach(it => {
    it.p1 = anchorOf(it.A, it.s1, it.o1); it.p2 = anchorOf(it.B, it.s2, it.o2);
    const d1 = DIRV[it.s1], d2 = DIRV[it.s2];
    it.q1 = [it.p1[0] + d1[0] * ST, it.p1[1] + d1[1] * ST];
    it.q2 = [it.p2[0] + d2[0] * ST, it.p2[1] + d2[1] * ST];
    const hz = it.s1 === 'left' || it.s1 === 'right';
    const fwd = hz ? (it.s1 === 'right' ? it.q2[0] >= it.q1[0] : it.q2[0] <= it.q1[0])
                   : (it.s1 === 'bottom' ? it.q2[1] >= it.q1[1] : it.q2[1] <= it.q1[1]);
    it.axis = hz === fwd ? 'x' : 'y'; // the trunk's free coordinate: 'x' = vertical trunk
    it.span = Math.abs(it.q2[0] - it.q1[0]) + Math.abs(it.q2[1] - it.q1[1]);
  });
  const clean = (pts: Pt[]): Pt[] => { const o: Pt[] = []; pts.forEach(p => { const l = o[o.length - 1]; if (!l || Math.abs(l[0] - p[0]) > 0.5 || Math.abs(l[1] - p[1]) > 0.5) o.push(p); }); return o; };
  const segsOf = (pts: Pt[]): Seg[] => {
    const o: Seg[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i]!, q = pts[i + 1]!;
      if (Math.abs(p[0] - q[0]) < 0.5) o.push({ v: 1, c: p[0], a: Math.min(p[1], q[1]), b: Math.max(p[1], q[1]) });
      else o.push({ v: 0, c: p[1], a: Math.min(p[0], q[0]), b: Math.max(p[0], q[0]) });
    }
    return o;
  };
  const crossN = (s: Seg, t: Seg): number => { if (s.v === t.v) return 0; const V = s.v ? s : t, H = s.v ? t : s; return H.a < V.c - 0.5 && H.b > V.c + 0.5 && V.a < H.c - 0.5 && V.b > H.c + 0.5 ? 1 : 0; };
  const overN = (s: Seg, t: Seg): number => s.v === t.v && Math.abs(s.c - t.c) < gap * 0.7 && Math.min(s.b, t.b) - Math.max(s.a, t.a) > 8 ? 1 : 0;
  const iv = (B: Box, k: 0 | 1): [number, number] => k ? [B.y - PAD, B.y + B.h + PAD] : [B.x - PAD, B.x + B.w + PAD];
  const blockN = (sg: Seg[], obs: Box[]): number => { let n = 0; sg.forEach(s => obs.forEach(B => { const x = iv(B, 0), y = iv(B, 1); if (s.v ? s.c > x[0] && s.c < x[1] && s.a < y[1] && s.b > y[0] : s.c > y[0] && s.c < y[1] && s.a < x[1] && s.b > x[0]) n++; })); return n; };
  const longest = (pts: Pt[]): { p: Pt; q: Pt; len: number } => { let bi = 0, bl = -1; for (let k = 0; k < pts.length - 1; k++) { const l = Math.abs(pts[k]![0] - pts[k + 1]![0]) + Math.abs(pts[k]![1] - pts[k + 1]![1]); if (l > bl) { bl = l; bi = k; } } return { p: pts[bi]!, q: pts[bi + 1]!, len: bl }; };
  const rectAt = (x: number, y: number, w: number, h?: number): Rect => { const ex = (h || 1) - 1; return { x0: x - w / 2, x1: x + w / 2, y0: y - 15 - ex * 6, y1: y + 7 + ex * 6 }; };
  const hitR = (r: Rect, ls: Rect[]): boolean => ls.some(o => o.x0 < r.x1 && o.x1 > r.x0 && o.y0 < r.y1 && o.y1 > r.y0);
  const placed: Seg[] = [], labs: Rect[] = [], chan: Channels = { x: [], y: [] };
  // 2. corridors — candidates scored node avoidance > crossings > overlap > bends > channel reuse > label clearance
  items.slice().sort((a, b) => b.span - a.span || (a.e.id < b.e.id ? -1 : 1)).forEach(it => {
    const obs = boxes.filter(B => B.id !== it.aId && B.id !== it.bId);
    const ax = it.axis, i: 0 | 1 = ax === 'x' ? 0 : 1, j: 0 | 1 = i === 0 ? 1 : 0, a = it.q1, b = it.q2;
    const ideal = (a[i] + b[i]) / 2, lo = Math.min(a[i], b[i]), hi = Math.max(a[i], b[i]);
    const t0 = Math.min(a[j], b[j]), t1 = Math.max(a[j], b[j]);
    const mk = (c: number): Pt[] => clean(ax === 'x' ? [it.p1, a, [c, a[1]], [c, b[1]], b, it.p2] : [it.p1, a, [a[0], c], [b[0], c], b, it.p2]);
    let cs: number[];
    if (plain) cs = [ideal];
    else {
      const raw = [ideal, lo + 26, hi - 26], bands: [number, number][] = [];
      obs.forEach(B => { const rel = iv(B, j); if (Math.min(t1, rel[1]) > Math.max(t0, rel[0])) bands.push(iv(B, i)); });
      bands.sort((p, q) => p[0] - q[0]);
      const mg: [number, number][] = []; let cur: [number, number] | null = null;
      bands.forEach(bd => { if (cur && bd[0] <= cur[1] + 1) cur[1] = Math.max(cur[1], bd[1]); else mg.push(cur = [bd[0], bd[1]]); });
      for (let k = 0; k < mg.length - 1; k++) raw.push((mg[k]![1] + mg[k + 1]![0]) / 2); // gutter between node columns
      if (mg.length) { raw.push(mg[0]![0] - 18); raw.push(mg[mg.length - 1]![1] + 18); }
      chan[ax].forEach(ch => { if (Math.abs(ch.c - ideal) < 96) raw.push(ch.c); }); // reuse an open corridor
      const room = hi - lo, mn = room >= 56 ? lo + 14 : ideal - 46, mx = room >= 56 ? hi - 14 : ideal + 46;
      cs = [...new Set(raw.filter(v => v >= mn - 0.5 && v <= mx + 0.5).map(v => Math.round(v)))];
      if (!cs.length) cs = [Math.round(Math.max(mn, Math.min(mx, ideal)))];
    }
    type Best = { sc: number; c: number; ch: Corridor | null; pts: Pt[]; sg: Seg[] };
    let best: Best | null = null;
    for (const v of cs) {
      const ch = plain ? null : (chan[ax].find(c => Math.abs(c.c - v) <= gap * 2.2) ?? null);
      const lane = ch ? laneIn(ch, t0, t1, false) : 0;
      const c = ch ? ch.c + lane * gap : v;
      const pts = mk(c), sg = segsOf(pts);
      let cr = 0, ovl = 0, bends = 0;
      sg.forEach(s => placed.forEach(t => { cr += crossN(s, t); ovl += overN(s, t); }));
      for (let k = 1; k < sg.length; k++) if (sg[k]!.v !== sg[k - 1]!.v) bends++;
      const L = longest(pts), lr = rectAt((L.p[0] + L.q[0]) / 2, (L.p[1] + L.q[1]) / 2, 40);
      const sc = blockN(sg, obs) * 900 + ovl * 46 + cr * 24 + bends * 11
        + (ch ? Math.abs(lane) * 1.6 : 9) + Math.abs(c - ideal) * 0.13 + (hitR(lr, labs) ? 4 : 0);
      if (!best || sc < best.sc) best = { sc, c, ch, pts, sg };
    }
    if (!best) throw new Error('router: no candidate corridor');
    const b2: Best = best;
    if (b2.ch) { laneIn(b2.ch, t0, t1, true); b2.ch.a = Math.min(b2.ch.a, t0); b2.ch.b = Math.max(b2.ch.b, t1); }
    else if (!plain) chan[ax].push({ c: b2.c, a: t0, b: t1, lanes: { 0: [{ a: t0, b: t1 }] } });
    b2.sg.forEach(s => placed.push(s));
    it.pts = b2.pts;
    // 3. label clearance — slide along the longest run until the box is clear
    const L = longest(it.pts), hz = Math.abs(L.p[1] - L.q[1]) < 0.5;
    const mx0 = (L.p[0] + L.q[0]) / 2, my0 = (L.p[1] + L.q[1]) / 2;
    const tw = Math.max((it.e.label || '').length, (it.e.guard || '').length + 2, (it.e.action || '').length + 2, (input.protoOf(it.e) || '').length + 7) * 6 + 12;
    const th = input.structured ? 1 + (it.e.guard ? 1 : 0) + (it.e.action ? 1 : 0) : 1;
    let lx = mx0, ly = my0, done = false;
    for (const sh of [0, 22, -22, 40, -40, 62, -62]) {
      if (Math.abs(sh) > L.len / 2 - 8) continue;
      const cx = hz ? mx0 + sh : mx0, cy = hz ? my0 : my0 + sh, r = rectAt(cx, cy, tw, th);
      if (hitR(r, labs) || boxes.some(B => B.x - 3 < r.x1 && B.x + B.w + 3 > r.x0 && B.y - 3 < r.y1 && B.y + B.h + 3 > r.y0)) continue;
      lx = cx; ly = cy; done = true; labs.push(r); break;
    }
    if (!done) labs.push(rectAt(lx, ly, tw, th));
    it.lx = lx; it.ly = ly - 6;
  });
  const out: RouteMap = {}, r = Math.max(3, Math.min(6, gap - 2));
  items.forEach(it => {
    const dp = it.pts.slice(), dv = DIRV[it.s2];
    dp[dp.length - 1] = [it.p2[0] + dv[0] * 3, it.p2[1] + dv[1] * 3];
    out[it.e.id] = { d: pathFrom(dp, r), p1: it.p1, p2: it.p2, s1: it.s1, s2: it.s2, lx: it.lx, ly: it.ly };
  });
  return { routes: out, chans: chan };
}
