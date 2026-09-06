// The benchmark matrix (ARC-162). Each scenario is measured inside the page by the Stress Lab
// runner and judged against src/app/budgets.ts; every scenario merges its result into
// bench-results/latest.json (per-scenario files first, so a restarted worker loses nothing) and two
// runs can be compared with `node scripts/bench-compare.mjs a b`.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PAN_WARMUP_MAX, SCENARIOS, failed, judge, skipped, type BenchResult } from '../../src/app/budgets';
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
    console.log(`[bench] ${sc.id} · ${r.env.software ? 'software' : 'hardware'} renderer · ${r.env.idleCadenceMs} ms idle cadence${r.env.throttled ? ' (THROTTLED)' : ''}${r.env.visible ? '' : ' (HIDDEN)'}${r.pan.frames ? ` · pan ${r.pan.frames} frames after ${r.pan.warmup} warm-up (cold start ${r.pan.coldMs.toFixed(0)} ms)` : ''}`);
    console.log(`[bench] ${sc.id}: ${vs.map(v => `${v.key}=${v.value == null ? 'n/a' : v.value.toFixed(1)}/${v.limit}${v.pass === false ? ' FAIL' : v.pass === null ? ` SKIP(${v.reason})` : ''}`).join(' · ')}`);
    // CI is the supported environment by definition: a throttled or hidden page must fail loudly, never skip its way to green
    expect(r.env.supported, `unsupported bench environment: ${JSON.stringify(r.env)}`).toBe(true);
    // the cadence is judged at steady state: on a hardware renderer the warm-up must have ended on a
    // steady clock, not on its cap (SwiftShader never settles under 1.5× vsync and skips the cadence anyway)
    if (!sc.heapCycles && !r.env.software) expect(r.pan.warmup, `pan warm-up never reached a steady frame clock (cold start ${r.pan.coldMs.toFixed(0)} ms)`).toBeLessThan(PAN_WARMUP_MAX);
    // the only skips CI may produce are the ones its renderer cannot measure
    expect(skipped(vs).filter(v => !/software renderer|performance\.memory/.test(v.reason ?? '')).map(v => `${v.key}: ${v.reason}`)).toEqual([]);
    expect(bad.map(v => `${v.label}: ${v.value?.toFixed(1)} ${v.unit} > ${v.limit} ${v.unit}`)).toEqual([]);
  });
}
