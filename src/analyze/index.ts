import type { GraphEdge, GraphNode, GraphRegion, ParadigmId } from '../model/document';
import type { Metrics } from '../sim/types';
import { analyzeArchitecture } from './architecture';
import { analyzeParadigm } from './paradigms';
import type { Analysis } from './types';

export * from './types';
export * from './architecture';
export * from './paradigms';

/** one entry point for every paradigm; empty when there is nothing to judge */
export function analyze(pid: ParadigmId, nodes: GraphNode[], edges: GraphEdge[], m: Metrics | null, regions: GraphRegion[], rps: number): Analysis {
  if (!nodes.length) return { list: [], a: null, b: null };
  if (pid !== 'architecture') return analyzeParadigm(pid, nodes, edges, m, regions);
  return analyzeArchitecture({ nodes, edges, metrics: m, rps });
}
