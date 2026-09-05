import type { GraphNode, GraphRegion, ParadigmId, View } from '../model/document';

export interface Bounds { x0: number; y0: number; x1: number; y1: number }
export interface Rect { width: number; height: number }
export interface DocBoundsInput { nodes: GraphNode[]; regions: GraphRegion[]; paradigm: ParadigmId; W: number; footH: (id: string) => number; seq: { yEnd: number; x0: number; x1: number } | null }

export function docBounds(s: DocBoundsInput): Bounds {
  const { nodes } = s;
  let x0 = Math.min(...nodes.map(n => n.x)), y0 = Math.min(...nodes.map(n => n.y)), x1 = Math.max(...nodes.map(n => n.x + s.W)), y1 = Math.max(...nodes.map(n => n.y + s.footH(n.id)));
  (s.regions || []).forEach(r => { if (r.variant === 'phase' && s.paradigm === 'sequence') return; if (!(r.w > 0)) return; x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); });
  if (s.paradigm === 'sequence' && s.seq) { y1 = Math.max(y1, s.seq.yEnd + 16); x0 = Math.min(x0, s.seq.x0); x1 = Math.max(x1, s.seq.x1); }
  return { x0, y0, x1, y1 };
}
/** the fitted view for a document box inside a canvas rect (WB 1867–1879) */
export function fitView(B: Bounds, r: Rect): View {
  const x0 = B.x0 - 40, y0 = B.y0 - 40, x1 = B.x1 + 40, y1 = B.y1 + 40;
  // 0.97 slack absorbs node heights that grow slightly after measurement (status rows appearing)
  // fit stays exact: snapping it down wasted a whole rung of space, and crispness is earned
  // back the moment the user zooms — every gesture and button lands on the ladder
  const k = Math.min(1.1, Math.max(0.15, Math.min(r.width / (x1 - x0), r.height / (y1 - y0)) * 0.97));
  return { k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - (y1 - y0) * k) / 2 - y0 * k };
}
/** zoom to k about the canvas centre */
export function zoomCentred(v: View, k: number, r: Rect): View { return { k, x: r.width / 2 - (r.width / 2 - v.x) * k / v.k, y: r.height / 2 - (r.height / 2 - v.y) * k / v.k }; }
