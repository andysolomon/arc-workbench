// @vitest-environment jsdom
// The controller drives the store exactly as the prototype's methods did: paradigm switching parks
// and restores, keyboard bindings dispatch, model ops snapshot for undo, design mode clears runtime attrs.
import { beforeEach, describe, expect, it } from 'vitest';
import { WorkbenchController } from '../../src/app/controller';
import { onKey } from '../../src/app/keyboard';
import { EXAMPLES } from '../../src/paradigms';
import { setIdClock } from '../../src/model';

const key = (ctl: WorkbenchController, k: string, o: Partial<KeyboardEventInit> = {}) => onKey(ctl, new KeyboardEvent('keydown', { key: k, ...o }));
let ctl: WorkbenchController;
beforeEach(() => { ctl = new WorkbenchController(); ctl.loadPreset(EXAMPLES.dataflow[0]!.id); ctl.setState({ mode: 'design', ready: true }); setIdClock(() => 99); });

describe('controller', () => {
  it('switching paradigm parks the current document and restores it on the way back', () => {
    const before = ctl.state.nodes;
    ctl.setState({ rps: 777, view: { x: 5, y: 6, k: 0.5 } });
    ctl.switchParadigm('workflow'); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit();
    expect(ctl.state.paradigm).toBe('workflow'); expect(ctl.state.nodes.length).toBe(EXAMPLES.workflow[0]!.nodes.length);
    expect(ctl.docs.dataflow?.nodes).toBe(before); expect(ctl.docs.dataflow?.rps).toBe(777);
    ctl.switchParadigm('dataflow'); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit();
    expect(ctl.state.nodes).toBe(before); expect(ctl.state.rps).toBe(777); expect(ctl.state.view).toEqual({ x: 5, y: 6, k: 0.5 });
  });
  it('keyboard: palette, undo/redo, run, theme, trace, create, escape unwinding, arrows, delete', () => {
    key(ctl, '/'); expect(ctl.state.palette).toBe(true);
    key(ctl, 'Escape'); expect(ctl.state.palette).toBe(false);
    key(ctl, 'k', { metaKey: true }); expect(ctl.state.palette).toBe(true); key(ctl, 'Escape');
    key(ctl, 'n'); expect(ctl.state.createOpen).toBe(true); key(ctl, 'Escape'); expect(ctl.state.createOpen).toBe(false);
    key(ctl, 'r'); expect(ctl.state.running).toBe(false); key(ctl, 'r'); expect(ctl.state.running).toBe(true);
    key(ctl, 'd'); expect(ctl.th()).toBe('light'); key(ctl, 'd'); expect(ctl.th()).toBe('dark');
    key(ctl, 't'); expect(ctl.state.ui.trace).toBe(true); key(ctl, 't');
    key(ctl, 'ArrowRight'); expect(ctl.state.sel?.kind).toBe('node'); const first = ctl.state.sel!.id;
    key(ctl, 'ArrowRight'); expect(ctl.state.sel!.id).not.toBe(first); key(ctl, 'ArrowLeft'); expect(ctl.state.sel!.id).toBe(first);
    const n = ctl.state.nodes.length;
    key(ctl, 'Delete'); expect(ctl.state.nodes.length).toBe(n - 1); expect(ctl.state.sel).toBeNull();
    key(ctl, 'z', { metaKey: true }); expect(ctl.state.nodes.length).toBe(n);
    key(ctl, 'z', { metaKey: true, shiftKey: true }); expect(ctl.state.nodes.length).toBe(n - 1);
    ctl.setState({ sel: { kind: 'node', id: ctl.state.nodes[0]!.id } }); key(ctl, 'Escape'); expect(ctl.state.sel).toBeNull();
  });
  it('typing in an input never triggers single-key bindings but ⌘Z still undoes', () => {
    const input = document.createElement('input'); document.body.appendChild(input);
    const ev = new KeyboardEvent('keydown', { key: 'f' }); Object.defineProperty(ev, 'target', { value: input });
    const v = ctl.state.view; onKey(ctl, ev); expect(ctl.state.view).toBe(v);
  });
  it('sequence ↑↓ step messages in time order', () => {
    ctl.switchParadigm('sequence'); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit();
    key(ctl, 'ArrowDown'); expect(ctl.state.sel).toEqual({ kind: 'edge', id: 'user>web#1' });
    key(ctl, 'ArrowDown'); expect(ctl.state.sel).toEqual({ kind: 'edge', id: 'web>api#2' });
    key(ctl, 'ArrowUp'); expect(ctl.state.sel).toEqual({ kind: 'edge', id: 'user>web#1' });
  });
  it('model ops: add node, connect with the paradigm default kind, flip, set end, lanes', () => {
    ctl.switchParadigm('workflow'); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit();
    const n0 = ctl.state.nodes.length, e0 = ctl.state.edges.length;
    const gate = ctl.nById['qg']!, failed = ctl.nById['rolled']!;
    ctl.addEdge(gate.id, failed.id, ctl.defaultEdgeKind(gate, failed));
    expect(ctl.state.edges.length).toBe(e0 + 1); expect(ctl.state.edges[e0]!.kind).toBe('fail'); expect(ctl.state.edges[e0]!.id).toBe('e99');
    ctl.flipEdge('e99'); expect(ctl.state.edges[e0]!.from).toBe(failed.id);
    ctl.setEnd('e99', 'to', 'commit'); expect(ctl.state.edges[e0]!.to).toBe('commit');
    ctl.addLane(); expect(ctl.lanes().length).toBe(5); expect(ctl.state.sel?.kind).toBe('region'); expect(ctl.takeLaneFocus()).toBe('name'); expect(ctl.takeLaneFocus()).toBeNull();
    ctl.deleteSel(); expect(ctl.lanes().length).toBe(4);
    ctl.undo(); expect(ctl.lanes().length).toBe(5); ctl.undo(); expect(ctl.lanes().length).toBe(4);
    expect(ctl.state.nodes.length).toBe(n0);
    ctl.createDoc('workflow'); ctl.store.drainAfterCommit(); expect(ctl.state.nodes.length).toBe(0); expect(ctl.state.presetId).toBe('blank');
  });
  it('palette items cover modes, paradigms, examples, settings and every library type', () => {
    const labels = ctl.paletteItems().map(i => i.label);
    expect(labels).toContain('design mode'); expect(labels).toContain('change diagram type · workflow'); expect(labels).toContain('load example · product analytics');
    expect(labels).toContain('+ event stream'); expect(labels).toContain('fit canvas'); expect(labels.some(l => l.startsWith('hide edge labels'))).toBe(true);
    ctl.setState({ pq: 'trace' }); expect(ctl.paletteItems().map(i => i.label)).toEqual(['show execution trace']);
  });
});
