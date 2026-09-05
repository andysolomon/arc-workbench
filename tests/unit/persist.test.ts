// @vitest-environment jsdom
// Documents persist: one named record per paradigm, autosaved through a swappable store, restored
// on mount, migrated from older schemas, recovered from interrupted or failed saves, and moved
// in and out as JSON.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchController } from '../../src/app/controller';
import { MemoryStore, Workspace, docKey, newDocumentId } from '../../src/persist';
import { EXAMPLES, familyOfGk } from '../../src/paradigms';
import type { V1Document } from '../../src/model';

let store: MemoryStore;
const boot = (): WorkbenchController => { const c = new WorkbenchController({}, { storage: store }); c.mount(); c.store.drainAfterCommit(); c.store.drainAfterCommit(); return c; };
const key = (_c: WorkbenchController, k: string, o: Partial<KeyboardEventInit> = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, ...o }));
beforeEach(() => { vi.useFakeTimers(); store = new MemoryStore(); vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined }); history.replaceState(null, '', location.pathname); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('persistence', () => {
  it('create · edit · reload: the active document, paradigm, graph, load and viewport come back', () => {
    const a = boot();
    expect(a.state.save).toBe('clean'); expect(a.state.title).toBe('Product Analytics'); expect(a.state.docId).not.toBe('');
    a.setTitle('Checkout events'); a.setState({ rps: 777, view: { x: 12, y: 34, k: 0.8 } });
    key(a, 'ArrowRight'); key(a, 'Delete');
    expect(a.state.save).toBe('dirty');
    vi.advanceTimersByTime(700); expect(a.state.save).toBe('saved');
    const n = a.state.nodes.length, id = a.state.docId;
    a.switchParadigm('workflow'); a.store.drainAfterCommit(); a.store.drainAfterCommit();
    expect(a.state.save).toBe('saved'); expect(store.read('wb.session')).toContain('workflow');
    a.unmount();
    const b = boot();
    expect(b.state.paradigm).toBe('workflow'); expect(b.state.title).toBe('Release Delivery Workflow'); expect(b.state.save).toBe('saved');
    b.switchParadigm('dataflow'); b.store.drainAfterCommit(); b.store.drainAfterCommit();
    expect(b.state.title).toBe('Checkout events'); expect(b.state.docId).toBe(id); expect(b.state.nodes.length).toBe(n); expect(b.state.rps).toBe(777); expect(b.state.view).toEqual({ x: 12, y: 34, k: 0.8 });
    expect(b.dirty).toBe(false); expect(b.history.canUndo).toBe(false);
    b.unmount();
  });
  it('a v1 document stored by an older build migrates deterministically', () => {
    const v1: V1Document = { version: 1, id: 'old', title: 'Legacy flow', paradigm: 'dataflow', nodes: [{ id: 'a', kind: 'source', position: { x: 16, y: 32 }, data: { name: 'Web' } }, { id: 'b', kind: 'stream', position: { x: 200, y: 32 }, data: { name: 'Events' } }], edges: [{ id: 'e1', relationship: 'event', source: 'a', target: 'b', data: { label: 'clicks', w: 2 } }], regions: [{ id: 'r1', variant: 'stage', label: 'ingest', kind: 'queue', x: 0, y: 0, w: 300, h: 200 }], metadata: { load: 500 } };
    store.write(docKey('dataflow'), JSON.stringify({ schema: 1, id: 'old', title: 'Legacy flow', paradigm: 'dataflow', presetId: 'blank', updatedAt: 1, doc: v1 }));
    const c = boot();
    expect(c.state.title).toBe('Legacy flow'); expect(c.state.rps).toBe(500);
    expect(c.state.nodes).toEqual([{ id: 'a', type: 'source', name: 'Web', x: 16, y: 32 }, { id: 'b', type: 'stream', name: 'Events', x: 200, y: 32 }]);
    expect(c.state.edges[0]).toMatchObject({ kind: 'event', from: 'a', to: 'b', label: 'clicks', w: 2 });
    expect(c.state.regions[0]).toMatchObject({ variant: 'stage', family: 'amber' });
    // the next save rewrites the record at the current schema, and it reads back byte-for-byte
    expect(c.saveNow()).toBe(true); expect(store.read(docKey('dataflow'))).toContain('"version":3');
    const again = new Workspace(store, { familyOfAlias: familyOfGk }).load('dataflow');
    expect(again.kind).toBe('ok'); if (again.kind === 'ok') expect(again.record.doc).toEqual(c.record().doc);
    c.unmount();
  });
  it('a failed save keeps the document, shows failed, and retry recovers', () => {
    const c = boot(); key(c, 'ArrowRight'); key(c, 'Delete'); const n = c.state.nodes.length;
    store.failWrites = new Error('quota exceeded');
    vi.advanceTimersByTime(700);
    expect(c.state.save).toBe('failed'); expect(c.state.toast?.tone).toBe('warn'); expect(c.state.toast?.text).toContain('quota exceeded');
    expect(c.state.nodes.length).toBe(n); expect(store.read(docKey('dataflow'))).toBeNull();
    c.retrySave(); expect(c.state.save).toBe('failed');
    store.failWrites = null; c.retrySave(); expect(c.state.save).toBe('saved'); expect(store.read(docKey('dataflow'))).toContain('"schema":1');
    c.unmount();
  });
  it('an interrupted save is recovered from the pending record; a corrupt record falls back to the last good one', () => {
    const a = boot(); key(a, 'ArrowRight'); key(a, 'Delete'); vi.advanceTimersByTime(700); const n = a.state.nodes.length; a.unmount();
    // crash between pending and current: pending is newer and complete
    const rec = JSON.parse(store.read(docKey('dataflow'))!) as { updatedAt: number; title: string };
    store.write(docKey('dataflow') + '.pending', JSON.stringify({ ...rec, title: 'newer', updatedAt: rec.updatedAt + 1 }));
    const b = boot();
    expect(b.state.title).toBe('newer'); expect(b.state.nodes.length).toBe(n);
    // the dialog names the recovered version and offers the older complete save
    expect(b.state.confirm?.title).toContain('Recovered an interrupted save of newer'); expect(b.state.confirm?.alt?.label).toBe('use previous save');
    expect(store.read(docKey('dataflow') + '.pending')).toBeNull(); expect(store.read(docKey('dataflow'))).toContain('"newer"');
    b.state.confirm!.alt!.run(); b.setState({ confirm: null });
    expect(b.state.title).toBe(rec.title); expect(b.state.save).toBe('saved'); expect(store.read(docKey('dataflow'))).not.toContain('"newer"');
    b.unmount();
    // the current record rots; prev is intact
    store.write(docKey('dataflow') + '.prev', store.read(docKey('dataflow'))!); store.write(docKey('dataflow'), '{"schema":1,"id":"x"');
    const c = boot();
    expect(c.state.title).toBe(rec.title); expect(c.state.confirm?.title).toContain('Restored the last good save'); expect(c.state.confirm?.alt?.label).toContain('export');
    expect(store.read(docKey('dataflow') + '.broken')).toContain('"x"');
    c.unmount();
  });
  it('an unreadable record with no fallback opens a recovery dialog instead of a silent reset', () => {
    store.write(docKey('dataflow'), JSON.stringify({ schema: 1, id: 'x', title: 'Broken', paradigm: 'dataflow', doc: { version: 3, nodes: 'nope' } }));
    const c = boot();
    expect(c.state.presetId).toBe(EXAMPLES.dataflow[0]!.id);
    expect(c.state.confirm?.title).toContain('could not be read'); expect(c.state.confirm?.alt?.label).toContain('export');
    expect(c.workspace.broken('dataflow')).toContain('Broken');
    c.state.confirm!.run(); c.setState({ confirm: null });
    key(c, 'ArrowRight'); key(c, 'Delete'); vi.advanceTimersByTime(700); expect(c.state.save).toBe('saved');
    c.unmount();
  });
  it('export produces exchange JSON that imports back as one undoable transaction; garbage is refused', () => {
    const c = boot(); c.setTitle('Round trip'); key(c, 'ArrowRight'); key(c, 'Delete');
    const text = c.exportText(), ids = c.state.nodes.map(n => n.id).join(',');
    expect(JSON.parse(text)).toMatchObject({ version: 3, title: 'Round trip', paradigm: 'dataflow', metadata: { load: c.state.rps } });
    c.loadPreset('blank', true); c.store.drainAfterCommit(); expect(c.state.nodes.length).toBe(0);
    expect(c.importText(text, 'round-trip.json')).toBe(true); c.store.drainAfterCommit();
    expect(c.state.nodes.map(n => n.id).join(',')).toBe(ids); expect(c.state.title).toBe('Round trip'); expect(c.state.presetId).toBe('import'); expect(c.state.toast?.text).toBe('imported Round trip');
    c.undo(); expect(c.state.nodes.length).toBe(0); expect(c.state.presetId).toBe('blank');
    expect(c.importText('{"version":9}', 'junk.json')).toBe(false); expect(c.state.toast?.tone).toBe('warn'); expect(c.state.nodes.length).toBe(0);
    c.unmount();
  });
  it('importing into another paradigm asks when that paradigm holds a document', () => {
    const c = boot();
    const wf = JSON.stringify({ version: 3, id: 'w', title: 'WF', paradigm: 'workflow', nodes: [], edges: [], regions: [], metadata: {}, view: { x: 0, y: 0, k: 1 } });
    expect(c.importText(wf)).toBe(true); c.store.drainAfterCommit(); expect(c.state.paradigm).toBe('workflow'); expect(c.state.title).toBe('WF'); // no stored workflow doc: straight in
    c.switchParadigm('dataflow'); c.store.drainAfterCommit(); c.store.drainAfterCommit();
    c.docs.workflow = { ...c.docs.workflow!, nodes: EXAMPLES.workflow[0]!.nodes };
    expect(c.importText(wf)).toBe(true); expect(c.state.confirm?.title).toContain('Replace'); expect(c.state.paradigm).toBe('dataflow');
    c.state.confirm!.run(); c.store.drainAfterCommit(); expect(c.state.paradigm).toBe('workflow'); expect(c.state.nodes.length).toBe(0);
    c.unmount();
  });
  it('document ids are unique and the store contract is small', () => {
    expect(newDocumentId()).not.toBe(newDocumentId());
    const w = new Workspace(store, { familyOfAlias: familyOfGk });
    expect(w.load('state')).toEqual({ kind: 'none' }); expect(w.loadSession()).toBeNull(); expect(w.stored()).toEqual([]);
  });
});
