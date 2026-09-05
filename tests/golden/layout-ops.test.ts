import { describe, it } from 'vitest';
import { OWNER_KINDS, deoverlap, fitLanes, laneMembers, laneOf, lanes } from '../../src/layout';
import { EXAMPLES } from '../../src/paradigms';
import { expectClose, hOf, load } from './util';

describe('lane and de-overlap goldens', () => {
  it('lanes: membership, fit after a drop, restack after a delete', () => {
    const g = load<Record<string, unknown>>('lanes'), ex = EXAMPLES.workflow[0]!, H = hOf(ex.nodes);
    const h = (n: { id: string }) => H[n.id] || 88;
    expectClose(Object.fromEntries(ex.nodes.map(n => [n.id, laneOf(n, ex.regions)?.id ?? null])), g['laneOf']);
    expectClose(Object.fromEntries(lanes(ex.regions).map(l => [l.id, laneMembers(l.id, ex.nodes, ex.regions).map(n => n.id)])), g['members']);
    const moved = ex.nodes.map(n => n.id === 'build' ? { ...n, y: 520 } : n);
    expectClose(fitLanes('workflow', ex.nodes, ex.regions, moved, 'build', h), g['moved']);
    const far = ex.nodes.map(n => n.id === 'qg' ? { ...n, y: 120 } : n);
    expectClose(fitLanes('workflow', ex.nodes, ex.regions, far, 'qg', h), g['far']);
    expectClose(fitLanes('workflow', ex.nodes, ex.regions.filter(r => r.id !== 'l2'), ex.nodes, null, h), g['all']);
    expectClose(OWNER_KINDS, g['ownerKinds']);
  });
  it('deoverlap pushes only the lower node in an overlapping column', () => {
    const g = load<{ hit: boolean; nodes: unknown[] }>('deoverlap'), ax = EXAMPLES.architecture[0]!, H = hOf(ax.nodes);
    const stacked = ax.nodes.map(n => n.id === 'apib' ? { ...n, x: 816, y: 200 } : n.id === 'pg' ? { ...n, x: 820, y: 230 } : n);
    const r = deoverlap(stacked, id => Math.max(H[id] || 0, 88), 200);
    expectClose({ hit: !!r, nodes: (r ?? stacked).map(n => ({ id: n.id, x: n.x, y: n.y })) }, g);
  });
});
