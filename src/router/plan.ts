// Route memo: re-solve only when the signature changes (WB 980–993). Sequence messages take
// the timeline router; everything else the corridor solver.
import type { GraphEdge, GraphNode, ParadigmId } from '../model/document';
import type { Box } from './geometry';
import { seqRoutes } from './sequence';
import { routeSig } from './signature';
import { solveRoutes } from './solve';
import type { Channels, EdgeGeo, Overrides, Ptr, RouteMap, RouterInput } from './types';

export interface PlanInput extends RouterInput { paradigm: ParadigmId; labels: boolean; nodeH: Record<string, number> }

export class RoutePlanner {
  private plan: { sig: string; map: RouteMap } | null = null;
  chans: Channels | null = null;

  sig(s: PlanInput, ov: Overrides | null, ptr: Ptr | null): string { return routeSig(s, ov, ptr); }
  routes(s: PlanInput, ov: Overrides | null, ptr: Ptr | null): RouteMap {
    const sig = routeSig(s, ov, ptr);
    if (this.plan && this.plan.sig === sig) return this.plan.map;
    this.plan = { sig, map: this.solve(s, ov, ptr) };
    return this.plan.map;
  }
  solve(s: PlanInput, ov: Overrides | null, ptr: Ptr | null): RouteMap {
    if (s.paradigm === 'sequence') return seqRoutes(s, ov, ptr);
    const r = solveRoutes(s, ov, ptr);
    this.chans = r.chans;
    return r.routes;
  }
  edgeGeom(s: PlanInput, e: GraphEdge, ov: Overrides | null, ptr: Omit<Ptr, 'edge'> | null): EdgeGeo | null {
    return this.routes(s, ov, ptr ? { ...ptr, edge: e.id } : null)[e.id] ?? null;
  }
  invalidate(): void { this.plan = null; }
}

/** default node geometry: measured height, else 88 */
export const geomOfWith = (W: number, nodeH: Record<string, number>) => (n: GraphNode, ov: Overrides | null): Box => { const o = ov && ov[n.id]; return { x: o ? o.x : n.x, y: o ? o.y : n.y, w: W, h: nodeH[n.id] || 88 }; };
