import { describe, expect, it } from 'vitest';
import { EXAMPLES, ORDER, PARADIGMS } from '../../src/paradigms';
import type { ParadigmId } from '../../src/model';

describe('example documents are well-formed', () => {
  for (const pid of ORDER as ParadigmId[]) {
    const T = PARADIGMS[pid];
    for (const ex of EXAMPLES[pid]) {
      it(`${pid} · ${ex.id}`, () => {
        const ids = new Set<string>();
        for (const n of ex.nodes) { expect(T.TYPES[n.type], n.type).toBeDefined(); expect(ids.has(n.id)).toBe(false); ids.add(n.id); expect(n.x % 1).toBe(0); }
        const eids = new Set<string>();
        for (const e of ex.edges) { expect(T.EDGES[e.kind], e.kind).toBeDefined(); expect(ids.has(e.from)).toBe(true); expect(ids.has(e.to)).toBe(true); expect(eids.has(e.id)).toBe(false); eids.add(e.id); }
        // regions are keyed by visual family; the legacy alias never reaches a document
        for (const r of ex.regions) { expect(['boundary', 'lane', 'stage', 'phase', 'zone']).toContain(r.variant); expect(r.family).toBeDefined(); expect('kind' in r).toBe(false); }
      });
    }
  }
  it('every paradigm has a first example that loads', () => { for (const pid of ORDER) expect(EXAMPLES[pid][0]!.nodes.length).toBeGreaterThan(0); });
});
