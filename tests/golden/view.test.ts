import { describe, it } from 'vitest';
import { EXAMPLES, ORDER, PARADIGMS, familyOf } from '../../src/paradigms';
import { geomOfWith, seqGeo } from '../../src/router';
import { timeline } from '../../src/sim';
import { crispDown, crispK, crispStep, docBounds, zoomLadder, zoomLevelOf } from '../../src/view';
import { expectClose, hOf, load } from './util';

const g = load<Record<string, unknown>>('view');
const R = load<Record<string, { docBounds: unknown }>>('router');
const ks = [0.15, 0.2, 0.3, 0.44, 0.45, 0.5, 0.69, 0.7, 0.97, 1, 1.2, 1.21, 1.7, 2.5];
describe('view goldens', () => {
  it('zoom ladder per device pixel ratio', () => { expectClose(zoomLadder(1), g['ladder1']); expectClose(zoomLadder(2), g['ladder2']); });
  it('crisp snapping and stepping', () => {
    expectClose(ks.map(k => crispK(k, true, 1)), g['crispK']); expectClose(ks.map(k => crispDown(k, true, 1)), g['crispDown']);
    expectClose(ks.map(k => crispStep(k, true, true, 1)), g['up']); expectClose(ks.map(k => crispStep(k, false, true, 1)), g['down']);
    expectClose(ks.map(k => crispStep(k, true, false, 1)), g['freeUp']); expectClose(ks.map(k => crispStep(k, false, false, 1)), g['freeDown']);
    expectClose(ks.map(k => zoomLevelOf(k, true)), g['level']);
  });
  it('document bounds per example', () => {
    for (const pid of ORDER) for (const ex of EXAMPLES[pid]) {
      const H = hOf(ex.nodes), footH = (id: string) => Math.max(H[id] || 0, 88);
      const seq = pid === 'sequence' ? seqGeo({ nodes: ex.nodes, edges: ex.edges, nodeH: H, geomOf: geomOfWith(200, H), regions: ex.regions, W: 200, edgeDef: e => PARADIGMS.sequence.EDGES[e.kind], familyOf: n => familyOf('sequence', n), timeline }) : null;
      expectClose(docBounds({ nodes: ex.nodes, regions: ex.regions, paradigm: pid, W: 200, footH, seq }), R[pid + '/' + ex.id]!.docBounds);
    }
  });
});
