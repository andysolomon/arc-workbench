import { describe, expect, it } from 'vitest';
import { History, createStore, initialState, park, parked, docCount } from '../../src/store';
import { EXAMPLES } from '../../src/paradigms';

describe('store', () => {
  it('merges patches, applies updaters, notifies, and drains after-commit callbacks in order', () => {
    const st = createStore(initialState());
    let n = 0; const un = st.subscribe(() => n++);
    st.set({ mode: 'analyze' }); st.set(s => ({ rps: s.rps * 2 }));
    expect(st.get().mode).toBe('analyze'); expect(st.get().rps).toBe(4800); expect(n).toBe(2);
    const order: string[] = [];
    st.set({}, () => order.push('a')); st.set({}, () => order.push('b'));
    expect(order).toEqual([]); st.drainAfterCommit(); expect(order).toEqual(['a', 'b']); st.drainAfterCommit(); expect(order).toEqual(['a', 'b']);
    un(); st.set({}); expect(n).toBe(4);
    expect(st.version()).toBe(5);
  });
});
describe('history', () => {
  it('snapshots, undoes, redoes, caps at 60 and drops the future on a new snap', () => {
    const h = new History(), ex = EXAMPLES.state[0]!;
    const g0 = { nodes: ex.nodes, edges: ex.edges, regions: ex.regions };
    expect(h.undo(g0)).toBeNull();
    h.snap(g0);
    const g1 = { ...g0, nodes: g0.nodes.slice(1) };
    const back = h.undo(g1)!; expect(back.nodes.length).toBe(g0.nodes.length); expect(h.canRedo).toBe(true);
    const fwd = h.redo(back)!; expect(fwd.nodes.length).toBe(g1.nodes.length);
    h.snap(g1); expect(h.canRedo).toBe(false);
    for (let i = 0; i < 70; i++) h.snap(g1); expect(h.hist.length).toBe(60);
  });
});
describe('parking', () => {
  it('parks and restores a document per paradigm and counts nodes for the switcher', () => {
    const docs = {}; const ex = EXAMPLES.workflow[0]!;
    park(docs, 'workflow', { nodes: ex.nodes, edges: ex.edges, regions: ex.regions, rps: 40, presetId: 'release', view: { x: 0, y: 0, k: 1 }, touched: false, hist: [], future: [] });
    expect(parked(docs, 'workflow')?.nodes.length).toBe(ex.nodes.length); expect(parked(docs, 'state')).toBeNull();
    expect(docCount(docs, 'workflow', 'dataflow', 3)).toBe(ex.nodes.length); expect(docCount(docs, 'dataflow', 'dataflow', 3)).toBe(3); expect(docCount(docs, 'state', 'dataflow', 3)).toBe(0);
  });
});
