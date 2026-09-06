// Compare two bench-results files: node scripts/bench-compare.mjs before.json after.json
// Prints every budget with both values and the delta; exits 1 when a budget that passed now fails.
import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2).map(f => JSON.parse(readFileSync(f, 'utf8')));
if (!a || !b) { console.error('usage: node scripts/bench-compare.mjs before.json after.json'); process.exit(2); }
let regressed = 0;
for (const [sc, after] of Object.entries(b.verdicts)) {
  const before = a.verdicts[sc] ?? [];
  console.log(`\n${sc}`);
  for (const v of after) {
    const p = before.find(x => x.key === v.key), pv = p?.value ?? null, d = pv == null || v.value == null ? null : v.value - pv;
    const flag = p && p.pass === true && v.pass === false ? '  ← REGRESSION' : '';
    if (flag) regressed++;
    const skip = v.pass === null ? `  skipped: ${v.reason ?? 'not measured'}` : '';
    console.log(`  ${v.label.padEnd(58)} ${String(pv == null ? 'n/a' : pv.toFixed(1)).padStart(9)} → ${String(v.value == null ? 'n/a' : v.value.toFixed(1)).padStart(9)} ${v.unit.padEnd(3)} ${d == null ? '' : (d >= 0 ? '+' : '') + d.toFixed(1)}  (limit ${v.limit})${skip}${flag}`);
  }
}
console.log(regressed ? `\n${regressed} budget(s) regressed` : '\nno budget regressed');
process.exit(regressed ? 1 : 0);
