// where does a pan frame spend its time? main-thread self time of frame(), rAF cadence with and without the grid, store writes after release
import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
await p.goto('http://localhost:4173/'); await p.waitForSelector('.tg-gnode'); await p.waitForTimeout(400);
await p.evaluate(() => window.__workbench.loadStress('architecture', 60, 90)); await p.waitForTimeout(800);
const run = async (label) => {
  await p.evaluate(() => { const w = window, g = w.__workbench.ctl.gestures; w.__self = []; w.__frames = []; const orig = g.frame.bind(g); g.frame = () => { const t = performance.now(); orig(); const el = document.querySelector('.tg-gcanvas > div:nth-child(2)'); void el.offsetHeight; w.__self.push(performance.now() - t); }; let last = performance.now(), on = true; const tick = () => { const t = performance.now(); w.__frames.push(t - last); last = t; if (on) requestAnimationFrame(tick); }; requestAnimationFrame(tick); w.__stop = () => { on = false; g.frame = orig; }; w.__writes = []; const os = w.__workbench.ctl.store.set; w.__workbench.ctl.store.set = (patch, cb) => { w.__writes.push(Object.keys(typeof patch === 'function' ? patch(w.__workbench.ctl.store.get()) : patch).join(',') + ' @ ' + (new Error().stack.split('\n')[2] || '').trim().slice(0, 90)); return os(patch, cb); }; });
  const c = await p.locator('.tg-gcanvas').boundingBox(); const sx = c.x + c.width - 60, sy = c.y + c.height - 120;
  await p.mouse.move(sx, sy); await p.mouse.down(); for (let i = 1; i <= 60; i++) await p.mouse.move(sx - i * 6, sy - i * 3); await p.mouse.up(); await p.waitForTimeout(500);
  const r = await p.evaluate(() => { const w = window; w.__stop(); const s = xs => { const a = xs.slice().sort((x, y) => x - y); return { n: xs.length, avg: (xs.reduce((q, v) => q + v, 0) / xs.length).toFixed(2), p50: a[Math.floor(a.length * .5)]?.toFixed(2), p95: a[Math.floor(a.length * .95)]?.toFixed(2), max: a[a.length - 1]?.toFixed(2) }; }; return { self: s(w.__self), frames: s(w.__frames.slice(2)), writes: w.__writes }; });
  console.log(label, JSON.stringify(r.self), JSON.stringify(r.frames)); console.log(' writes:', r.writes.length, r.writes.slice(0, 10).join(' | '));
};
await run('grid on ');
await p.evaluate(() => window.__workbench.ctl.setUi('grid')); await p.waitForTimeout(300);
await run('grid off');
await p.evaluate(() => window.__workbench.ctl.setUi('grid'));
// idle cadence baseline
const idle = await p.evaluate(async () => { const f = []; let last = performance.now(); await new Promise(res => { let i = 0; const t = () => { const n = performance.now(); f.push(n - last); last = n; if (++i < 60) requestAnimationFrame(t); else res(); }; requestAnimationFrame(t); }); const a = f.slice(2).sort((x, y) => x - y); return { p50: a[Math.floor(a.length * .5)].toFixed(2), p95: a[Math.floor(a.length * .95)].toFixed(2) }; });
console.log('idle rAF cadence', JSON.stringify(idle));
console.log('gpu', await p.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl'); const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; }));
await b.close();
