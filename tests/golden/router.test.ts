import { describe, it } from 'vitest';
import { EXAMPLES, ORDER, PARADIGMS, familyOf } from '../../src/paradigms';
import { RoutePlanner, geomOfWith, seqGeo, type PlanInput } from '../../src/router';
import { protoOf, timeline } from '../../src/sim';
import { expectClose, hOf, load } from './util';

const G = load<Record<string, Record<string, unknown>>>('router');
describe('router goldens — same path strings, labels and channels', () => {
  for (const pid of ORDER) for (const ex of EXAMPLES[pid]) {
    const key = pid + '/' + ex.id;
    it(key, () => {
      const g = G[key]!, H = hOf(ex.nodes);
      const mk = (plain = false, labels = true): PlanInput => ({ paradigm: pid, nodes: ex.nodes, edges: ex.edges, geomOf: geomOfWith(200, H), gap: 8, plain, protoOf: e => protoOf(pid, e), structured: !!PARADIGMS[pid].structured, labels, nodeH: H });
      const P = new RoutePlanner(), s = mk();
      const base = P.routes(s, null, null);
      expectClose({ sig: P.sig(s, null, null), routes: base, chans: pid === 'sequence' ? null : P.chans }, g['base']);
      const Q = new RoutePlanner(), sp = mk(true);
      expectClose({ sig: Q.sig(sp, null, null), routes: Q.routes(sp, null, null) }, g['independent']);
      expectClose(P.sig(mk(false, false), null, null), g['noLabelsSig']);
      const e0 = ex.edges[0]!, last = ex.nodes[ex.nodes.length - 1]!;
      const ptrFree = { edge: e0.id, end: 'to' as const, x: last.x + 50, y: last.y + 300, node: null };
      const ptrSnap = { edge: e0.id, end: 'from' as const, x: last.x, y: last.y, node: last };
      const drag = { [ex.nodes[1]!.id]: { x: ex.nodes[1]!.x + 37, y: ex.nodes[1]!.y - 21 } };
      expectClose({ sig: P.sig(s, null, ptrFree), routes: P.solve(s, null, ptrFree) }, g['ptrFree']);
      expectClose({ sig: P.sig(s, null, ptrSnap), routes: P.solve(s, null, ptrSnap) }, g['ptrSnap']);
      expectClose({ sig: P.sig(s, drag, null), routes: P.solve(s, drag, null) }, g['drag']);
      // memo: identical signature returns the same object
      if (P.routes(s, null, null) !== P.routes(s, null, null)) throw new Error('route memo broke');
      if (pid === 'sequence') {
        const geo = seqGeo({ nodes: ex.nodes, edges: ex.edges, nodeH: H, geomOf: geomOfWith(200, H), regions: ex.regions, W: 200, edgeDef: e => PARADIGMS.sequence.EDGES[e.kind], familyOf: n => familyOf('sequence', n), timeline });
        const { tl, ...rest } = geo;
        const gs = g['seqGeo'] as Record<string, unknown> & { tl: { msgs: unknown[]; total: number } };
        expectClose(rest, Object.fromEntries(Object.entries(gs).filter(([k]) => k !== 'tl')));
        expectClose({ total: tl.total, ids: tl.msgs.map(m => m.id) }, { total: gs.tl.total, ids: gs.tl.msgs.map(m => (m as { id: string }).id) });
      }
    });
  }
});
