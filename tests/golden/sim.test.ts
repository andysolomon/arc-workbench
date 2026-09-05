import { describe, it } from 'vitest';
import { EXAMPLES, ORDER } from '../../src/paradigms';
import { makeParadigmSim, makeSim, polyline, tick, tickSequence, tickState, tickWorkflow } from '../../src/sim';
import type { Metrics } from '../../src/sim';
import type { ParadigmId } from '../../src/model';
import { expectClose, load, seeded } from './util';

type Golden = Record<string, { paradigm: ParadigmId; rps: number; ticks: unknown[]; histLen: number; polyline: Record<string, string> }>;
const G = load<Golden>('sim');
const strip = (m: Metrics) => { const { t: _t, ...sys } = m.sys as Metrics['sys'] & { t?: number }; return { nodes: m.nodes, edges: m.edges, sys, run: m.run ?? null, tl: m.tl ? { total: m.tl.total, msgs: m.tl.msgs.map(x => ({ id: x.id, start: x.start, end: x.end, lat: x.lat })) } : null }; };

describe('simulation goldens — same input → same metrics within 1e-6', () => {
  for (const pid of ORDER) for (const ex of EXAMPLES[pid]) {
    const key = pid + '/' + ex.id, g = G[key]!;
    it(key, () => {
      seeded(42, () => {
        const st = (pid === 'architecture' || pid === 'dataflow') ? makeSim() : makeParadigmSim(pid);
        for (let i = 0; i < 24; i++) {
          const m = pid === 'workflow' ? tickWorkflow(st as never, ex.nodes, ex.edges, ex.rps, 0.25)
            : pid === 'state' ? tickState(st as never, ex.nodes, ex.edges, ex.rps, 0.25)
            : pid === 'sequence' ? tickSequence(st as never, ex.nodes, ex.edges, ex.rps, 0.25)
            : tick(st as never, ex.nodes, ex.edges, ex.rps, 0.25);
          expectClose(strip(m), g.ticks[i], `${key}#${i}`);
        }
        expectClose(st.hist.length, g.histLen);
        expectClose(polyline(st.hist, 'p99', 300, 64), g.polyline['p99']);
        expectClose(polyline(st.hist, 'rps', 300, 64, Math.max(1, ...st.hist.map(h => h.rps))), g.polyline['rps']);
        expectClose(polyline(st.hist, 'qtot', 300, 64), g.polyline['qtot']);
      });
    });
  }
});
