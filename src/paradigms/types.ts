import type { EdgeRel, GraphEdge, NodeForm, ParadigmId, RegionVariant, VisualFamily } from '../model/document';
import type { Field } from './fields';

export type LayoutStrategy = 'layered' | 'lanes' | 'ranked' | 'stages' | 'timeline';
export type SimModel = 'queueing' | 'execution' | 'timeline' | 'markov';
export type QueueRole = 'source' | 'buffer' | 'limiter' | 'work';

export interface Category { label: string }

/** A paradigm node type. `family` is the visual triad; flags are read for truthiness only. */
export interface NodeTypeDef {
  label: string;
  cat: string;
  family: VisualFamily;
  icon: string;
  // capacity model
  cap?: number; ms?: number; inst?: number; parts?: number; retention?: number; role?: QueueRole;
  // workflow
  dur?: number; pass?: number; human?: true; fork?: true; side?: true; source?: true; terminal?: true; bad?: true;
  // sequence
  conc?: number;
  // data flow
  form?: NodeForm; gov?: true;
  // state machine
  dwell?: number; initial?: true;
}

export interface EdgeKindDef {
  label: string;
  rel: EdgeRel;
  desc: string;
  /** alternate path (denied · fail · retry · timeout …) */
  alt?: true;
  /** side channel (evidence) */
  side?: true;
  /** sequence: drawn back to the caller (response · error) */
  back?: true;
  /** sequence: fire and forget — the caller does not wait */
  nowait?: true;
  /** bad outcome */
  bad?: true;
  /** data flow: crosses a governance boundary */
  gov?: true;
}

export interface HudSpec { load: string; unit: string; min: number; max: number; a: string; b: string; c: string; d: string; rate: string }
export interface MetricLabels { arr: string; lat: string; p99: string; util: string; q: string; err: string }
export interface FormDef { label: string; glyph: string; hint: string }
/** library commands per category: [id, label] */
export type Commands = Record<string, ReadonlyArray<readonly [string, string]>>;

export interface Paradigm {
  id: ParadigmId;
  label: string;
  title: string;
  axis: string;
  /** the switcher swatch reads THIS, not the first category */
  family: VisualFamily;
  ask: string;
  blurb: string;
  region: RegionVariant;
  layout: LayoutStrategy;
  CATS: Record<string, Category>;
  TYPES: Record<string, NodeTypeDef>;
  COMMANDS?: Commands;
  FORMS?: Record<NodeForm, FormDef>;
  EDGES: Record<string, EdgeKindDef>;
  defaultEdge: string;
  INSPECT: { node: Field[]; edge: Field[] };
  /** edge label splits into event · [guard] · / action */
  structured?: true;
  HUD: HudSpec;
  sim: SimModel;
  unitNoun: string;
  edgeNoun: string;
  METRICS: MetricLabels;
  a11y: (a: string, e: GraphEdge, b: string, T: Paradigm) => string;
}
