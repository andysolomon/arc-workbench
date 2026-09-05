// Two axes, kept apart on purpose:
//   semantic kind  — the paradigm type (approval, decision, retry, evidence…). Public. node.type.
//   visual family  — the colour triad it is drawn in (indigo, amber…). Public. node.visualFamily.
// The legacy UML/graph triad name (service, queue, agent…) is an INTERNAL rendering alias only —
// graph.css still keys triads by those names as a deprecated alias. It is never a public
// semantic: an approval is drawn in amber, it is not "a queue". Never surface it in documents,
// inspector copy or specs. It exists here only to migrate old documents and for tooling parity.
import { VISUAL_FAMILIES, type VisualFamily } from '../model/document';

/** @internal legacy graph-kind alias (graph.css triad names) */
export type GraphKindAlias = 'service' | 'component' | 'database' | 'queue' | 'agent' | 'tool' | 'input' | 'output' | 'external' | 'failure';

/** @internal */
const ALIAS_TO_FAMILY: Record<GraphKindAlias, VisualFamily> = {
  service: 'indigo', component: 'indigo', database: 'emerald', queue: 'amber', agent: 'purple',
  tool: 'cyan', input: 'orange', output: 'orange', external: 'stone', failure: 'danger',
};
/** @internal */
const FAMILY_TO_ALIAS: Record<VisualFamily, GraphKindAlias> = {
  indigo: 'service', emerald: 'database', amber: 'queue', purple: 'agent', cyan: 'tool', orange: 'input', stone: 'external', danger: 'failure',
};
/** @internal alias → legacy chip/badge family (the UML kind names chips once keyed on) */
export const GK_FAMILY: Record<GraphKindAlias, string> = {
  service: 'class', tool: 'function', database: 'type', queue: 'interface', agent: 'union',
  input: 'instance', output: 'instance', external: 'external', component: 'component', failure: 'failure',
};

/** public: the family a legacy alias maps to (regions in old documents stored one) */
export function familyOfGk(gk: string): VisualFamily { return (ALIAS_TO_FAMILY as Record<string, VisualFamily | undefined>)[gk] ?? 'stone'; }
/** @internal inverse; only tooling parity (Stress Lab) reads it */
export function gkOfFamily(f: VisualFamily): GraphKindAlias { return FAMILY_TO_ALIAS[f]; }
export function isVisualFamily(v: unknown): v is VisualFamily { return typeof v === 'string' && (VISUAL_FAMILIES as readonly string[]).includes(v); }
