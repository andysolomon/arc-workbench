import { describe, it } from 'vitest';
import { analyze } from '../../src/analyze';
import { EXAMPLES, ORDER } from '../../src/paradigms';
import type { Metrics } from '../../src/sim';
import { expectClose, load } from './util';

const G = load<Record<string, { withMetrics: unknown; design: unknown }>>('analyze');
const S = load<Record<string, { ticks: Array<{ nodes: Metrics['nodes']; edges: Metrics['edges']; sys: Metrics['sys']; run: Metrics['run']; tl: Metrics['tl'] }> }>>('sim');
describe('analysis goldens — same findings, same footers', () => {
  for (const pid of ORDER) for (const ex of EXAMPLES[pid]) {
    const key = pid + '/' + ex.id;
    it(key, () => {
      const t = S[key]!.ticks[23]!;
      const m: Metrics = { nodes: t.nodes, edges: t.edges, sys: t.sys, run: t.run ?? null, ...(t.tl ? { tl: t.tl } : {}) };
      expectClose(analyze(pid, ex.nodes, ex.edges, m, ex.regions, ex.rps), G[key]!.withMetrics);
      expectClose(analyze(pid, ex.nodes, ex.edges, null, ex.regions, ex.rps), G[key]!.design);
    });
  }
});
