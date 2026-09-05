// The GraphDocument — the exchange format AND the flat shape the renderer, router and
// simulators consume. Paradigm-specific configuration rides on the node/edge as optional
// fields (the prototype's flat model), so no module needs a `data` indirection.
// NOTE: lens state (mode, zoom, layer toggles, rps slider) lives OUTSIDE the document.
export type ParadigmId = 'architecture' | 'workflow' | 'sequence' | 'dataflow' | 'state';
export const PARADIGM_IDS: readonly ParadigmId[] = ['architecture', 'workflow', 'sequence', 'dataflow', 'state'];

/** The visual family is the ONLY channel that may drive colour. Public, persisted. */
export type VisualFamily = 'indigo' | 'emerald' | 'amber' | 'purple' | 'cyan' | 'orange' | 'stone' | 'danger';
export const VISUAL_FAMILIES: readonly VisualFamily[] = ['indigo', 'emerald', 'amber', 'purple', 'cyan', 'orange', 'stone', 'danger'];

export type RegionVariant = 'boundary' | 'lane' | 'stage' | 'phase' | 'zone';
export const REGION_VARIANTS: readonly RegionVariant[] = ['boundary', 'lane', 'stage', 'phase', 'zone'];

export type EdgeRel = 'flow' | 'dependency' | 'async' | 'inheritance' | 'implementation' | 'composition' | 'proposed';

/** A workflow lane is a structural owner, not a decorative band. */
export type OwnerKind = 'team' | 'system' | 'actor' | 'boundary';
export const OWNER_KIND_IDS: readonly OwnerKind[] = ['team', 'system', 'actor', 'boundary'];

/** Data-flow anatomy: data (at rest / in transit) vs process (transformation / execution). */
export type NodeForm = 'data' | 'process';

/**
 * Semantic kind is `type` (the paradigm type key: 'approval' | 'stream' | 'waiting' | …).
 * `visualFamily` is resolved from the paradigm type and persisted so round-trips are stable.
 * Everything after `y` is paradigm configuration; every field is optional and the paradigm
 * registry's `nodeDefaults` fills the ones its type declares.
 */
export interface GraphNode {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  visualFamily?: VisualFamily;
  // capacity model — architecture · data flow
  inst?: number;
  cap?: number;
  ms?: number;
  share?: number;
  role?: string;
  // workflow
  owner?: string;
  dur?: number;
  pass?: number;
  input?: string;
  output?: string;
  // sequence
  conc?: number;
  // data flow
  schema?: string;
  retention?: number;
  parts?: number;
  pii?: number;
  // state machine
  dwell?: number;
  entry?: string;
  exit?: string;
  [k: string]: unknown;
}

/** `kind` is the paradigm edge kind (http · next · request · stream · event …). */
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
  label: string;
  w: number;
  // structured transitions (workflow · state)
  guard?: string;
  action?: string;
  // sequence
  seq?: number;
  lat?: number;
  payload?: string;
  // state machine
  p?: number;
  timeout?: number;
  [k: string]: unknown;
}

/**
 * Sequence phases are ranges of message order (`from`–`to`) rather than rectangles; their
 * x/y/w/h are 0 in the document and derived at render time.
 */
export interface GraphRegion {
  id: string;
  variant: RegionVariant;
  label: string;
  family?: VisualFamily;
  x: number;
  y: number;
  w: number;
  h: number;
  owner?: string;
  ownerKind?: OwnerKind;
  dashed?: number;
  from?: number;
  to?: number;
  /** authored lane height — the floor a lane shrinks back to when steps leave */
  baseH?: number;
}

export interface View {
  x: number;
  y: number;
  k: number;
}

export interface GraphDocument {
  version: 3;
  id: string;
  title: string;
  paradigm: ParadigmId;
  nodes: GraphNode[];
  edges: GraphEdge[];
  regions: GraphRegion[];
  metadata: Record<string, unknown> & { load?: number };
  view: View;
}

export type SelectionKind = 'node' | 'edge' | 'region';
export interface Selection {
  kind: SelectionKind;
  id: string;
}

/** The flat graph a snapshot / park / layout pass carries around. */
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  regions: GraphRegion[];
}
