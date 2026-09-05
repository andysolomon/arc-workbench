// @vitest-environment jsdom
// The controller drives the store exactly as the prototype's methods did: paradigm switching parks
// and restores, keyboard bindings dispatch, model ops snapshot for undo, design mode clears runtime attrs.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchController } from '../../src/app/controller';
import { onKey } from '../../src/app/keyboard';
import { EXAMPLES } from '../../src/paradigms';
import { setIdClock } from '../../src/model';

const key = (ctl: WorkbenchController, k: string, o: Partial<KeyboardEventInit> = {}) => onKey(ctl, new KeyboardEvent('keydown', { key: k, ...o }));
let ctl: WorkbenchController;
let uiStorage: Record<string, string>;
beforeEach(() => {
  uiStorage = {};
  vi.stubGlobal('localStorage', { clear: () => { uiStorage = {}; }, getItem: (key: string) => uiStorage[key] ?? null, setItem: (key: string, value: string) => { uiStorage[key] = value; } });
  ctl = new WorkbenchController(); ctl.loadPreset(EXAMPLES.dataflow[0]!.id); ctl.setState({ mode: 'design', ready: true }); setIdClock(() => 99);
});

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
  describe('preset replacement', () => {
    const load = (id: string) => { ctl.loadPreset(id); ctl.store.drainAfterCommit(); };
    const ids = () => ctl.state.nodes.map(n => n.id).join(',');
    it('a clean document swaps presets at once, as one undoable transaction', () => {
      const before = ids(), rps0 = ctl.state.rps; expect(ctl.dirty).toBe(false);
      load('blank'); expect(ctl.state.confirm).toBeNull(); expect(ctl.state.presetId).toBe('blank'); expect(ids()).toBe('');
      ctl.undo(); expect(ctl.state.presetId).toBe('analytics'); expect(ids()).toBe(before); expect(ctl.state.rps).toBe(rps0); expect(ctl.dirty).toBe(false);
      ctl.redo(); expect(ctl.state.presetId).toBe('blank'); expect(ids()).toBe('');
    });
    it('a dirty document asks first; cancel and Escape change nothing; the select keeps its value', () => {
      key(ctl, 'ArrowRight'); key(ctl, 'Delete'); expect(ctl.dirty).toBe(true);
      const edited = ids(), h = ctl.history.hist.length;
      load('blank');
      expect(ctl.state.confirm?.title).toBe('Replace Product Analytics with Blank?'); expect(ctl.state.presetId).toBe('analytics'); expect(ids()).toBe(edited);
      key(ctl, 'Escape'); expect(ctl.state.confirm).toBeNull(); expect(ids()).toBe(edited); expect(ctl.history.hist.length).toBe(h);
      load('analytics'); expect(ctl.state.confirm?.title).toBe('Reload Product Analytics?');
      ctl.setState({ confirm: null }); expect(ids()).toBe(edited); expect(ctl.state.presetId).toBe('analytics');
    });
    it('confirming replaces the document; one undo restores graph, preset, load and dirtiness; redo re-applies', () => {
      key(ctl, 'ArrowRight'); key(ctl, 'Delete'); ctl.setState({ rps: 4321, mode: 'simulate' }); ctl.step(0.25); ctl.step(0.25);
      const edited = ids(); expect(ctl.uptimeS).toBeGreaterThan(0);
      load('blank'); ctl.state.confirm!.run(); ctl.store.drainAfterCommit();
      expect(ctl.state.confirm).toBeNull(); expect(ctl.state.presetId).toBe('blank'); expect(ctl.dirty).toBe(false); expect(ctl.uptimeS).toBe(0); expect(ctl.metrics).toBeNull();
      ctl.undo(); ctl.store.drainAfterCommit();
      expect(ctl.state.presetId).toBe('analytics'); expect(ids()).toBe(edited); expect(ctl.state.rps).toBe(4321); expect(ctl.dirty).toBe(true); expect(ctl.uptimeS).toBe(0);
      ctl.undo(); expect(ids()).not.toBe(edited); expect(ctl.dirty).toBe(false); // the delete itself
      ctl.redo(); expect(ids()).toBe(edited);
      ctl.redo(); ctl.store.drainAfterCommit(); expect(ctl.state.presetId).toBe('blank'); expect(ctl.dirty).toBe(false);
      // undoing a dirty document's replacement makes it dirty again, so a further preset pick still asks
      ctl.undo(); load('blank'); expect(ctl.state.confirm).not.toBeNull();
    });
    it('a new blank document is a document transaction too, and the clean mark travels with a parked document', () => {
      ctl.createDoc('dataflow'); ctl.store.drainAfterCommit(); expect(ctl.state.presetId).toBe('blank'); expect(ctl.dirty).toBe(false);
      ctl.undo(); expect(ctl.state.presetId).toBe('analytics'); expect(ctl.state.nodes.length).toBeGreaterThan(0);
      key(ctl, 'ArrowRight'); key(ctl, 'Delete'); expect(ctl.dirty).toBe(true);
      ctl.switchParadigm('workflow'); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit(); expect(ctl.dirty).toBe(false);
      ctl.switchParadigm('dataflow'); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit(); expect(ctl.dirty).toBe(true);
    });
  });
  it('switching paradigm pauses a running simulation and says so; a design-mode switch is silent', () => {
    vi.useFakeTimers();
    ctl.setState({ mode: 'simulate', running: true });
    ctl.switchParadigm('workflow'); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit();
    expect(ctl.state.running).toBe(false); expect(ctl.state.toast?.text).toContain('simulation paused'); expect(ctl.state.toast?.text).toContain('workflow');
    vi.advanceTimersByTime(4500); expect(ctl.state.toast).toBeNull();
    ctl.setState({ mode: 'design', running: true });
    ctl.switchParadigm('state'); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit();
    expect(ctl.state.running).toBe(true); expect(ctl.state.toast).toBeNull();
    vi.useRealTimers();
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
  it('keyboard editing: shift+arrows move, c + arrows + Enter connect, Enter inspects, announcements follow', () => {
    key(ctl, 'ArrowRight'); const id = ctl.state.sel!.id, n0 = ctl.nById[id]!, h = ctl.history.hist.length;
    key(ctl, 'ArrowRight', { shiftKey: true }); key(ctl, 'ArrowDown', { shiftKey: true });
    expect(ctl.nById[id]).toMatchObject({ x: n0.x + 16, y: n0.y + 16 }); expect(ctl.history.hist.length).toBe(h + 1); // one entry per burst
    expect(ctl.state.announce).toContain('moved ' + n0.name);
    ctl.undo(); expect(ctl.nById[id]).toMatchObject({ x: n0.x, y: n0.y });
    key(ctl, 'ArrowRight'); const e0 = ctl.state.edges.length;
    key(ctl, 'c'); expect(ctl.state.kbConnect).toBe(id);
    key(ctl, 'ArrowRight'); const to = ctl.state.sel!.id; expect(to).not.toBe(id);
    key(ctl, 'Enter'); expect(ctl.state.kbConnect).toBeNull(); expect(ctl.state.edges.length).toBe(e0 + 1);
    expect(ctl.state.edges[e0]).toMatchObject({ from: id, to }); expect(ctl.state.announce).toContain('connected');
    key(ctl, 'c'); key(ctl, 'Escape'); expect(ctl.state.kbConnect).toBeNull(); expect(ctl.state.sel).not.toBeNull(); expect(ctl.state.announce).toContain('cancelled');
    key(ctl, 'c'); key(ctl, 'Enter'); expect(ctl.state.edges.length).toBe(e0 + 1); // same node: cancelled, nothing added
    key(ctl, 'Delete'); expect(ctl.state.announce).toContain('deleted');
  });
  it('? opens keyboard help, Escape closes it first, and the palette lists it', () => {
    key(ctl, '?'); expect(ctl.state.helpOpen).toBe(true);
    key(ctl, '/'); expect(ctl.state.palette).toBe(false); // modal: other bindings wait
    key(ctl, 'Escape'); expect(ctl.state.helpOpen).toBe(false);
    key(ctl, '?'); key(ctl, '?'); expect(ctl.state.helpOpen).toBe(false);
    expect(ctl.paletteItems().map(i => i.label)).toContain('keyboard shortcuts');
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
    expect(labels).toContain('+ event stream'); expect(labels).toContain('fit canvas'); expect(labels.some(l => l.startsWith('hide edge labels'))).toBe(true); expect(labels.some(l => l.startsWith('hide edge hover card'))).toBe(true);
    ctl.setState({ pq: 'trace' }); expect(ctl.paletteItems().map(i => i.label)).toEqual(['show execution trace']);
  });
  it('edge card setting defaults on, persists, and closes an open card when disabled', () => {
    const id = ctl.state.edges[0]!.id;
    ctl.setState({ sel: { kind: 'edge', id }, hoverEdge: id }); ctl.cardFor = id; ctl.cardPos = { left: 12, top: 24 };
    expect(ctl.state.ui.edgeCard).toBe(true);
    ctl.setUi('edgeCard');
    expect(ctl.state.ui.edgeCard).toBe(false); expect(ctl.state.hoverEdge).toBe(id); expect(ctl.state.sel).toEqual({ kind: 'edge', id }); expect(ctl.cardFor).toBeNull(); expect(ctl.cardPos).toBeNull();
    expect(JSON.parse(uiStorage['wb.ui'] || '{}').edgeCard).toBe(false);
    ctl.setUi('edgeCard'); expect(ctl.state.ui.edgeCard).toBe(true);
  });
});
