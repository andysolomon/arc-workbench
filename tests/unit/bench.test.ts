// @vitest-environment jsdom
// Stress Lab plumbing: fixtures are deterministic, budgets judge a result, and large sequence
// documents cull message rows outside the viewport while keeping the selected / traced ones.
import { describe, expect, it } from 'vitest';
import { BUDGETS, SCENARIOS, failed, judge, type BenchResult } from '../../src/app/budgets';
import { stressDoc } from '../../src/app/stress';
import { buildCanvasVM, W } from '../../src/app/viewModel';
import { EXAMPLES, PARADIGMS, familyOf } from '../../src/paradigms';
import { RoutePlanner, geomOfWith, seqGeo } from '../../src/router';
import { protoOf, timeline } from '../../src/sim';
import { worldBox, SEQ_CULL_FROM } from '../../src/view';
import { WorkbenchController, loadStress } from '../../src/app/controller';

const result = (scenario: string, over: Partial<BenchResult> = {}): BenchResult => ({ scenario, at: '', nodes: 100, edges: 150, dom: { elements: 100, svgs: 1, paths: 10, renderedNodes: 100, renderedEdges: 150 }, pan: { frames: 60, selfP95: 1, cadenceP95: 16, software: false }, telemetry: { passes: 20, avg: 2, max: 4, nodeRenders: 0, edgeRenders: 0 }, analyze: { avg: 3, findings: 4 }, route: { ms: 50 }, commit: { add: 20, del: 20, layout: 100 }, longTasks: { n: 0, max: 0 }, heap: null, ...over });

describe('stress lab', () => {
  it('every scenario has budgets and the fixture generator is deterministic', () => {
    for (const sc of SCENARIOS) expect(BUDGETS[sc.id]?.length, sc.id).toBeGreaterThan(0);
    const a = stressDoc('architecture', 100, 150), b = stressDoc('architecture', 100, 150);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(a.nodes.length).toBe(100); expect(a.edges.length).toBeGreaterThan(120);
    const s = stressDoc('sequence', 40, 2000); expect(s.nodes.length).toBe(40); expect(s.edges.length).toBe(2000);
  });
  it('judge flags every budget a result misses, and skips what the environment cannot measure', () => {
    expect(failed(judge(result('arch-100')))).toEqual([]);
    const bad = failed(judge(result('arch-100', { telemetry: { passes: 20, avg: 30, max: 40, nodeRenders: 3, edgeRenders: 0 }, route: { ms: 9999 } })));
    expect(bad.map(v => v.key).sort()).toEqual(['route.ms', 'telemetry.avg', 'telemetry.renders']);
    const soft = judge(result('arch-100', { pan: { frames: 60, selfP95: 1, cadenceP95: 90, software: true } }));
    expect(soft.find(v => v.key === 'pan.cadence')!.pass).toBeNull();
    expect(judge(result('heap', { heap: { supported: true, beforeMB: 40, afterMB: 90, deltaMB: 50 } }))[0]!.pass).toBe(false);
    expect(judge(result('heap', { heap: { supported: false, beforeMB: 0, afterMB: 0, deltaMB: 0 } }))[0]!.pass).toBeNull();
  });
  it('a large sequence culls message rows outside the viewport but keeps the selected and traced ones', () => {
    const pid = 'sequence', d = stressDoc(pid, 40, 600), nodeH: Record<string, number> = {};
    const P = new RoutePlanner();
    const routes = P.routes({ paradigm: pid, nodes: d.nodes, edges: d.edges, geomOf: geomOfWith(W, nodeH), gap: 8, plain: false, protoOf: e => protoOf(pid, e), structured: false, labels: true, nodeH }, null, null);
    const seq = seqGeo({ nodes: d.nodes, edges: d.edges, nodeH, geomOf: geomOfWith(W, nodeH), regions: d.regions, W, edgeDef: e => PARADIGMS.sequence.EDGES[e.kind], familyOf: n => familyOf('sequence', n), timeline });
    const view = { x: 0, y: -4000, k: 1 }, wb = worldBox(view, 1500, 900);
    const deep = d.edges[500]!, mid = d.edges[300]!;
    const build = (sel: { kind: 'edge'; id: string } | null, run: string | null) => buildCanvasVM({ paradigm: pid, mode: run ? 'simulate' : 'design', nodes: d.nodes, edges: d.edges, regions: d.regions, view, rps: 200, nodeH, footH: () => 88, zoomLevel: 'working', metrics: run ? { nodes: {}, edges: {}, sys: { rps: 1, goodput: 1, p50: 1, p95: 1, p99: 1, err: 0, qtot: 0, sat: 0 }, run: { edge: run, done: {} } } : null, nhist: {}, sel, hoverEdge: null, rewire: null, connect: null, connectInvalid: null, focus: null, findings: [], routes, chans: P.chans, seq, ui: { pixel: true, tiers: true, packets: false, channels: false, trace: true, labels: true, rates: true, spark: true, semantic: true }, motion: false, touch: false, rect: null, worldBox: wb, chanGap: 'normal', viewStyle: { zoom: '', transform: '' }, gridStyle: {} });
    expect(d.edges.length).toBeGreaterThan(SEQ_CULL_FROM);
    const vm = build(null, null);
    expect(vm.edges.length).toBeLessThan(d.edges.length / 2); expect(vm.edges.length).toBeGreaterThan(10);
    expect(vm.seq!.acts.length).toBeLessThanOrEqual(seq.acts.length); expect(vm.seq!.ticks.length).toBeLessThanOrEqual(seq.ticks.length);
    expect(vm.edges.some(e => e.id === deep.id)).toBe(false);
    expect(build({ kind: 'edge', id: deep.id }, null).edges.some(e => e.id === deep.id)).toBe(true);
    expect(build(null, mid.id).edges.some(e => e.id === mid.id)).toBe(true);
    // without a world box (small documents) nothing is culled
    expect(buildCanvasVM({ paradigm: pid, mode: 'design', nodes: d.nodes, edges: d.edges, regions: d.regions, view, rps: 200, nodeH, footH: () => 88, zoomLevel: 'working', metrics: null, nhist: {}, sel: null, hoverEdge: null, rewire: null, connect: null, connectInvalid: null, focus: null, findings: [], routes, chans: P.chans, seq, ui: { pixel: true, tiers: true, packets: false, channels: false, trace: false, labels: true, rates: true, spark: true, semantic: true }, motion: false, touch: false, rect: null, worldBox: null, chanGap: 'normal', viewStyle: { zoom: '', transform: '' }, gridStyle: {} }).edges.length).toBe(d.edges.length);
  });
  it('↑↓ through a culled sequence keeps the selection and reveals its row; stress fixtures are undoable and never saved', () => {
    const ctl = new WorkbenchController({}, { storage: { read: () => null, write: () => { throw new Error('must not save'); }, remove: () => undefined } });
    ctl.openPreset(EXAMPLES.sequence[0]!.id); ctl.switchParadigm('sequence'); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit();
    const before = ctl.state.nodes.length;
    ctl.setState({ ready: true, mode: 'design' });
    loadStress(ctl, 'sequence', 40, 600); ctl.store.drainAfterCommit();
    expect(ctl.state.presetId).toBe('stress'); expect(ctl.state.edges.length).toBe(600); expect(ctl.saveNow()).toBe(false);
    for (let i = 0; i < 5; i++) ctl.moveSel('ArrowDown');
    expect(ctl.state.sel).toEqual({ kind: 'edge', id: ctl.seqMsgs()[4]!.id });
    ctl.undo(); expect(ctl.state.nodes.length).toBe(before); expect(ctl.state.presetId).not.toBe('stress');
  });
});
