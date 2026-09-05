// v1 exchange shape (paradigms.js toDoc: kind / position / data, relationship / source /
// target, regions keyed by a legacy graph-kind alias) → v3 flat document. The legacy alias
// cannot be named here (model imports nothing), so the caller supplies the resolver.
import { isGraphDocument, isOwnerKind, isParadigmId, isRegionVariant, isVisualFamily } from './guards';
import type { GraphDocument, GraphEdge, GraphNode, GraphRegion, View, VisualFamily } from './document';

export interface V1Node { id: string; kind: string; visualFamily?: string; position: { x: number; y: number }; data: Record<string, unknown> }
export interface V1Edge { id: string; relationship: string; source: string; target: string; data: Record<string, unknown> }
export interface V1Region extends Record<string, unknown> { id: string; variant: string; label: string; kind?: string; family?: string; x: number; y: number; w: number; h: number }
export interface V1Document {
  version: 1; id: string; title: string; paradigm: string;
  nodes: V1Node[]; edges: V1Edge[]; regions?: V1Region[];
  metadata?: Record<string, unknown>; view?: View;
}

export interface MigrationHooks {
  /** resolve a legacy region alias (an internal rendering name) to its visual family */
  familyOfAlias: (alias: string) => VisualFamily;
}

export class MigrationError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function isV1Document(v: unknown): v is V1Document {
  return isObj(v) && v['version'] === 1 && Array.isArray(v['nodes']) && Array.isArray(v['edges']) && typeof v['paradigm'] === 'string';
}

function nodeFromV1(n: V1Node): GraphNode {
  const out: GraphNode = { ...n.data, id: n.id, type: n.kind, name: String(n.data['name'] ?? n.id), x: n.position.x, y: n.position.y };
  if (isVisualFamily(n.visualFamily)) out.visualFamily = n.visualFamily;
  return out;
}
function edgeFromV1(e: V1Edge): GraphEdge {
  const d = e.data;
  return { ...d, id: e.id, kind: e.relationship, from: e.source, to: e.target, label: String(d['label'] ?? ''), w: typeof d['w'] === 'number' ? d['w'] : 1 };
}
export function regionFromV1(r: V1Region, hooks: MigrationHooks): GraphRegion {
  if (!isRegionVariant(r.variant)) throw new MigrationError('unknown region variant ' + r.variant);
  const { kind, family, variant, ownerKind, ...rest } = r;
  const out: GraphRegion = { ...(rest as Omit<GraphRegion, 'variant' | 'family' | 'ownerKind'>), variant };
  if (isVisualFamily(family)) out.family = family;
  else if (typeof kind === 'string') out.family = hooks.familyOfAlias(kind);
  if (isOwnerKind(ownerKind)) out.ownerKind = ownerKind;
  return out;
}

/** Upgrade any supported document version to v3. Throws MigrationError on garbage. */
export function migrate(input: unknown, hooks: MigrationHooks): GraphDocument {
  if (isGraphDocument(input)) return input;
  if (isV1Document(input)) {
    if (!isParadigmId(input.paradigm)) throw new MigrationError('unknown paradigm ' + input.paradigm);
    const doc: GraphDocument = {
      version: 3, id: input.id, title: input.title, paradigm: input.paradigm,
      nodes: input.nodes.map(nodeFromV1), edges: input.edges.map(edgeFromV1),
      regions: (input.regions ?? []).map(r => regionFromV1(r, hooks)),
      metadata: input.metadata ?? {}, view: input.view ?? { x: 60, y: 30, k: 1 },
    };
    if (!isGraphDocument(doc)) throw new MigrationError('v1 document did not migrate cleanly');
    return doc;
  }
  throw new MigrationError('unsupported document');
}
