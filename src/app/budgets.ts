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

/**
 * The measuring environment, probed before every scenario. `idleCadenceMs` is the median interval
 * between idle animation frames with no work queued: ~16.7 on a 60 Hz display, ~1000 when the
 * browser throttles the frame clock (background / occluded tab, remote cloud browsers). Timing
 * budgets are only meaningful in a *supported* environment — a visible tab with an unthrottled
 * frame clock — and are reported as skipped elsewhere, so a throttled run is never "over budget".
 */
export interface BenchEnv { software: boolean; renderer: string; visible: boolean; focused: boolean; idleCadenceMs: number; throttled: boolean; supported: boolean; hz: number }
/** frame-clock intervals above this are throttling, not display refresh (no display is slower than 30 Hz) */
export const THROTTLED_ABOVE_MS = 100;
/** the rAF-cadence budget presumes a ≥ 50 Hz display: an idle cadence above this cannot meet it whatever the app does */
export const HARDWARE_CADENCE_MAX_MS = 20;
/** the pan is measured over this many frames, after a warm-up that ends once PAN_STEADY consecutive
 *  frames arrived within PAN_STEADY_FACTOR × the idle cadence (or after PAN_WARMUP_MAX frames) —
 *  the first frames of a drag raster the fixture into a fresh composited layer, a one-off stall
 *  reported as `pan.coldMs`, not a rate (README § Stress Lab · supported environment) */
export const PAN_FRAMES = 60, PAN_STEADY = 8, PAN_STEADY_FACTOR = 1.5, PAN_WARMUP_MAX = 45;
export function envReason(e: BenchEnv): string | null {
  if (!e.visible) return 'tab hidden';
  if (e.throttled) return `frame clock throttled (${Math.round(e.idleCadenceMs)} ms between idle frames)`;
  return null;
}

export interface BenchResult {
  scenario: string; at: string; nodes: number; edges: number;
  env: BenchEnv;
  dom: { elements: number; svgs: number; paths: number; renderedNodes: number; renderedEdges: number };
  /** frames = 0 when the pan was skipped (frame-clock throttled: a rAF-driven drag cannot be measured);
   *  `warmup` frames preceded the measured ones and `coldMs` is the worst gap among them — the
   *  cold start of the drag (layer promotion + first raster), informational, never a budget */
  pan: { frames: number; warmup: number; coldMs: number; selfP95: number; cadenceP95: number };
  telemetry: { passes: number; avg: number; max: number; nodeRenders: number; edgeRenders: number };
  analyze: { avg: number; findings: number };
  route: { ms: number };
  commit: { add: number; del: number; layout: number };
  longTasks: { n: number; max: number };
  heap: { supported: boolean; beforeMB: number; afterMB: number; deltaMB: number } | null;
}

/** `prereq` names why a budget cannot be judged for this result (the verdict is then skipped, with that reason) */
export interface Budget { key: string; label: string; limit: number; unit: string; read: (r: BenchResult) => number | null; prereq?: (r: BenchResult) => string | null }
/** timing budgets need a supported environment (README § Stress Lab · supported environment) */
const timing = (r: BenchResult): string | null => { const why = envReason(r.env); return why ? 'unsupported environment: ' + why : null; };
const hardwareRaf = (r: BenchResult): string | null => timing(r) ?? (r.env.software ? 'software renderer' : r.env.idleCadenceMs > HARDWARE_CADENCE_MAX_MS ? `display below 50 Hz (${r.env.idleCadenceMs.toFixed(1)} ms idle cadence)` : r.pan.frames === 0 ? 'pan skipped' : null);
const pan = (r: BenchResult): string | null => timing(r) ?? (r.pan.frames === 0 ? 'pan skipped' : null);
/** budgets: derived from measured baselines with ≥ 1.5× headroom, then held (README § Performance contract) */
const dom = (elements: number, svgs: number, paths: number): Budget[] => [
  { key: 'dom.elements', label: 'DOM elements', limit: elements, unit: '', read: r => r.dom.elements },
  { key: 'dom.svgs', label: 'SVG elements', limit: svgs, unit: '', read: r => r.dom.svgs },
  { key: 'dom.paths', label: 'SVG paths', limit: paths, unit: '', read: r => r.dom.paths },
];
const common: Budget[] = [
  { key: 'pan.self', label: 'pan frame main-thread p95', limit: 6, unit: 'ms', read: r => r.pan.selfP95, prereq: pan },
  { key: 'pan.cadence', label: 'pan rAF cadence p95 (hardware renderer, ≥ 50 Hz display)', limit: 18.2, unit: 'ms', read: r => r.pan.cadenceP95, prereq: hardwareRaf },
  { key: 'telemetry.avg', label: 'telemetry pass avg', limit: 12, unit: 'ms', read: r => r.telemetry.avg, prereq: timing },
  { key: 'telemetry.renders', label: 'topology re-renders during telemetry', limit: 0, unit: '', read: r => r.telemetry.nodeRenders + r.telemetry.edgeRenders },
  { key: 'analyze.avg', label: 'findings refresh avg', limit: 40, unit: 'ms', read: r => r.analyze.avg, prereq: timing },
  { key: 'route.ms', label: 'full route solve', limit: 400, unit: 'ms', read: r => r.route.ms, prereq: timing },
  { key: 'commit.add', label: 'commit · add node (main thread, to layout)', limit: 250, unit: 'ms', read: r => r.commit.add, prereq: timing },
  { key: 'commit.del', label: 'commit · delete node (main thread, to layout)', limit: 250, unit: 'ms', read: r => r.commit.del, prereq: timing },
  { key: 'commit.layout', label: 'commit · relayout (main thread, to layout)', limit: 900, unit: 'ms', read: r => r.commit.layout, prereq: timing },
  { key: 'longtask.max', label: 'longest task during the run', limit: 400, unit: 'ms', read: r => r.longTasks.max, prereq: timing },
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
  heap: [{ key: 'heap.delta', label: 'JS heap growth over the cycles', limit: 30, unit: 'MB', read: r => r.heap && r.heap.supported ? r.heap.deltaMB : null, prereq: r => r.heap && r.heap.supported ? null : 'performance.memory unavailable' }],
};

/** pass === null is a skipped measurement; `reason` says why, so a skip is never mistaken for a pass */
export interface Verdict { key: string; label: string; value: number | null; limit: number; unit: string; pass: boolean | null; reason?: string }
export function judge(r: BenchResult): Verdict[] {
  return (BUDGETS[r.scenario] ?? []).map(b => {
    const reason = b.prereq ? b.prereq(r) : null;
    if (reason) return { key: b.key, label: b.label, value: b.read(r), limit: b.limit, unit: b.unit, pass: null, reason };
    const v = b.read(r);
    return v == null ? { key: b.key, label: b.label, value: null, limit: b.limit, unit: b.unit, pass: null, reason: 'not measured' } : { key: b.key, label: b.label, value: v, limit: b.limit, unit: b.unit, pass: v <= b.limit };
  });
}
export const failed = (vs: Verdict[]): Verdict[] => vs.filter(v => v.pass === false);
export const skipped = (vs: Verdict[]): Verdict[] => vs.filter(v => v.pass === null);
