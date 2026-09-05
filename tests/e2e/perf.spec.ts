// The three budgets from the brief (§4 · Performance), asserted at preset scale (~60 nodes / ~90 edges):
//   16.7 ms pan frame · 8 ms telemetry pass at 4 Hz · 250 ms commit for a model edit.
import { expect, test } from '@playwright/test';
import { openApp, setMode } from './helpers';

const p95 = (xs: number[]): number => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length * 0.95)] ?? 0;
const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

for (const zoomMode of ['smooth', 'crisp'] as const) {
  test(`budgets at preset scale (zoomMode=${zoomMode})`, async ({ page }) => {
    await openApp(page, zoomMode === 'smooth' ? '/?zoomMode=smooth' : '/');
    await page.evaluate(() => window.__workbench.loadStress('architecture', 60, 90));
    await expect(page.locator('.tg-gnode')).toHaveCount(60);
    await page.waitForTimeout(600);
    const counts = await page.evaluate(() => ({ n: window.__workbench.ctl.state.nodes.length, e: window.__workbench.ctl.state.edges.length }));
    expect(counts.e).toBeGreaterThanOrEqual(80);

    // ---- pan frame: drag the background. Two numbers: the app's main-thread cost per frame
    // (frame() + the style/layout it forces) and the rAF cadence. Headless Chromium rasterises
    // with SwiftShader (software), which drops vsyncs repainting the gradient grid regardless of
    // the app's work — so the cadence budget is asserted strictly only on a hardware renderer.
    const software = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl'); const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); const r = d && gl ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : ''; return /SwiftShader|llvmpipe|Software/i.test(r) ? r : ''; });
    const canvas = (await page.locator('.tg-gcanvas').boundingBox())!;
    const sx = canvas.x + canvas.width - 60, sy = canvas.y + canvas.height - 120;
    await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __self: number[]; __stop: () => void }, g = window.__workbench.ctl.gestures, view = document.querySelector('.tg-gcanvas > div:nth-child(2)') as HTMLElement;
      w.__frames = []; w.__self = [];
      const orig = g.frame.bind(g); g.frame = () => { const t = performance.now(); orig(); void view.offsetHeight; w.__self.push(performance.now() - t); };
      let last = performance.now(), on = true; const tick = (): void => { const t = performance.now(); w.__frames.push(t - last); last = t; if (on) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      w.__stop = () => { on = false; g.frame = orig; };
    });
    await page.mouse.move(sx, sy); await page.mouse.down();
    for (let i = 1; i <= 60; i++) await page.mouse.move(sx - i * 6, sy - i * 3);
    await page.mouse.up();
    const pan = await page.evaluate(() => { const w = window as unknown as { __frames: number[]; __self: number[]; __stop: () => void }; w.__stop(); return { frames: w.__frames.slice(2), self: w.__self }; });
    console.log(`[perf ${zoomMode}] pan frame main-thread avg ${avg(pan.self).toFixed(2)} ms · p95 ${p95(pan.self).toFixed(2)} ms · rAF cadence avg ${avg(pan.frames).toFixed(2)} ms · p95 ${p95(pan.frames).toFixed(2)} ms${software ? ' · software renderer: ' + software : ''}`);
    expect(pan.self.length).toBeGreaterThanOrEqual(30);
    expect(p95(pan.self)).toBeLessThanOrEqual(4); // the app's share of a 16.7 ms frame
    // on hardware (or with PERF_STRICT=1) no frame may drop; SwiftShader repaints the gradient grid
    // in ~2 vsyncs whatever the app does, so there the guard is "never worse than three"
    const strict = !software || !!process.env['PERF_STRICT'];
    expect(p95(pan.frames)).toBeLessThanOrEqual(strict ? 16.7 + 1.5 : 50);

    // ---- telemetry pass: 20 patches with metrics live, style + layout forced each time ----
    await setMode(page, 'simulate');
    // 60 nodes fit at overview zoom, where the telemetry block is display:none by design — attached is enough
    await expect(page.locator('.tg-gnode-tel').first()).toBeAttached({ timeout: 3000 });
    await page.waitForTimeout(600);
    const tel = await page.evaluate(() => {
      const ctl = window.__workbench.ctl, el = document.querySelector('.tg-gcanvas') as HTMLElement, out: number[] = [];
      for (let i = 0; i < 20; i++) { ctl.simState && (ctl.metrics = ctl.simTick(0.25)); const t = performance.now(); ctl.patchTelemetry(); void el.offsetHeight; out.push(performance.now() - t); }
      return out;
    });
    console.log(`[perf ${zoomMode}] telemetry pass avg ${avg(tel).toFixed(2)} ms · max ${Math.max(...tel).toFixed(2)} ms`);
    expect(avg(tel)).toBeLessThanOrEqual(8);

    // ---- commit: add · delete · relayout, each measured to the frame after React commits ----
    const commit = async (fn: string): Promise<number> => page.evaluate(async (src: string) => {
      const ctl = window.__workbench.ctl; const t = performance.now();
      (new Function('ctl', src))(ctl);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t;
    }, fn);
    const add = await commit("ctl.addNode('service')");
    const del = await commit("ctl.setState({ sel: { kind: 'node', id: ctl.state.nodes[0].id } }); ctl.deleteSel()");
    const lay = await commit('ctl.autoLayout()');
    console.log(`[perf ${zoomMode}] commit add ${add.toFixed(1)} ms · delete ${del.toFixed(1)} ms · relayout ${lay.toFixed(1)} ms`);
    for (const ms of [add, del, lay]) expect(ms).toBeLessThanOrEqual(250);
  });
}

test('pan and zoom write transform on one element and nothing else re-renders', async ({ page }) => {
  await openApp(page);
  // wait for the load sequence (fit latch, measurement, de-overlap) to stop writing the store
  let v0 = -1; await expect.poll(async () => { const v = await page.evaluate(() => window.__workbench.ctl.store.version()); const same = v === v0; v0 = v; return same; }, { intervals: [400], timeout: 10_000 }).toBe(true);
  const before = await page.evaluate(() => ({ v: window.__workbench.ctl.store.version(), tf: (document.querySelector('.tg-gcanvas > div:nth-child(2)') as HTMLElement).style.transform }));
  const c = (await page.locator('.tg-gcanvas').boundingBox())!;
  await page.mouse.move(c.x + c.width - 40, c.y + c.height - 100); await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(c.x + c.width - 40 - i * 5, c.y + c.height - 100 - i * 2);
  const mid = await page.evaluate(() => ({ v: window.__workbench.ctl.store.version(), tf: (document.querySelector('.tg-gcanvas > div:nth-child(2)') as HTMLElement).style.transform }));
  expect(mid.v).toBe(before.v); // no store write during the gesture → no React render
  expect(mid.tf).not.toBe(before.tf); // the viewport element moved
  await page.mouse.up();
  // one commit on release (plus the one-time 'drag to pan' hint retiring)
  await expect.poll(() => page.evaluate(() => window.__workbench.ctl.store.version())).toBeGreaterThanOrEqual(before.v + 1);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__workbench.ctl.store.version())).toBeLessThanOrEqual(before.v + 2);
});
