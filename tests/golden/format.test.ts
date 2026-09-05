import { describe, it } from 'vitest';
import { EXAMPLES, ORDER, defaultEdgeKind } from '../../src/paradigms';
import { dropTone, fL, fmt, fmtMin, fmtMs, p99Tone, pktStyleFor, rateText, sparkPts, unitFor, weightOf } from '../../src/sim';
import { expectClose, load } from './util';

type Misc = { fmt: Record<string, string>; fmtMs: Record<string, string>; fmtMin: Record<string, string>; defaultEdge: Record<string, Record<string, string>>; spark: Record<string, string>; pkt: unknown[]; tone: Record<string, Record<string, unknown>> };
const g = load<Misc>('misc');
describe('formatting and dispatch goldens', () => {
  it('fmt / fmtMs / fmtMin', () => { for (const k of Object.keys(g.fmt)) { expectClose(fmt(+k), g.fmt[k]); expectClose(fmtMs(+k), g.fmtMs[k]); expectClose(fmtMin(+k), g.fmtMin[k]); } });
  it('defaultEdgeKind for every node pair', () => {
    for (const pid of ORDER) { const ex = EXAMPLES[pid][0]!; ex.nodes.forEach(a => ex.nodes.forEach(b => { if (a !== b) expectClose(defaultEdgeKind(pid, a, b), g.defaultEdge[pid]![a.id + '>' + b.id]); })); }
  });
  it('tones, units, rate text', () => {
    const st = { arr: 1234.5, util: 0.83, lat: 45.2, q: 12, err: 0.012, health: 'warn' as const };
    for (const pid of ORDER) {
      const ex = EXAMPLES[pid][0]!, t = g.tone[pid]!;
      expectClose([12, 480.5, 1441, 1600, 9999].map(v => fL(pid, v)), t['fL']);
      expectClose([12, 401, 481, 1441, 1501].map(v => p99Tone(pid, v)), t['p99']);
      expectClose([0, 1.5, 1000].map(d => dropTone(pid, d, { rps: ex.rps })), t['drop']);
      expectClose([1, ex.rps, ex.rps * 3].map(r => weightOf(ex.rps, r)), t['weight']);
      expectClose(ex.nodes.map(n => unitFor(pid, n, st)), t['unit']);
      expectClose(ex.edges.map(e => rateText(pid, 'simulate', e, 777.7)), t['rate']);
      expectClose(ex.edges.map(e => rateText(pid, 'design', e, 777.7)), t['rateDesign']);
    }
  });
  it('sparklines and packet styles', () => {
    expectClose({ a: sparkPts([1, 5, 3, 8, 0]), b: sparkPts([2]), c: sparkPts([0, 0, 0]), none: sparkPts(undefined) }, g.spark);
    const cases: Array<[number, boolean, 1 | 0]> = [[0.2, false, 1], [10, false, 1], [10, true, 1], [10, true, 0], [4000, false, 1], [90000, true, 1]];
    expectClose(cases.map(([r, a, k]) => { const s = pktStyleFor(r, a, k); return s.dur ? { opacity: s.opacity, strokeWidth: s.strokeWidth, '--dur': s.dur } : s; }), g.pkt);
  });
});
