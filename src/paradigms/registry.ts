// Paradigm registry — the typed extension layer over the shared GraphDocument.
// One entry per diagram paradigm: node types (library), edge vocabulary, region variant,
// inspector schema, load model for Simulate, HUD vocabulary and accessibility sentences.
import type { EdgeRel, GraphDocument, GraphEdge, GraphNode, GraphRegion, ParadigmId, View, VisualFamily } from '../model/document';
import { docId } from '../model/ids';
import { architecture } from './architecture';
import { dataflow } from './dataflow';
import { familyOfGk, gkOfFamily, isVisualFamily, type GraphKindAlias } from './families';
import { sequence } from './sequence';
import { state } from './state';
import type { NodeTypeDef, Paradigm } from './types';
import { workflow } from './workflow';

export const PARADIGMS: Record<ParadigmId, Paradigm> = { architecture, workflow, sequence, dataflow, state };
export const ORDER: readonly ParadigmId[] = ['architecture', 'workflow', 'sequence', 'dataflow', 'state'];
export type Lens = 'design' | 'simulate' | 'analyze';
export const LENSES: readonly Lens[] = ['design', 'simulate', 'analyze'];

export function typeOf(pid: ParadigmId, type: string): NodeTypeDef | undefined { return PARADIGMS[pid].TYPES[type]; }

/** Node defaults for a paradigm type — flat model: {id, type, name, x, y, ...ext} */
export function nodeDefaults(pid: ParadigmId, type: string): Partial<GraphNode> {
  const t = PARADIGMS[pid].TYPES[type];
  const o: Partial<GraphNode> = {};
  if (!t) return o;
  if (t.inst != null) o.inst = t.inst;
  if (t.cap != null) o.cap = t.cap;
  if (t.ms != null) o.ms = t.ms;
  if (t.dur != null) o.dur = t.dur;
  if (t.pass != null) o.pass = t.pass;
  if (t.conc != null) o.conc = t.conc;
  if (t.dwell != null) o.dwell = t.dwell;
  if (t.parts != null) o.parts = t.parts;
  if (t.retention != null) o.retention = t.retention;
  if (t.role != null) o.role = t.role;
  return o;
}
export function edgeDefaults(pid: ParadigmId, kind: string): Pick<GraphEdge, 'kind' | 'label' | 'w'> & Partial<GraphEdge> {
  const base: Pick<GraphEdge, 'kind' | 'label' | 'w'> & Partial<GraphEdge> = { kind, label: '', w: 1 };
  if (pid === 'sequence') base.lat = kind === 'response' || kind === 'error' ? 1 : 12;
  if (pid === 'state') base.p = 1;
  return base;
}
/** public: the visual family a semantic kind is drawn in */
export function familyOf(pid: ParadigmId, n: Pick<GraphNode, 'type' | 'visualFamily'> | null | undefined): VisualFamily {
  if (n && isVisualFamily(n.visualFamily)) return n.visualFamily;
  return (n && PARADIGMS[pid].TYPES[n.type]?.family) ?? 'stone';
}
/** @internal legacy graph-kind alias for a node — tooling parity only, never rendered or serialized */
export function gkOf(pid: ParadigmId, n: Pick<GraphNode, 'type'>): GraphKindAlias { const t = PARADIGMS[pid].TYPES[n.type]; return t ? gkOfFamily(t.family) : 'external'; }
export { familyOfGk };
export function relOf(pid: ParadigmId, e: Pick<GraphEdge, 'kind'>): EdgeRel { return PARADIGMS[pid].EDGES[e.kind]?.rel ?? 'flow'; }
export function edgeLabel(pid: ParadigmId, e: Pick<GraphEdge, 'kind'>): string { return PARADIGMS[pid].EDGES[e.kind]?.label ?? e.kind; }

/** flat workbench state → v3 GraphDocument (the store shape IS the document, plus identity) */
export interface FlatState { docId?: string; nodes: GraphNode[]; edges: GraphEdge[]; regions?: GraphRegion[]; rps: number; view: View }
export function toDocument(pid: ParadigmId, title: string, s: FlatState): GraphDocument {
  const strip = ({ baseH: _b, ...r }: GraphRegion): GraphRegion => r;
  return {
    version: 3, id: s.docId ?? docId(), title, paradigm: pid,
    nodes: s.nodes.map(n => ({ ...n, visualFamily: familyOf(pid, n) })),
    edges: s.edges.map(e => ({ ...e })),
    regions: (s.regions ?? []).map(strip),
    metadata: { load: s.rps }, view: s.view,
  };
}
export function fromDocument(d: GraphDocument): FlatState & { paradigm: ParadigmId; title: string; docId: string } {
  return { docId: d.id, paradigm: d.paradigm, title: d.title, nodes: d.nodes.map(n => ({ ...n })), edges: d.edges.map(e => ({ ...e })), regions: d.regions.map(r => ({ ...r })), rps: typeof d.metadata.load === 'number' ? d.metadata.load : 0, view: d.view };
}

// ---- v1 exchange shape (paradigms.js toDoc / fromDoc) kept for interchange ----
export interface V1Export {
  version: 1; id: string; title: string; paradigm: ParadigmId;
  nodes: Array<{ id: string; kind: string; visualFamily: VisualFamily; position: { x: number; y: number }; data: Record<string, unknown> }>;
  edges: Array<{ id: string; relationship: string; source: string; target: string; data: Record<string, unknown> }>;
  regions: Array<Omit<GraphRegion, 'baseH'>>;
  metadata: { load: number }; view: View;
}
export function exportV1(pid: ParadigmId, title: string, s: FlatState): V1Export {
  const strip = (o: Record<string, unknown>, keys: string[]): Record<string, unknown> => { const d: Record<string, unknown> = {}; Object.keys(o).forEach(k => { if (!keys.includes(k)) d[k] = o[k]; }); return d; };
  return {
    version: 1, id: s.docId ?? docId(), title, paradigm: pid,
    nodes: s.nodes.map(n => ({ id: n.id, kind: n.type, visualFamily: familyOf(pid, n), position: { x: n.x, y: n.y }, data: strip(n, ['id', 'type', 'x', 'y', 'visualFamily']) })),
    edges: s.edges.map(e => ({ id: e.id, relationship: e.kind, source: e.from, target: e.to, data: strip(e, ['id', 'kind', 'from', 'to']) })),
    regions: (s.regions ?? []).map(({ baseH: _b, ...r }) => r),
    metadata: { load: s.rps }, view: s.view,
  };
}
