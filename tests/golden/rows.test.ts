import { describe, it } from 'vitest';
import { bodyRows, tiersOf } from '../../src/app/viewModel';
import { EXAMPLES, ORDER } from '../../src/paradigms';
import { expectClose, hOf, load } from './util';

const misc = load<{ rows: Record<string, Record<string, unknown>> }>('misc');
const R = load<Record<string, { tiers: Array<{ id: string; family: string; label: string; style: Record<string, string> }> }>>('router');
describe('view-model goldens', () => {
  it('body rows per node', () => { for (const pid of ORDER) for (const n of EXAMPLES[pid][0]!.nodes) expectClose(bodyRows(pid, n), misc.rows[pid]![n.id], pid + '/' + n.id); });
  it('tier bands (architecture)', () => {
    for (const pid of ORDER) for (const ex of EXAMPLES[pid]) {
      const H = hOf(ex.nodes);
      const t = tiersOf(pid, ex.nodes, id => Math.max(H[id] || 0, 88));
      expectClose(t.map(g => ({ id: g.id, family: g.family, label: g.label, style: { position: 'absolute', left: g.left + 'px', top: g.top + 'px', width: g.width + 'px', height: g.height + 'px', pointerEvents: 'none' } })), R[pid + '/' + ex.id]!.tiers);
    }
  });
});
