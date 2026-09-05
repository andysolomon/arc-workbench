// @vitest-environment jsdom
// DOM contract: the attribute set on nodes, edges, regions and the canvas is the API the
// design-system CSS keys off. These tests pin it.
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { EXAMPLES, PARADIGMS, familyOf } from '../../src/paradigms';
import { GraphCanvas, type Handlers } from '../../src/render';
import { RoutePlanner, geomOfWith, seqGeo } from '../../src/router';
import { protoOf, timeline } from '../../src/sim';
import { buildCanvasVM, W } from '../../src/app/viewModel';
import type { ParadigmId } from '../../src/model';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const noop = (): void => {};
const H: Handlers = { onBgDown: noop, onNodeDown: noop, onPortDown: noop, onEdgeEnter: noop, onEdgeLeave: noop, onEdgeMove: noop, onEdgeClick: noop, onRegionSelect: noop, onGrabEnd: noop, setCanvasEl: noop, setGridEl: noop, setViewEl: noop, setNodeEl: noop, setEdgeEl: noop, setConnectEl: noop, setEndsEl: noop, setCursorEl: noop };

function mount(pid: ParadigmId, mode: 'design' | 'simulate' = 'design') {
  const ex = EXAMPLES[pid][0]!, nodeH: Record<string, number> = {};
  const P = new RoutePlanner();
  const routes = P.routes({ paradigm: pid, nodes: ex.nodes, edges: ex.edges, geomOf: geomOfWith(W, nodeH), gap: 8, plain: false, protoOf: e => protoOf(pid, e), structured: !!PARADIGMS[pid].structured, labels: true, nodeH }, null, null);
  const seq = pid === 'sequence' ? seqGeo({ nodes: ex.nodes, edges: ex.edges, nodeH, geomOf: geomOfWith(W, nodeH), regions: ex.regions, W, edgeDef: e => PARADIGMS.sequence.EDGES[e.kind], familyOf: n => familyOf('sequence', n), timeline }) : null;
  const metrics = mode === 'simulate' ? { nodes: Object.fromEntries(ex.nodes.map(n => [n.id, { arr: 10, util: 0.5, lat: 5, q: 1, err: 0, health: 'warn' as const }])), edges: {}, sys: { rps: 1, goodput: 1, p50: 1, p95: 1, p99: 1, err: 0, qtot: 0, sat: 0 } } : null;
  const vm = buildCanvasVM({ paradigm: pid, mode, nodes: ex.nodes, edges: ex.edges, regions: ex.regions, view: { x: 0, y: 0, k: 1 }, rps: ex.rps, nodeH, footH: () => 88, zoomLevel: 'working', metrics, nhist: {}, sel: { kind: 'edge', id: ex.edges[0]!.id }, hoverEdge: null, rewire: null, connect: null, connectInvalid: null, focus: null, findings: [], routes, chans: P.chans, seq, ui: { pixel: true, tiers: true, packets: true, channels: false, trace: false, labels: true, rates: true, spark: true, semantic: true }, motion: true, touch: false, rect: null, worldBox: null, chanGap: 'normal', viewStyle: { zoom: '', transform: 'translate(0px,0px) scale(1)' }, gridStyle: {} });
  const host = document.createElement('div'); document.body.appendChild(host);
  act(() => { createRoot(host).render(<GraphCanvas vm={vm} h={H} />); });
  return { host, ex, vm };
}

describe('render DOM contract', () => {
  it('nodes carry the full attribute contract and the kind word is doubled', () => {
    const { host, ex } = mount('workflow');
    const el = host.querySelector('.tg-gnode[data-kind="approval"]')!;
    expect(el.getAttribute('data-family')).toBe('amber');
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Approval Approve');
    expect(el.querySelector('.tg-gnode-kind')!.textContent).toBe('approval');
    expect(el.querySelector('.tg-gnode-title')!.textContent).toBe('Approve');
    expect(host.querySelector('.tg-gnode[data-kind="failed"]')!.getAttribute('data-terminal')).toBe('1');
    expect(host.querySelector('.tg-gnode[data-kind="evidence"]')!.getAttribute('data-side')).toBe('1');
    expect(host.querySelectorAll('.tg-gnode').length).toBe(ex.nodes.length);
    // design: no telemetry, no health mark, body rows with the identity/configuration split
    expect(host.querySelector('.tg-gnode-tel')).toBeNull();
    expect(host.querySelector('.wb-hdot')).toBeNull();
    expect(el.querySelector('.tg-gnode-row [data-dk]')!.textContent).toBe('owner');
    expect(el.querySelector('.tg-gnode-row[data-cfg]')).not.toBeNull();
    expect(el.querySelectorAll('.tg-port').length).toBe(4);
    // regions never carry the legacy alias; lanes alternate tint
    const lanes = host.querySelectorAll('.tg-region[data-variant="lane"]');
    expect(lanes.length).toBe(4);
    expect(lanes[0]!.getAttribute('data-kind')).toBeNull();
    expect(lanes[0]!.getAttribute('data-family')).toBe('indigo');
    expect(lanes[1]!.getAttribute('data-alt')).toBe('1');
    expect(lanes[0]!.querySelector('.tg-region-owner')!.textContent).toBe('team · developer');
  });
  it('simulate adds telemetry targets and health without recolouring the family', () => {
    const { host } = mount('architecture', 'simulate');
    const el = host.querySelector('.tg-gnode[data-kind="service"]')!;
    expect(el.getAttribute('data-health')).toBe('warn');
    expect(el.getAttribute('data-family')).toBe('indigo');
    for (const t of ['rate', 'unit', 'p99', 'q', 'spark', 'util', 'status', 'dot', 'hword', 'hdot']) expect(el.querySelector(`[data-t="${t}"]`), t).not.toBeNull();
    expect(host.querySelector('.tg-group')).toBeNull(); // tiers are design-only
    expect(host.querySelectorAll('.wb-packets').length).toBeGreaterThan(0);
  });
  it('edges: one shared layer, one marker set, hit twin, selection state, endpoint handles', () => {
    const { host, ex } = mount('state');
    expect(host.querySelectorAll('svg.wb-elayer').length).toBe(1);
    expect(host.querySelectorAll('marker').length).toBe(5);
    const gs = host.querySelectorAll('g.tg-edge-g');
    expect(gs.length).toBe(ex.edges.length);
    const g0 = gs[0]!;
    expect(g0.getAttribute('data-rel')).toBe('flow');
    expect(g0.querySelector('.tg-edge-hit')).not.toBeNull();
    expect(g0.querySelector('.tg-edge')!.getAttribute('data-state')).toBe('selected');
    expect(g0.querySelector('title')!.textContent).toBe('Queued transitions to Planning on request_accepted, then build_plan().');
    expect(g0.querySelector('[data-role="event"]')!.textContent).toBe('request_accepted');
    expect(g0.querySelector('[data-role="action"]')!.textContent).toBe('/ build_plan()');
    expect(host.querySelectorAll('circle[data-t^="end"]').length).toBe(4);
    expect(host.querySelector('.tg-gnode[data-kind="completed"]')!.getAttribute('data-terminal')).toBe('1');
    expect(host.querySelector('.tg-gnode[data-kind="initial"]')!.getAttribute('data-initial')).toBe('1');
  });
  it('sequence: lifelines, activations, phases from the timeline, compact participants', () => {
    const { host, ex } = mount('sequence');
    expect(host.querySelectorAll('.tg-lifeline').length).toBe(ex.nodes.length);
    expect(host.querySelectorAll('.tg-activation').length).toBeGreaterThan(0);
    expect(host.querySelectorAll('.tg-region[data-variant="phase"]').length).toBe(3);
    expect(host.querySelector('.tg-gnode')!.getAttribute('data-density')).toBe('compact');
    expect(host.querySelector('.tg-gcanvas')!.getAttribute('data-paradigm')).toBe('sequence');
  });
  it('data flow: data vs process form on the node, dashed zone', () => {
    const { host } = mount('dataflow');
    expect(host.querySelector('.tg-gnode[data-kind="stream"]')!.getAttribute('data-form')).toBe('data');
    expect(host.querySelector('.tg-gnode[data-kind="producer"]')!.getAttribute('data-form')).toBe('process');
    expect(host.querySelector('.tg-region[data-variant="zone"]')!.getAttribute('data-dashed')).toBe('1');
    const c = host.querySelector('.tg-gcanvas')!;
    for (const a of ['data-zoom', 'data-mode', 'data-o-labels', 'data-o-rates', 'data-o-packets', 'data-o-spark', 'data-o-chan', 'data-chan', 'data-layer-trace', 'data-touch']) expect(c.hasAttribute(a), a).toBe(true);
  });
});
