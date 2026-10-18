// The System designs page states numbers derived from the examples and engines (src/docs/facts.ts).
// These pin the headline figures, so a preset or engine change that moves them is a visible diff.
import { describe, expect, it } from 'vitest';
import { DESIGNS } from '../../src/docs/designs';
import { exampleOf, factsOf, workbenchHref } from '../../src/docs/facts';
import { EXAMPLES, ORDER } from '../../src/paradigms';
import { decodeDocument } from '../../src/app/share';

describe('system design facts', () => {
  it('covers every example document exactly once', () => {
    const all = ORDER.flatMap((pid) => EXAMPLES[pid].map((e) => pid + '/' + e.id)).sort();
    expect(DESIGNS.map((d) => d.paradigm + '/' + d.id).sort()).toEqual(all);
  });

  it('load balanced: pods hold 2,667 rps each, Postgres 5,000, and the database tips over first', () => {
    const f = factsOf('architecture', exampleOf('architecture', 'lb'));
    if (f.kind !== 'queueing') throw new Error(f.kind);
    expect(f.rows.find((r) => r.id === 's1')?.max).toBeCloseTo(2666.67, 1);
    expect(f.rows.find((r) => r.id === 'db')?.max).toBe(5000);
    expect(f.first?.name).toBe('Postgres');
    expect(f.first?.at).toBeCloseTo(5000, 0);
    expect(f.health).toBe('ok');
  });

  it('rate limited: the limiter sheds everything over its 900 rps', () => {
    const f = factsOf('architecture', exampleOf('architecture', 'ratelimit'));
    if (f.kind !== 'queueing') throw new Error(f.kind);
    expect(f.rows.find((r) => r.id === 'rl')?.err).toBeCloseTo(1 - 900 / 2000, 6);
  });

  it('release workflow: the happy path and its first-pass yield come from the step data', () => {
    const f = factsOf('workflow', exampleOf('workflow', 'release'));
    if (f.kind !== 'execution') throw new Error(f.kind);
    expect(f.path).toEqual(['Commit', 'Pull Request', 'Build', 'Quality Gates', 'Approve', 'Canary', 'Release', 'Released']);
    expect(f.minutes).toBe(2 + 90 + 9 + 14 + 180 + 30 + 12);
    expect(f.yieldShare).toBeCloseTo(0.82 * 0.9 * 0.92, 6);
  });

  it('cache-miss request: the timeline total is the sum of the waited-for hops', () => {
    const f = factsOf('sequence', exampleOf('sequence', 'cachemiss'));
    if (f.kind !== 'timeline') throw new Error(f.kind);
    expect(f.total).toBe(5 + 8 + 6 + 1 + 2 + 1 + 38 + 2 + 3 + 12);
    expect(f.slowest?.lat).toBe(38);
  });

  it('agent run: terminal shares are a probability distribution', () => {
    const f = factsOf('state', exampleOf('state', 'agentrun'));
    if (f.kind !== 'markov') throw new Error(f.kind);
    expect(f.outcomes.reduce((s, o) => s + o.share, 0)).toBeCloseTo(1, 6);
    expect(f.outcomes[0]?.name).toBe('Completed');
  });

  it('every design links to a Workbench document that decodes to the same example', () => {
    for (const d of DESIGNS) {
      const ex = exampleOf(d.paradigm, d.id);
      const doc = decodeDocument(workbenchHref(d.paradigm, ex).split('#d=')[1] ?? '');
      expect(doc?.paradigm).toBe(d.paradigm);
      expect(doc?.nodes.length).toBe(ex.nodes.length);
      expect(doc?.edges.length).toBe(ex.edges.length);
    }
  });
});
