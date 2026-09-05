import type { GraphEdge, GraphNode } from '../model/document';
import type { Box, Pt, Side } from './geometry';

/** transient node positions during a drag */
export type Overrides = Record<string, { x: number; y: number }>;
/** a dragged edge end: follows the pointer, or snaps to a node */
export interface Ptr { edge: string; end: 'from' | 'to'; x: number; y: number; node: GraphNode | null }
export interface EdgeGeo { d: string; p1: Pt; p2: Pt; s1: Side; s2: Side; lx: number; ly: number; y?: number; i?: number; self?: boolean }
export type RouteMap = Record<string, EdgeGeo>;
export interface Corridor { c: number; a: number; b: number; lanes: Record<number, Array<{ a: number; b: number }>> }
export interface Channels { x: Corridor[]; y: Corridor[] }

export interface RouterInput {
  nodes: GraphNode[];
  edges: GraphEdge[];
  geomOf: (n: GraphNode, ov: Overrides | null) => Box;
  /** channel gap in px (the --edge-channel-gap token) */
  gap: number;
  /** 'independent' router: no port lanes, no corridors */
  plain: boolean;
  /** edge protocol label (used for label clearance width) */
  protoOf: (e: GraphEdge) => string;
  /** structured paradigms stack event · guard · action */
  structured: boolean;
}
