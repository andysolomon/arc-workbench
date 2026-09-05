// a document per paradigm: switching never destroys work — the other document is parked (WB 759)
import type { GraphEdge, GraphNode, GraphRegion, ParadigmId, View } from '../model/document';

export interface ParkedDoc { nodes: GraphNode[]; edges: GraphEdge[]; regions: GraphRegion[]; rps: number; presetId: string; view: View; touched: boolean; hist: string[]; future: string[] }
export type Docks = Partial<Record<ParadigmId, ParkedDoc | null>>;
export const park = (docs: Docks, pid: ParadigmId, d: ParkedDoc): void => { docs[pid] = d; };
export const parked = (docs: Docks, pid: ParadigmId): ParkedDoc | null => docs[pid] ?? null;
export const docCount = (docs: Docks, pid: ParadigmId, current: ParadigmId, n: number): number => pid === current ? n : (docs[pid]?.nodes.length ?? 0);
