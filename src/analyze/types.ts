export type Severity = 'crit' | 'warn' | 'info';
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
}
export interface Footer { label: string; value: string }
export interface Analysis { list: Finding[]; a: Footer | null; b: Footer | null }
export type FindingInput = Omit<Finding, 'key' | 'edges' | 'nodes'> & { edges?: string[]; nodes?: string[] };
export const mkAdd = (F: Finding[]) => (o: FindingInput): void => { F.push({ ...o, key: o.cat + '·' + (o.nodeId || '') + '·' + o.title, edges: o.edges || [], nodes: o.nodes || [] }); };
export const ORD: Record<Severity, number> = { crit: 0, warn: 1, info: 2 };
export const finish = (F: Finding[], a: Footer, b: Footer): Analysis => { F.sort((x, y) => ORD[x.sev] - ORD[y.sev]); return { list: F.slice(0, 9), a, b }; };
