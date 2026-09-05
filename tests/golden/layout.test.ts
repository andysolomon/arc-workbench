import { describe, it } from 'vitest';
import { autoLayout } from '../../src/layout';
import { EXAMPLES, ORDER } from '../../src/paradigms';
import { expectClose, hOf, load } from './util';

const G = load<Record<string, { nodes: unknown[]; regions: unknown[] }>>('layout');
describe('layout goldens', () => {
  for (const pid of ORDER) for (const ex of EXAMPLES[pid]) {
    it(pid + '/' + ex.id, () => {
      const H = hOf(ex.nodes);
      const r = autoLayout(pid, ex.nodes, ex.edges, ex.regions, { W: 200, hOf: id => H[id]! });
      expectClose({ nodes: r.nodes, regions: r.regions }, G[pid + '/' + ex.id]);
    });
  }
});
