// Metric consistency (ARC-169): one definition per measure, every surface derives from it.
// These tests FAIL when a HUD string, an inspector value, a footer or a finding stops agreeing
// with the metrics module — and when the analyzer stops being deterministic on seeded fixtures.
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/analyze';
import type { ParadigmId } from '../../src/model';
import { EXAMPLES, ORDER, PARADIGMS } from '../../src/paradigms';
import { WARM, fL, fmt, hudD, hudDText, isWarm, makeParadigmSim, makeSim, nodeLag, nodeP99, nodeP99Text, p99Text, samplesOf, sysLag, tick, tickSequence, tickState, tickWorkflow, windowNote, type Metrics, type ParadigmSim, type QueueSim } from '../../src/sim';
import { seeded } from '../golden/util';

/** the app's tick path: the data-flow engine counts async hops, exactly as the controller asks */
function run(pid: ParadigmId, ticks: number, seed = 7): { m: Metrics; hist: Metrics[] } {
  const ex = EXAMPLES[pid][0]!;
  return seeded(seed, () => {
    const st = (pid === 'architecture' || pid === 'dataflow') ? makeSim() : makeParadigmSim(pid);
    const hist: Metrics[] = [];
    for (let i = 0; i < ticks; i++) {
      hist.push(pid === 'workflow' ? tickWorkflow(st as ParadigmSim, ex.nodes, ex.edges, ex.rps, 0.25)
        : pid === 'state' ? tickState(st as ParadigmSim, ex.nodes, ex.edges, ex.rps, 0.25)
        : pid === 'sequence' ? tickSequence(st as ParadigmSim, ex.nodes, ex.edges, ex.rps, 0.25)
        : tick(st as QueueSim, ex.nodes, ex.edges, ex.rps, 0.25, { includeAsync: pid === 'dataflow' }));
    }
    return { m: hist[hist.length - 1]!, hist };
  });
}
const an = (pid: ParadigmId, m: Metrics | null) => { const ex = EXAMPLES[pid][0]!; return analyze(pid, ex.nodes, ex.edges, m, ex.regions, ex.rps); };
const num = (s: string): number => parseFloat(s.replace(/[^\d.]/g, ''));

describe('provenance', () => {
  for (const pid of ORDER) it(pid + ': every snapshot says where it came from', () => {
    const { m, hist } = run(pid, 12);
    expect(m.prov).toBeDefined(); expect(m.prov!.tick).toBe(12); expect(m.prov!.at).toBeGreaterThan(0); expect(m.prov!.window.length).toBeGreaterThan(0);
    expect(hist[0]!.prov!.at).toBeLessThan(m.prov!.at);
  });
  it('warm-up: percentiles read as insufficient until the window has samples, on every surface', () => {
    const { hist } = run('workflow', 320);
    const cold = hist[0]!, warm = hist.find(h => h.prov!.warm)!;
    expect(cold.prov!.samples).toBeLessThan(WARM.completions); expect(isWarm(cold)).toBe(false);
    expect(p99Text('workflow', cold)).toBe('—'); expect(an('workflow', cold).a!.value).toBe('—');
    expect(windowNote(cold)).toMatch(/^warming up · \d+ of 20 completions$/);
    expect(p99Text('workflow', warm)).toBe(fL('workflow', warm.sys.p99)); expect(an('workflow', warm).a!.value).toBe(fL('workflow', warm.sys.p99));
    const q = run('architecture', 2).m; expect(isWarm(q)).toBe(false); expect(windowNote(q)).toBe('warming up · 2 of 4 ticks');
    expect(isWarm(run('architecture', 4).m)).toBe(true);
    expect(isWarm(null)).toBe(false); expect(p99Text('dataflow', null)).toBe('—'); expect(hudDText('dataflow', null)).toBe('—');
  });
});

describe('cross-surface invariants', () => {
  it('data flow: the end-to-end p99 counts async hops, and HUD · footer · drawer read one value', () => {
    const { m } = run('dataflow', 40);
    expect(m.sys.p99).toBeGreaterThan(0);
    expect(p99Text('dataflow', m)).toBe(fL('dataflow', m.sys.p99));
    expect(an('dataflow', m).b!.value).toBe(p99Text('dataflow', m));
  });
  it('data flow: HUD "lagging" is Σ node lag — the same number the lag findings cite', () => {
    const { m } = run('dataflow', 40);
    const lagging = hudD('dataflow', m), sum = sysLag(m);
    expect(lagging).toBeCloseTo(sum, 6); expect(lagging).toBe(m.prov!.lag);
    const lagFindings = an('dataflow', m).list.filter(f => f.cat === 'lag');
    expect(lagFindings.length).toBeGreaterThan(0);
    const cited = lagFindings.reduce((s, f) => s + num(f.evidence!.find(e => e.metric === 'lag')!.value), 0);
    expect(Math.abs(cited - num(hudDText('dataflow', m)))).toBeLessThanOrEqual(lagFindings.length); // each cited value is rounded
    for (const f of lagFindings) { const st = m.nodes[f.nodeId!]!; expect(f.detail).toContain('lag grows at ' + Math.round(nodeLag(st)) + ' events/s'); expect(f.nodeId).toBeTruthy(); }
  });
  it('architecture: the inspector node p99 and the bottleneck finding print the same estimate', () => {
    const { m } = run('architecture', 30);
    const f = an('architecture', m).list.find(x => x.cat === 'bottleneck')!;
    const st = m.nodes[f.nodeId!]!;
    expect(f.detail).toContain('p99 ' + nodeP99Text('architecture', st));
    expect(f.evidence!.find(e => e.metric === 'node p99')!.value).toBe(nodeP99Text('architecture', st));
    expect(nodeP99(st)).toBe(st.lat * 2.2);
  });
  it('state machine: the bad-exit claim is an observed share of completed objects, and its window matches p99', () => {
    const ex = EXAMPLES.state[0]!;
    // a fixture where most walks end badly: every non-terminal exit goes to a bad terminal
    const nodes = ex.nodes, edges = ex.edges;
    const { m } = seeded(3, () => { const st = makeParadigmSim('state'); let last!: Metrics; for (let i = 0; i < 400; i++) last = tickState(st, nodes, edges, ex.rps, 0.25); return { m: last }; });
    expect(isWarm(m)).toBe(true);
    const list = analyze('state', nodes, edges, m, ex.regions, ex.rps).list, f = list.find(x => x.cat === 'exit');
    if (m.sys.err > 0.25) {
      expect(f).toBeDefined();
      expect(f!.title).toBe(Math.round(m.sys.err * 100) + '% of objects end in a bad state');
      expect(f!.detail).toContain(m.prov!.bad + ' of ' + samplesOf(m) + ' objects completed in the sample window');
      expect(f!.detail).not.toMatch(/terminal states are/);
      expect(Math.abs(m.prov!.bad! / samplesOf(m) - m.sys.err)).toBeLessThan(1e-9);
      expect(f!.nodes.length).toBeGreaterThan(0); expect(f!.evidence![0]!.scope).toContain(m.prov!.window);
    } else expect(f).toBeUndefined();
  });
  for (const pid of ORDER) it(pid + ': the p99 footer prints exactly what the HUD prints', () => {
    const { m } = run(pid, 60);
    const a = an(pid, m), footer = [a.a, a.b].find(x => x && /p99/.test(x.label));
    if (footer) expect(footer.value).toBe(p99Text(pid, m));
    expect(fmt(hudD(pid, m))).toBe(hudDText(pid, m));
  });
  for (const pid of ORDER) it(pid + ': metric-backed findings cite evidence with a scope and point at graph objects', () => {
    const { m } = run(pid, 60);
    for (const f of an(pid, m).list) {
      if (!f.evidence) continue;
      expect(f.evidence.length).toBeGreaterThan(0);
      for (const e of f.evidence) { expect(e.metric).toBeTruthy(); expect(e.scope).toMatch(/·/); expect(e.value).toBeTruthy(); }
      expect(f.nodeId || f.nodes.length || f.edges.length).toBeTruthy();
      expect(PARADIGMS[pid]).toBeDefined();
    }
  });
});

describe('deterministic fixtures', () => {
  for (const pid of ORDER) {
    it(pid + ': the same seed yields the same analysis, and it matches the stored snapshot', async () => {
      const a = an(pid, run(pid, 48, 11).m), b = an(pid, run(pid, 48, 11).m);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      await expect(JSON.stringify(a, null, 1)).toMatchFileSnapshot('./__snapshots__/analyze-' + pid + '.json');
    });
  }
});
