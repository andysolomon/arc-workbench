// The route memo key: re-solve only when geometry, port sides or the edge set actually change.
import type { GraphEdge, GraphNode, ParadigmId } from '../model/document';
import type { Box } from './geometry';
import type { Overrides, Ptr } from './types';

export interface SigInput { paradigm: ParadigmId; gap: number; plain: boolean; labels: boolean; nodes: GraphNode[]; edges: GraphEdge[]; geomOf: (n: GraphNode, ov: Overrides | null) => Box }
export function routeSig(s: SigInput, ov: Overrides | null, ptr: Ptr | null): string {
  let k = s.paradigm + s.gap + (s.plain ? 'i' : 'c') + (s.labels ? 'L' : '');
  for (const n of s.nodes) { const g = s.geomOf(n, ov); k += '|' + n.id + ',' + Math.round(g.x) + ',' + Math.round(g.y) + ',' + Math.round(g.h); }
  for (const e of s.edges) k += '|' + e.id + '>' + e.from + '>' + e.to + (e.label ? '#' + e.label : '') + (e.guard ? '[' + e.guard : '') + (e.action ? '/' + e.action : '') + (e.seq != null ? '@' + e.seq : '');
  if (ptr) k += '@' + ptr.edge + ',' + ptr.end + ',' + Math.round(ptr.x) + ',' + Math.round(ptr.y) + ',' + (ptr.node ? ptr.node.id : '-');
  return k;
}
