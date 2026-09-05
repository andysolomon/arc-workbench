import { describe, expect, it } from 'vitest';
import { MigrationError, authoredEdgeId, docId, edgeId, isGraphDocument, isGraphNode, isGraphRegion, isParadigmId, isVisualFamily, migrate, nodeId, setIdClock } from '../../src/model';
import { EXAMPLES, exportV1, familyOfGk, fromDocument, toDocument } from '../../src/paradigms';

describe('model guards', () => {
  it('accepts the vocabulary and rejects strangers', () => {
    expect(isParadigmId('workflow')).toBe(true); expect(isParadigmId('uml')).toBe(false);
    expect(isVisualFamily('amber')).toBe(true); expect(isVisualFamily('service')).toBe(false);
    expect(isGraphNode({ id: 'a', type: 'x', name: 'n', x: 0, y: 0 })).toBe(true);
    expect(isGraphNode({ id: 'a', type: 'x', name: 'n', x: 0, y: 0, visualFamily: 'queue' })).toBe(false);
    expect(isGraphRegion({ id: 'r', variant: 'lane', label: 'l', x: 0, y: 0, w: 1, h: 1, ownerKind: 'team' })).toBe(true);
    expect(isGraphRegion({ id: 'r', variant: 'lane', label: 'l', x: 0, y: 0, w: 1, h: 1, ownerKind: 'boss' })).toBe(false);
  });
  it('ids follow the prototype scheme with an injectable clock', () => {
    setIdClock(() => 1234);
    expect(nodeId('approval')).toBe('approval_1234'); expect(edgeId()).toBe('e1234'); expect(docId()).toBe('doc_1234');
    expect(authoredEdgeId('a', 'b')).toBe('a>b'); expect(authoredEdgeId('a', 'b', 3)).toBe('a>b#3');
    setIdClock(() => Date.now());
  });
});

describe('documents and migrations', () => {
  const hooks = { familyOfAlias: familyOfGk };
  it('v3 documents round-trip through the flat state', () => {
    for (const [pid, list] of Object.entries(EXAMPLES)) {
      const ex = list[0]!;
      const doc = toDocument(pid as never, ex.name, { docId: 'd', nodes: ex.nodes, edges: ex.edges, regions: ex.regions, rps: ex.rps, view: { x: 0, y: 0, k: 1 } });
      expect(isGraphDocument(doc)).toBe(true);
      expect(doc.nodes.every(n => typeof n.visualFamily === 'string')).toBe(true);
      const flat = fromDocument(doc);
      expect(flat.edges).toEqual(ex.edges); expect(flat.regions).toEqual(ex.regions); expect(flat.rps).toBe(ex.rps);
      expect(migrate(doc, hooks)).toBe(doc);
    }
  });
  it('v1 exchange documents migrate to v3 with regions keyed by family', () => {
    const ex = EXAMPLES.workflow[0]!;
    const v1 = exportV1('workflow', ex.name, { docId: 'd1', nodes: ex.nodes, edges: ex.edges, regions: ex.regions, rps: ex.rps, view: { x: 0, y: 0, k: 1 } });
    // a legacy v1 region carries `kind: 'queue'` — it must resolve to amber and the alias must vanish
    const legacy = { ...v1, regions: v1.regions.map(({ family: _f, ...r }, i) => (i === 0 ? { ...r, kind: 'queue' } : { ...r, family: 'cyan' })) };
    const doc = migrate(legacy, hooks);
    expect(doc.version).toBe(3);
    expect(doc.regions[0]!.family).toBe('amber');
    expect('kind' in doc.regions[0]!).toBe(false);
    expect(doc.regions[1]!.family).toBe('cyan');
    expect(doc.nodes[0]).toEqual({ ...ex.nodes[0], visualFamily: 'indigo' });
    expect(doc.edges).toEqual(ex.edges);
    expect(doc.metadata.load).toBe(ex.rps);
  });
  it('rejects garbage', () => {
    expect(() => migrate({ version: 2 }, hooks)).toThrow(MigrationError);
    expect(() => migrate({ version: 1, paradigm: 'uml', nodes: [], edges: [] }, hooks)).toThrow(MigrationError);
  });
});
