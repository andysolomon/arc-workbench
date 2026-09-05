// Orthogonal edge geometry — sides, anchors, the simple two-bend route for previews, and the
// rounded path emitter. Verbatim from the prototype (WB 944–978).
export type Side = 'left' | 'right' | 'top' | 'bottom';
export type Pt = [number, number];
export interface Box { x: number; y: number; w: number; h: number; id?: string }

export const DIRV: Record<Side, Pt> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

export function sidesFor(A: Box, B: Box): [Side, Side] {
  const dx = (B.x + B.w / 2) - (A.x + A.w / 2), dy = (B.y + B.h / 2) - (A.y + A.h / 2);
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? ['right', 'left'] : ['left', 'right']) : (dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom']);
}
export function anchorOf(G: Box, s: Side, o?: number): Pt { const t = o || 0; return s === 'left' ? [G.x, G.y + G.h / 2 + t] : s === 'right' ? [G.x + G.w, G.y + G.h / 2 + t] : s === 'top' ? [G.x + G.w / 2 + t, G.y] : [G.x + G.w / 2 + t, G.y + G.h]; }

export function routePts(p1: Pt, s1: Side, p2: Pt, s2: Side): Pt[] {
  const st = 18, d1 = DIRV[s1], d2 = DIRV[s2];
  const q1: Pt = [p1[0] + d1[0] * st, p1[1] + d1[1] * st], q2: Pt = [p2[0] + d2[0] * st, p2[1] + d2[1] * st];
  let mid: Pt[];
  if (s1 === 'left' || s1 === 'right') {
    const fwd = s1 === 'right' ? q2[0] >= q1[0] : q2[0] <= q1[0];
    if (fwd) { const mx = (q1[0] + q2[0]) / 2; mid = [[mx, q1[1]], [mx, q2[1]]]; }
    else { const my = (q1[1] + q2[1]) / 2; mid = [[q1[0], my], [q2[0], my]]; }
  } else {
    const fwd = s1 === 'bottom' ? q2[1] >= q1[1] : q2[1] <= q1[1];
    if (fwd) { const my = (q1[1] + q2[1]) / 2; mid = [[q1[0], my], [q2[0], my]]; }
    else { const mx = (q1[0] + q2[0]) / 2; mid = [[mx, q1[1]], [mx, q2[1]]]; }
  }
  const raw: Pt[] = [p1, q1, ...mid, q2, p2], out: Pt[] = [];
  raw.forEach(p => { const l = out[out.length - 1]; if (!l || Math.abs(l[0] - p[0]) > 0.5 || Math.abs(l[1] - p[1]) > 0.5) out.push(p); });
  return out;
}
export function pathFrom(pts: Pt[], r: number): string {
  if (pts.length < 2) return '';
  let d = 'M' + pts[0]![0] + ' ' + pts[0]![1];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]!, b = pts[i]!, c = pts[i + 1]!;
    const d1 = Math.hypot(b[0] - a[0], b[1] - a[1]), d2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    d += 'L' + (b[0] - (b[0] - a[0]) / d1 * rr) + ' ' + (b[1] - (b[1] - a[1]) / d1 * rr) + 'Q' + b[0] + ' ' + b[1] + ' ' + (b[0] + (c[0] - b[0]) / d2 * rr) + ' ' + (b[1] + (c[1] - b[1]) / d2 * rr);
  }
  const l = pts[pts.length - 1]!;
  return d + 'L' + l[0] + ' ' + l[1];
}
