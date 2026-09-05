// The benchmark matrix (ARC-162). Each scenario is measured inside the page by the Stress Lab
// runner and judged against src/app/budgets.ts; every scenario merges its result into
// bench-results/latest.json (per-scenario files first, so a restarted worker loses nothing) and two
// runs can be compared with `node scripts/bench-compare.mjs a b`.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { SCENARIOS, failed, judge, type BenchResult } from '../../src/app/budgets';
import { openApp } from './helpers';

test.use({ launchOptions: { args: ['--js-flags=--expose-gc'] } });
const DIR = 'bench-results';
const record = (r: BenchResult): void => {
  mkdirSync(DIR + '/scenarios', { recursive: true });
  writeFileSync(`${DIR}/scenarios/${r.scenario}.json`, JSON.stringify(r, null, 2));
  const results: Record<string, BenchResult> = {};
  for (const f of readdirSync(DIR + '/scenarios')) { const x = JSON.parse(readFileSync(`${DIR}/scenarios/${f}`, 'utf8')) as BenchResult; results[x.scenario] = x; }
  writeFileSync(`${DIR}/latest.json`, JSON.stringify({ at: new Date().toISOString(), commit: process.env['GITHUB_SHA'] ?? null, results, verdicts: Object.fromEntries(Object.values(results).map(x => [x.scenario, judge(x)])) }, null, 2));
};
// a fresh run starts clean (BENCH_KEEP=1 accumulates scenarios across invocations instead)
test.beforeAll(() => { if (existsSync(DIR + '/scenarios') && !process.env['BENCH_KEEP']) for (const f of readdirSync(DIR + '/scenarios')) unlinkSync(`${DIR}/scenarios/${f}`); });

for (const sc of SCENARIOS) {
  test(sc.label, async ({ page }) => {
    test.setTimeout(240_000);
    await openApp(page);
    const r = await page.evaluate(id => window.__workbench.bench(id), sc.id);
    record(r);
    const vs = judge(r), bad = failed(vs);
    console.log(`[bench] ${sc.id}: ${vs.map(v => `${v.key}=${v.value == null ? 'n/a' : v.value.toFixed(1)}/${v.limit}${v.pass === false ? ' FAIL' : ''}`).join(' · ')}`);
    expect(bad.map(v => `${v.label}: ${v.value?.toFixed(1)} ${v.unit} > ${v.limit} ${v.unit}`)).toEqual([]);
  });
}
