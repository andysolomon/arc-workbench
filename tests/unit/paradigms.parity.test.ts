import { describe, expect, it } from 'vitest';
import { BLANK, EXAMPLES, ORDER, PARADIGMS, edgeDefaults, exportV1, familyOf, familyOfGk, gkOf, nodeDefaults, relOf } from '../../src/paradigms';
import type { ParadigmId } from '../../src/model';
import { protoExamples, protoParadigms } from './proto';

// prototype flags are `1`; the port types them as `true`. Normalise for deep equality.
const norm = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (typeof x === 'function') continue;
      if (k === 'gk' || k === 'gkOf' || k === 'family' || k === 'kind' || k === 'color') continue;
      o[k] = x === 1 && ['human', 'fork', 'side', 'source', 'terminal', 'bad', 'initial', 'gov', 'alt', 'back', 'nowait', 'structured', 'dashed'].includes(k) ? true : norm(x);
    }
    return o;
  }
  return v;
};

describe('paradigm registry parity with paradigms.js', async () => {
  const PD = await protoParadigms();
  it('same paradigm order', () => { expect(ORDER).toEqual(PD.ORDER); });
  for (const pid of ORDER as ParadigmId[]) {
    const T = PARADIGMS[pid], PT = PD.PARADIGMS[pid];
    it(`${pid}: types, categories, edges, inspector, hud, metrics`, () => {
      expect(Object.keys(T.TYPES)).toEqual(Object.keys(PT.TYPES));
      expect(norm(T.TYPES)).toEqual(norm(PT.TYPES));
      expect(norm(T.CATS)).toEqual(norm(PT.CATS));
      expect(norm(T.EDGES)).toEqual(norm(PT.EDGES));
      expect(T.INSPECT).toEqual(PT.INSPECT);
      expect(T.HUD).toEqual(PT.HUD);
      expect(T.METRICS).toEqual(PT.METRICS);
      expect(T.COMMANDS ?? null).toEqual(PT.COMMANDS ?? null);
      expect(T.FORMS ?? null).toEqual(PT.FORMS ?? null);
      expect([T.label, T.title, T.axis, T.family, T.ask, T.blurb, T.region, T.layout, T.defaultEdge, T.sim, T.unitNoun, T.edgeNoun, !!T.structured])
        .toEqual([PT.label, PT.title, PT.axis, PT.family, PT.ask, PT.blurb, PT.region, PT.layout, PT.defaultEdge, PT.sim, PT.unitNoun, PT.edgeNoun, !!PT.structured]);
    });
    it(`${pid}: family resolution matches gk → family`, () => {
      for (const type of Object.keys(T.TYPES)) {
        expect(familyOf(pid, { type })).toBe(PD.familyOf(pid, { type }));
        expect(familyOf(pid, { type, visualFamily: 'danger' })).toBe('danger');
        expect(gkOf(pid, { type })).toBe(PD.gkOf(pid, { type }));
        expect(nodeDefaults(pid, type)).toEqual(PD.nodeDefaults(pid, type));
      }
      for (const kind of Object.keys(T.EDGES)) {
        expect(edgeDefaults(pid, kind)).toEqual(PD.edgeDefaults(pid, kind));
        expect(relOf(pid, { kind })).toBe(PD.relOf(pid, { kind }));
      }
      expect(relOf(pid, { kind: 'nope' })).toBe('flow');
    });
    it(`${pid}: a11y sentences`, () => {
      for (const ex of EXAMPLES[pid]) for (const e of ex.edges) expect(T.a11y('A', e, 'B', T)).toBe(PT.a11y('A', e, 'B', PT));
    });
  }
  it('legacy alias → family table', () => {
    for (const gk of ['service', 'component', 'database', 'queue', 'agent', 'tool', 'input', 'output', 'external', 'failure', 'nope']) expect(familyOfGk(gk)).toBe(PD.familyOfGk(gk));
  });
});

describe('examples parity with examples.js', async () => {
  const X = await protoExamples(), PD = await protoParadigms();
  for (const pid of ORDER as ParadigmId[]) {
    it(`${pid}: same documents, regions keyed by family`, () => {
      const mine = EXAMPLES[pid], theirs = X.EXAMPLES[pid];
      expect(mine.length).toBe(theirs.length);
      mine.forEach((ex, i) => {
        const t = theirs[i];
        expect({ id: ex.id, name: ex.name, rps: ex.rps, nodes: ex.nodes, edges: ex.edges }).toEqual({ id: t.id, name: t.name, rps: t.rps, nodes: t.nodes, edges: t.edges });
        expect(ex.regions).toEqual((t.regions ?? []).map((r: Record<string, unknown>) => { const { kind, ...rest } = r; return { ...rest, family: PD.familyOfGk(kind) }; }));
      });
    });
    it(`${pid}: blank document`, () => { expect(BLANK(pid)).toEqual(X.BLANK(pid)); });
  }
  it('exportV1 matches toDoc', () => {
    for (const pid of ORDER as ParadigmId[]) {
      const ex = EXAMPLES[pid][0]!;
      const s = { docId: 'doc_1', nodes: ex.nodes, edges: ex.edges, regions: ex.regions, rps: ex.rps, view: { x: 1, y: 2, k: 1 } };
      const theirs = PD.toDoc(pid, ex.name, s);
      expect(exportV1(pid, ex.name, s)).toEqual(theirs);
    }
  });
});
