// The benchmark matrix and its pass / fail budgets — pure data, shared by the in-app Stress Lab,
// the Playwright bench spec and the compare script. Budgets are the documented contract: a run
// that misses one is a regression, whatever it "feels" like.
import type { ParadigmId } from '../model/document';

export interface Scenario { id: string; label: string; paradigm: ParadigmId; nodes: number; edges: number; /** heap trend scenario: cycles of document / preset switching instead of a fixture */ heapCycles?: number }
export const SCENARIOS: readonly Scenario[] = [
  { id: 'arch-100', label: 'architecture · 100 nodes', paradigm: 'architecture', nodes: 100, edges: 150 },
  { id: 'arch-500', label: 'architecture · 500 nodes', paradigm: 'architecture', nodes: 500, edges: 750 },
  { id: 'arch-1000', label: 'architecture · 1000 nodes', paradigm: 'architecture', nodes: 1000, edges: 1500 },
  { id: 'seq-500', label: 'sequence · 500 messages', paradigm: 'sequence', nodes: 40, edges: 500 },
  { id: 'seq-2000', label: 'sequence · 2000 messages', paradigm: 'sequence', nodes: 40, edges: 2000 },
  { id: 'flow-300', label: 'data flow · 300 nodes (dense routing)', paradigm: 'dataflow', nodes: 300, edges: 600 },
  { id: 'heap', label: 'heap · 12 document / preset switch cycles', paradigm: 'architecture', nodes: 0, edges: 0, heapCycles: 12 },
];

export interface BenchResult {
  scenario: string; at: string; nodes: number; edges: number;
  dom: { elements: number; svgs: number; paths: number; renderedNodes: number; renderedEdges: number };
  pan: { frames: number; selfP95: number; cadenceP95: number; software: boolean };
  telemetry: { passes: number; avg: number; max: number; nodeRenders: number; edgeRenders: number };
  analyze: { avg: number; findings: number };
  route: { ms: number };
  commit: { add: number; del: number; layout: number };
  longTasks: { n: number; max: number };
  heap: { supported: boolean; beforeMB: number; afterMB: number; deltaMB: number } | null;
}

export interface Budget { key: string; label: string; limit: number; unit: string; read: (r: BenchResult) => number | null }
/** budgets: derived from measured baselines with ≥ 1.5× headroom, then held (README § Performance contract) */
const dom = (elements: number, svgs: number, paths: number): Budget[] => [
  { key: 'dom.elements', label: 'DOM elements', limit: elements, unit: '', read: r => r.dom.elements },
  { key: 'dom.svgs', label: 'SVG elements', limit: svgs, unit: '', read: r => r.dom.svgs },
  { key: 'dom.paths', label: 'SVG paths', limit: paths, unit: '', read: r => r.dom.paths },
];
const common: Budget[] = [
  { key: 'pan.self', label: 'pan frame main-thread p95', limit: 6, unit: 'ms', read: r => r.pan.selfP95 },
  { key: 'pan.cadence', label: 'pan rAF cadence p95 (hardware renderer only)', limit: 18.2, unit: 'ms', read: r => r.pan.software ? null : r.pan.cadenceP95 },
  { key: 'telemetry.avg', label: 'telemetry pass avg', limit: 12, unit: 'ms', read: r => r.telemetry.avg },
  { key: 'telemetry.renders', label: 'topology re-renders during telemetry', limit: 0, unit: '', read: r => r.telemetry.nodeRenders + r.telemetry.edgeRenders },
  { key: 'analyze.avg', label: 'findings refresh avg', limit: 40, unit: 'ms', read: r => r.analyze.avg },
  { key: 'route.ms', label: 'full route solve', limit: 400, unit: 'ms', read: r => r.route.ms },
  { key: 'commit.add', label: 'commit · add node', limit: 250, unit: 'ms', read: r => r.commit.add },
  { key: 'commit.del', label: 'commit · delete node', limit: 250, unit: 'ms', read: r => r.commit.del },
  { key: 'commit.layout', label: 'commit · relayout', limit: 900, unit: 'ms', read: r => r.commit.layout },
  { key: 'longtask.max', label: 'longest task during the run', limit: 400, unit: 'ms', read: r => r.longTasks.max },
];
/** per-scenario overrides: measured baselines (2026-09-05, headless Chromium, 1500×900) × ~2 — the
 *  large-scale commit / route / findings numbers are CURRENT CEILINGS, not targets; they exist so a
 *  regression shows as a number. Routing scales with obstacles × edges and is the next thing to fix. */
const over = (o: Record<string, number>): Budget[] => common.map(b => b.key in o ? { ...b, limit: o[b.key]! } : b);
const culled: Budget = { key: 'dom.culled', label: 'messages rendered (culling active)', limit: 260, unit: '', read: r => r.dom.renderedEdges };
export const BUDGETS: Record<string, Budget[]> = {
  'arch-100': [...over({ 'commit.add': 400, 'commit.del': 300, 'longtask.max': 500 }), ...dom(8000, 40, 700)],
  'arch-500': [...over({ 'analyze.avg': 100, 'route.ms': 1800, 'commit.add': 4800, 'commit.del': 2500, 'commit.layout': 3500, 'longtask.max': 5000 }), ...dom(35000, 40, 3200)],
  'arch-1000': [...over({ 'telemetry.avg': 30, 'analyze.avg': 550, 'route.ms': 9000, 'commit.add': 20000, 'commit.del': 12000, 'commit.layout': 13000, 'longtask.max': 23000 }), ...dom(70000, 40, 6500)],
  'seq-500': [...common, ...dom(6000, 40, 1800), culled],
  'seq-2000': [...over({ 'route.ms': 800 }), ...dom(6000, 40, 1800), culled],
  'flow-300': [...over({ 'route.ms': 1500, 'commit.add': 2500, 'commit.del': 1700, 'commit.layout': 2500, 'longtask.max': 1900 }), ...dom(22000, 40, 2600)],
  heap: [{ key: 'heap.delta', label: 'JS heap growth over the cycles', limit: 30, unit: 'MB', read: r => r.heap && r.heap.supported ? r.heap.deltaMB : null }],
};

export interface Verdict { key: string; label: string; value: number | null; limit: number; unit: string; pass: boolean | null }
export function judge(r: BenchResult): Verdict[] {
  return (BUDGETS[r.scenario] ?? []).map(b => { const v = b.read(r); return { key: b.key, label: b.label, value: v, limit: b.limit, unit: b.unit, pass: v == null ? null : v <= b.limit }; });
}
export const failed = (vs: Verdict[]): Verdict[] => vs.filter(v => v.pass === false);
