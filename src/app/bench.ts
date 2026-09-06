// The Stress Lab runner: loads a deterministic fixture, then measures what the audit asked for —
// pan frame time and cadence, long tasks, render counts during telemetry, DOM / SVG counts,
// routing, findings refresh, commit latency and (where the browser exposes it) heap trend.
// Everything runs inside the page so the in-app lab and the Playwright bench share one path.
//
// Nothing here waits on the frame clock to *measure* (ARC-170): a throttled requestAnimationFrame
// (background / occluded tab, remote browsers — ~1 Hz) used to leak into every commit timing as
// two ≈1 s frame waits, which is how a run reported "≈2 s commits" with no app work behind them.
// The clock is probed once per scenario instead, and budgets that need it are skipped with a reason.
//
// The pan is judged at steady state (ARC-170, second round): the first frames of a drag pay for
// promoting the view to its own composited layer and rasterising the whole fixture into it — a
// one-off stall of 60–100 ms on an integrated GPU at 2× DPR for 1000 nodes, several dropped frames
// on a slower one — which is not per-frame cost. The drag warms up until the frame clock has been
// steady, reports the worst gap of that phase as `coldMs`, and only then measures the cadence.
import { EXAMPLES } from '../paradigms';
import { renderStats, resetRenderStats } from '../render/stats';
import { HARDWARE_CADENCE_MAX_MS, PAN_FRAMES, PAN_STEADY, PAN_STEADY_FACTOR, PAN_WARMUP_MAX, SCENARIOS, THROTTLED_ABOVE_MS, type BenchEnv, type BenchResult, type Scenario } from './budgets';
import type { WorkbenchController } from './controller';
import { loadStress } from './controller';

const p95 = (xs: number[]): number => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length * 0.95)] ?? 0;
const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const median = (xs: number[]): number => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
const frame = (): Promise<void> => new Promise(r => requestAnimationFrame(() => r()));
/** a frame, or 50 ms if the frame clock is slower than that — settling must not stall on a throttled clock */
const frameOrSoon = (): Promise<void> => Promise.race([frame(), sleep(50)]);
const settle = async (ms: number): Promise<void> => { await frameOrSoon(); await frameOrSoon(); await sleep(ms); };
const microtasks = async (n: number): Promise<void> => { for (let i = 0; i < n; i++) await Promise.resolve(); };
const heapMB = (): number | null => { const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory; return m ? m.usedJSHeapSize / 1048576 : null; };
const gc = (): void => { const g = (globalThis as { gc?: () => void }).gc; if (g) g(); };

function longTaskWatch(): { stop: () => { n: number; max: number } } {
  const seen: number[] = [];
  let po: PerformanceObserver | null = null;
  try { po = new PerformanceObserver(list => list.getEntries().forEach(e => seen.push(e.duration))); po.observe({ type: 'longtask', buffered: false }); } catch { po = null; }
  return { stop: () => { po?.disconnect(); return { n: seen.length, max: seen.length ? Math.max(...seen) : 0 }; } };
}
function rendererName(): string {
  try { const c = document.createElement('canvas'), gl = c.getContext('webgl'), d = gl && gl.getExtension('WEBGL_debug_renderer_info'); return d && gl ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : ''; } catch { return ''; }
}
const softwareRenderer = (name: string): boolean => /SwiftShader|llvmpipe|Software/i.test(name);

/**
 * Probe the measuring environment: renderer, visibility, and the idle frame-clock cadence — the
 * median gap between animation frames with nothing queued. A frame that takes longer than 1.5 s
 * to arrive counts as that gap (a hidden tab never gets one). ~10 frames; ~170 ms on a 60 Hz display.
 */
export async function probeEnv(frames = 10): Promise<BenchEnv> {
  const renderer = rendererName(), software = softwareRenderer(renderer);
  const visible = typeof document !== 'undefined' && document.visibilityState === 'visible', focused = typeof document !== 'undefined' && document.hasFocus();
  const gaps: number[] = [];
  await Promise.race([frame(), sleep(1500)]); // align to the clock first
  let last = performance.now();
  for (let i = 0; i < frames; i++) {
    const arrived = await Promise.race([frame().then(() => true), sleep(1500).then(() => false)]);
    const t = performance.now(); gaps.push(t - last); last = t;
    if (!arrived) break;
  }
  const idleCadenceMs = median(gaps), throttled = idleCadenceMs > THROTTLED_ABOVE_MS;
  return { software, renderer, visible, focused, idleCadenceMs: +idleCadenceMs.toFixed(1), throttled, supported: visible && !throttled, hz: idleCadenceMs > 0 ? Math.round(1000 / idleCadenceMs) : 0 };
}
/** a one-line description for the lab and the bench log */
export function describeEnv(e: BenchEnv): string {
  const parts = [e.software ? 'software renderer' : 'hardware renderer', e.throttled ? `frame clock throttled · ${Math.round(e.idleCadenceMs)} ms idle` : `${e.hz} Hz frame clock · ${e.idleCadenceMs.toFixed(1)} ms idle`, e.visible ? (e.focused ? 'foreground tab' : 'visible tab') : 'hidden tab'];
  return parts.join(' · ') + (e.supported ? (e.software || e.idleCadenceMs > HARDWARE_CADENCE_MAX_MS ? ' → timing budgets asserted; rAF cadence skipped' : ' → every budget asserted') : ' → timing budgets skipped');
}

const ptr = (type: string, x: number, y: number): PointerEvent => new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, pointerType: 'mouse' });
const noPan: BenchResult['pan'] = { frames: 0, warmup: 0, coldMs: 0, selfP95: 0, cadenceP95: 0 };

/**
 * A synthetic background drag, one move per frame. It warms up until `PAN_STEADY` consecutive
 * frames arrived within `PAN_STEADY_FACTOR` × the idle cadence (at most `PAN_WARMUP_MAX` frames:
 * the cold start of a drag is a stall, not a rate), then measures `PAN_FRAMES` more. Returns the
 * measured frames' frame() self time and rAF cadence, plus the warm-up length and its worst gap.
 */
async function pan(ctl: WorkbenchController, env: BenchEnv): Promise<BenchResult['pan']> {
  const canvas = ctl.refs.canvas, view = ctl.refs.view; if (!canvas || !view) return noPan;
  const r = canvas.getBoundingClientRect(), sx = r.left + r.width - 60, sy = r.top + r.height - 120;
  const g = ctl.gestures, self: number[] = [], frames: number[] = [], cold: number[] = [];
  const orig = g.frame.bind(g);
  g.frame = () => { const t = performance.now(); orig(); void view.offsetHeight; self.push(performance.now() - t); };
  let i = 0, last = performance.now();
  const move = async (): Promise<number> => { i++; window.dispatchEvent(ptr('pointermove', sx - i * 6, sy - i * 3)); await frame(); const t = performance.now(), gap = t - last; last = t; return gap; };
  canvas.dispatchEvent(ptr('pointerdown', sx, sy));
  const steadyMs = env.idleCadenceMs * PAN_STEADY_FACTOR;
  for (let run = 0; cold.length < PAN_WARMUP_MAX && run < PAN_STEADY;) { const gap = await move(); cold.push(gap); run = gap <= steadyMs ? run + 1 : 0; }
  self.length = 0;
  for (let k = 0; k < PAN_FRAMES; k++) frames.push(await move());
  window.dispatchEvent(ptr('pointerup', sx - i * 6, sy - i * 3));
  g.frame = orig;
  await settle(50);
  return { frames: frames.length, warmup: cold.length, coldMs: Math.max(...cold), selfP95: p95(self), cadenceP95: p95(frames) };
}

function domCounts(ctl: WorkbenchController): BenchResult['dom'] {
  const root = ctl.refs.canvas ?? document.body;
  return { elements: root.querySelectorAll('*').length, svgs: root.querySelectorAll('svg').length, paths: root.querySelectorAll('path').length, renderedNodes: root.querySelectorAll('.tg-gnode').length, renderedEdges: root.querySelectorAll('g.tg-edge-g').length };
}
/**
 * Commit latency = the main-thread cost of an edit up to layout: the edit itself, the React
 * render (external-store updates flush synchronously in a microtask, plus any commit-triggered
 * follow-ups until the store is quiet) and a forced style + layout. It deliberately does not wait
 * for a paint: the frame clock is the environment's, not the app's, and is judged separately.
 */
export async function measureCommit(ctl: WorkbenchController, fn: () => void): Promise<number> {
  const t = performance.now(); fn();
  let v = -1; while (v !== ctl.store.version()) { v = ctl.store.version(); await microtasks(4); }
  void (ctl.refs.canvas ?? document.body).offsetHeight;
  return performance.now() - t;
}

export async function runScenario(ctl: WorkbenchController, sc: Scenario): Promise<BenchResult> {
  const env = await probeEnv();
  const lt = longTaskWatch();
  const empty: BenchResult = { scenario: sc.id, at: new Date().toISOString(), nodes: 0, edges: 0, env, dom: { elements: 0, svgs: 0, paths: 0, renderedNodes: 0, renderedEdges: 0 }, pan: noPan, telemetry: { passes: 0, avg: 0, max: 0, nodeRenders: 0, edgeRenders: 0 }, analyze: { avg: 0, findings: 0 }, route: { ms: 0 }, commit: { add: 0, del: 0, layout: 0 }, longTasks: { n: 0, max: 0 }, heap: null };
  if (sc.heapCycles) {
    // heap trend: alternate example ↔ blank and hop paradigms; growth after gc is what leaks would show
    gc(); await settle(100); const before = heapMB();
    for (let i = 0; i < sc.heapCycles; i++) {
      const pid = (['architecture', 'workflow', 'dataflow', 'state'] as const)[i % 4]!;
      ctl.switchParadigm(pid); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit(); await settle(30);
      ctl.loadPreset('blank', true); await settle(30);
      ctl.loadPreset(EXAMPLES[pid][0]!.id, true); await settle(30);
    }
    gc(); await settle(150); const after = heapMB();
    const longTasks = lt.stop();
    return { ...empty, longTasks, heap: before != null && after != null ? { supported: true, beforeMB: +before.toFixed(1), afterMB: +after.toFixed(1), deltaMB: +(after - before).toFixed(1) } : { supported: false, beforeMB: 0, afterMB: 0, deltaMB: 0 } };
  }
  ctl.setMode('design');
  loadStress(ctl, sc.paradigm, sc.nodes, sc.edges);
  await settle(400);
  const nodes = ctl.state.nodes.length, edges = ctl.state.edges.length;
  const dom = domCounts(ctl);
  // a drag is driven by the frame clock; on a throttled clock 60 frames is a minute of waiting for nothing
  const panR = env.throttled ? noPan : await pan(ctl, env);
  // routing: a cold solve of every edge
  ctl.planner.invalidate(); const t0 = performance.now(); ctl.routes(null, null); const route = { ms: performance.now() - t0 };
  // telemetry: 20 patches with metrics live; the topology components must not run once
  ctl.setMode('simulate'); await settle(300);
  const tel: number[] = []; resetRenderStats();
  for (let i = 0; i < 20; i++) { if (ctl.simState) ctl.metrics = ctl.simTick(0.25); const t = performance.now(); ctl.patchTelemetry(); void ctl.refs.canvas?.offsetHeight; tel.push(performance.now() - t); }
  const telemetry = { passes: tel.length, avg: avg(tel), max: Math.max(...tel), nodeRenders: renderStats.node, edgeRenders: renderStats.edge };
  // findings refresh while the simulation is live
  ctl.setMode('analyze'); await settle(200);
  const an: number[] = []; let findings = 0;
  for (let i = 0; i < 5; i++) { if (ctl.simState) ctl.metrics = ctl.simTick(0.25); const t = performance.now(); findings = ctl.analyze().list.length; an.push(performance.now() - t); }
  ctl.setMode('design'); await settle(100);
  const firstType = Object.keys(ctl.T.TYPES)[0]!;
  const add = await measureCommit(ctl, () => ctl.addNode(firstType));
  await settle(0);
  const del = await measureCommit(ctl, () => { ctl.setState({ sel: { kind: 'node', id: ctl.state.nodes[0]!.id } }); ctl.deleteSel(); });
  await settle(0);
  const layout = await measureCommit(ctl, () => ctl.autoLayout());
  const longTasks = lt.stop();
  return { ...empty, nodes, edges, dom, pan: panR, telemetry, analyze: { avg: avg(an), findings }, route, commit: { add, del, layout }, longTasks, heap: null };
}
export const scenarioById = (id: string): Scenario | undefined => SCENARIOS.find(s => s.id === id);
