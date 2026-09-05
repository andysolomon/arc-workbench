// Step-4 harness: the static canvas for any paradigm at any zoom level, no chrome.
// ?p=architecture|workflow|sequence|dataflow|state  ?z=overview|compact|working|detail  ?mode=design|simulate|analyze
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ParadigmId } from '../model/document';
import { isParadigmId } from '../model';
import { EXAMPLES, PARADIGMS, familyOf } from '../paradigms';
import { GraphCanvas, type Handlers, type Mode, type ZoomLevelAttr } from '../render';
import { RoutePlanner, geomOfWith, seqGeo, type PlanInput } from '../router';
import { makeParadigmSim, makeSim, protoOf, tick, tickSequence, tickState, tickWorkflow, timeline, type Metrics } from '../sim';
import { gridStyleFor, viewCss } from '../view';
import { W, buildCanvasVM } from './viewModel';
import { analyze } from '../analyze';

const K: Record<ZoomLevelAttr, number> = { overview: 0.35, compact: 0.55, working: 1, detail: 1.4 };
const noop = (): void => {};

export function StaticCanvas() {
  const q = new URLSearchParams(location.search);
  const pid: ParadigmId = isParadigmId(q.get('p')) ? (q.get('p') as ParadigmId) : 'dataflow';
  const zl = (q.get('z') as ZoomLevelAttr | null) ?? 'working';
  const mode = (q.get('mode') as Mode | null) ?? 'design';
  const ex = EXAMPLES[pid][0]!;
  const view = { x: 40, y: 40, k: K[zl] ?? 1 };
  const [nodeH, setNodeH] = useState<Record<string, number>>({});
  const els = useRef<Record<string, HTMLDivElement>>({});
  const planner = useRef(new RoutePlanner());
  const metrics = useMemo<Metrics | null>(() => {
    if (mode === 'design') return null;
    const st = pid === 'architecture' || pid === 'dataflow' ? makeSim() : makeParadigmSim(pid);
    let m: Metrics | null = null;
    for (let i = 0; i < 8; i++) m = pid === 'workflow' ? tickWorkflow(st as never, ex.nodes, ex.edges, ex.rps, 0.25) : pid === 'state' ? tickState(st as never, ex.nodes, ex.edges, ex.rps, 0.25) : pid === 'sequence' ? tickSequence(st as never, ex.nodes, ex.edges, ex.rps, 0.25) : tick(st as never, ex.nodes, ex.edges, ex.rps, 0.25);
    return m;
  }, [pid, mode, ex]);
  useLayoutEffect(() => {
    let ch = false; const next = { ...nodeH };
    for (const id in els.current) { const h = els.current[id]!.offsetHeight; if (h && Math.abs((next[id] || 0) - h) > 3) { next[id] = h; ch = true; } }
    if (ch) setNodeH(next);
  });
  const handlers = useMemo<Handlers>(() => ({
    onBgDown: noop, onNodeDown: noop, onPortDown: noop, onEdgeEnter: noop, onEdgeLeave: noop, onEdgeMove: noop, onEdgeClick: noop, onRegionSelect: noop, onGrabEnd: noop,
    setCanvasEl: noop, setGridEl: noop, setViewEl: noop, setConnectEl: noop, setEndsEl: noop, setCursorEl: noop, setEdgeEl: noop,
    setNodeEl: (id, el) => { if (el) els.current[id] = el; else delete els.current[id]; },
  }), []);
  const footH = (id: string): number => Math.max(nodeH[id] || 0, 88);
  const plan: PlanInput = { paradigm: pid, nodes: ex.nodes, edges: ex.edges, geomOf: geomOfWith(W, nodeH), gap: 8, plain: false, protoOf: e => protoOf(pid, e), structured: !!PARADIGMS[pid].structured, labels: true, nodeH };
  const routes = planner.current.routes(plan, null, null);
  const seq = pid === 'sequence' ? seqGeo({ nodes: ex.nodes, edges: ex.edges, nodeH, geomOf: geomOfWith(W, nodeH), regions: ex.regions, W, edgeDef: e => PARADIGMS.sequence.EDGES[e.kind], familyOf: n => familyOf('sequence', n), timeline }) : null;
  const vm = buildCanvasVM({
    paradigm: pid, mode, nodes: ex.nodes, edges: ex.edges, regions: ex.regions, view, rps: ex.rps, nodeH, footH, zoomLevel: zl, metrics, nhist: {},
    sel: null, hoverEdge: null, rewire: null, connect: null, connectInvalid: null, focus: null, findings: mode === 'analyze' ? analyze(pid, ex.nodes, ex.edges, metrics, ex.regions, ex.rps).list : [], routes, chans: planner.current.chans, seq,
    ui: { pixel: true, tiers: true, packets: true, channels: false, trace: false, labels: true, rates: true, spark: true, semantic: true },
    motion: true, touch: false, rect: null, worldBox: null, chanGap: 'normal',
    viewStyle: viewCss(view, { live: true, zoomOk: false, smooth: true, zoomSafe: () => false }), gridStyle: gridStyleFor(view, true, true),
  });
  return <div data-screen-label="Workbench" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--surface-page)', color: 'var(--text-body)', fontFamily: 'var(--font-mono)', fontSize: '11px', userSelect: 'none' }}><GraphCanvas vm={vm} h={handlers} /></div>;
}
