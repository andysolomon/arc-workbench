import { describe, it } from 'vitest';
import { analyze } from '../../src/analyze';
import { EXAMPLES, ORDER } from '../../src/paradigms';
import { p99Text, type Metrics } from '../../src/sim';
import type { Analysis, Finding } from '../../src/analyze';
import type { ParadigmId } from '../../src/model';

// Two deliberate divergences from the prototype analyzer (PORT-NOTES §3 · ARC-169): findings
// carry `evidence`, which the prototype never had, and the p99 footers print through the same
// formatter as the HUD so one value cannot read two ways. Everything else must match exactly.
const port = (a: Analysis): Analysis => ({ ...a, list: a.list.map(f => { const { evidence: _e, ...rest } = f; return rest as Finding; }) });
type Footer = { label: string; value: string } | null;
const expected = (pid: ParadigmId, g: unknown, m: Metrics | null): unknown => {
  const e = g as { list: unknown; a: Footer; b: Footer };
  const p99 = (f: Footer): Footer => f && /p99/.test(f.label) ? { ...f, value: p99Text(pid, m) } : f;
  return { list: e.list, a: p99(e.a), b: p99(e.b) };
};
import { expectClose, load } from './util';

const G = load<Record<string, { withMetrics: unknown; design: unknown }>>('analyze');
const S = load<Record<string, { ticks: Array<{ nodes: Metrics['nodes']; edges: Metrics['edges']; sys: Metrics['sys']; run: Metrics['run']; tl: Metrics['tl'] }> }>>('sim');
describe('analysis goldens — same findings, same footers', () => {
  for (const pid of ORDER) for (const ex of EXAMPLES[pid]) {
    const key = pid + '/' + ex.id;
    it(key, () => {
      const t = S[key]!.ticks[23]!;
      const m: Metrics = { nodes: t.nodes, edges: t.edges, sys: t.sys, run: t.run ?? null, ...(t.tl ? { tl: t.tl } : {}) };
      expectClose(port(analyze(pid, ex.nodes, ex.edges, m, ex.regions, ex.rps)), expected(pid, G[key]!.withMetrics, m));
      expectClose(port(analyze(pid, ex.nodes, ex.edges, null, ex.regions, ex.rps)), expected(pid, G[key]!.design, null));
    });
  }
});
