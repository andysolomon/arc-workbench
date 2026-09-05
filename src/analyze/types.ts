export type Severity = 'crit' | 'warn' | 'info';
/** the exact number a finding rests on: which metric, at what scope (node name · window), and the value as shown elsewhere */
export interface Evidence { metric: string; scope: string; value: string }
export interface Finding {
  key: string;
  cat: string;
  sev: Severity;
  mark: string;
  nodeId: string | null;
  title: string;
  detail: string;
  rec: string;
  edges: string[];
  nodes: string[];
  /** metric-backed findings cite their evidence; structural ones carry none */
  evidence?: Evidence[];
}
export interface Footer { label: string; value: string }
export interface Analysis { list: Finding[]; a: Footer | null; b: Footer | null }
export type FindingInput = Omit<Finding, 'key' | 'edges' | 'nodes'> & { edges?: string[]; nodes?: string[] };
export const mkAdd = (F: Finding[]) => (o: FindingInput): void => { F.push({ ...o, key: o.cat + '·' + (o.nodeId || '') + '·' + o.title, edges: o.edges || [], nodes: o.nodes || [] }); };
export const ORD: Record<Severity, number> = { crit: 0, warn: 1, info: 2 };
export const finish = (F: Finding[], a: Footer, b: Footer): Analysis => { F.sort((x, y) => ORD[x.sev] - ORD[y.sev]); return { list: F.slice(0, 9), a, b }; };
