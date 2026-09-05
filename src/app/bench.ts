// The Stress Lab runner: loads a deterministic fixture, then measures what the audit asked for —
// pan frame time and cadence, long tasks, render counts during telemetry, DOM / SVG counts,
// routing, findings refresh, commit latency and (where the browser exposes it) heap trend.
// Everything runs inside the page so the in-app lab and the Playwright bench share one path.
import { EXAMPLES } from '../paradigms';
import { renderStats, resetRenderStats } from '../render/stats';
import { SCENARIOS, type BenchResult, type Scenario } from './budgets';
import type { WorkbenchController } from './controller';
import { loadStress } from './controller';

const p95 = (xs: number[]): number => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length * 0.95)] ?? 0;
const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const frame = (): Promise<void> => new Promise(r => requestAnimationFrame(() => r()));
const settle = async (ms: number): Promise<void> => { await frame(); await frame(); await new Promise(r => setTimeout(r, ms)); };
const heapMB = (): number | null => { const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory; return m ? m.usedJSHeapSize / 1048576 : null; };
const gc = (): void => { const g = (globalThis as { gc?: () => void }).gc; if (g) g(); };

function longTaskWatch(): { stop: () => { n: number; max: number } } {
  const seen: number[] = [];
  let po: PerformanceObserver | null = null;
  try { po = new PerformanceObserver(list => list.getEntries().forEach(e => seen.push(e.duration))); po.observe({ type: 'longtask', buffered: false }); } catch { po = null; }
  return { stop: () => { po?.disconnect(); return { n: seen.length, max: seen.length ? Math.max(...seen) : 0 }; } };
}
function softwareRenderer(): boolean {
  try { const c = document.createElement('canvas'), gl = c.getContext('webgl'), d = gl && gl.getExtension('WEBGL_debug_renderer_info'); const r = d && gl ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : ''; return /SwiftShader|llvmpipe|Software/i.test(r); } catch { return false; }
}
const ptr = (type: string, x: number, y: number): PointerEvent => new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, pointerType: 'mouse' });

/** a synthetic background drag: 60 moves, one per frame; returns frame() self time and rAF cadence */
async function pan(ctl: WorkbenchController): Promise<BenchResult['pan']> {
  const canvas = ctl.refs.canvas, view = ctl.refs.view; if (!canvas || !view) return { frames: 0, selfP95: 0, cadenceP95: 0, software: softwareRenderer() };
  const r = canvas.getBoundingClientRect(), sx = r.left + r.width - 60, sy = r.top + r.height - 120;
  const g = ctl.gestures, self: number[] = [], frames: number[] = [];
  const orig = g.frame.bind(g);
  g.frame = () => { const t = performance.now(); orig(); void view.offsetHeight; self.push(performance.now() - t); };
  let last = performance.now();
  canvas.dispatchEvent(ptr('pointerdown', sx, sy));
  for (let i = 1; i <= 60; i++) { window.dispatchEvent(ptr('pointermove', sx - i * 6, sy - i * 3)); await frame(); const t = performance.now(); frames.push(t - last); last = t; }
  window.dispatchEvent(ptr('pointerup', sx - 360, sy - 180));
  g.frame = orig;
  await settle(50);
  return { frames: self.length, selfP95: p95(self), cadenceP95: p95(frames.slice(2)), software: softwareRenderer() };
}

function domCounts(ctl: WorkbenchController): BenchResult['dom'] {
  const root = ctl.refs.canvas ?? document.body;
  return { elements: root.querySelectorAll('*').length, svgs: root.querySelectorAll('svg').length, paths: root.querySelectorAll('path').length, renderedNodes: root.querySelectorAll('.tg-gnode').length, renderedEdges: root.querySelectorAll('g.tg-edge-g').length };
}
async function commit(fn: () => void): Promise<number> { const t = performance.now(); fn(); await frame(); await frame(); return performance.now() - t; }

export async function runScenario(ctl: WorkbenchController, sc: Scenario): Promise<BenchResult> {
  const lt = longTaskWatch();
  const empty: BenchResult = { scenario: sc.id, at: new Date().toISOString(), nodes: 0, edges: 0, dom: { elements: 0, svgs: 0, paths: 0, renderedNodes: 0, renderedEdges: 0 }, pan: { frames: 0, selfP95: 0, cadenceP95: 0, software: softwareRenderer() }, telemetry: { passes: 0, avg: 0, max: 0, nodeRenders: 0, edgeRenders: 0 }, analyze: { avg: 0, findings: 0 }, route: { ms: 0 }, commit: { add: 0, del: 0, layout: 0 }, longTasks: { n: 0, max: 0 }, heap: null };
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
  const panR = await pan(ctl);
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
  const add = await commit(() => ctl.addNode(firstType));
  const del = await commit(() => { ctl.setState({ sel: { kind: 'node', id: ctl.state.nodes[0]!.id } }); ctl.deleteSel(); });
  const layout = await commit(() => ctl.autoLayout());
  const longTasks = lt.stop();
  return { ...empty, nodes, edges, dom, pan: panR, telemetry, analyze: { avg: avg(an), findings }, route, commit: { add, del, layout }, longTasks, heap: null };
}
export const scenarioById = (id: string): Scenario | undefined => SCENARIOS.find(s => s.id === id);
