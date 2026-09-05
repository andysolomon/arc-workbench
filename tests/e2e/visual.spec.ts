// Visual parity with the prototype: the same document, fitted the same way, at the four zoom
// levels in both themes. The canvas region is diffed pixel-for-pixel; the budget is 1 %.
import { expect, test, type Page } from '@playwright/test';
import { HAS_PROTO } from '../../playwright.config';

test.skip(!HAS_PROTO, 'the prototype export (Form submission process/) is not present');
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const PROTO = 'http://localhost:4180/Workbench%20v10.dc.html';
const settle = async (p: Page): Promise<void> => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700); };
async function prep(p: Page, url: string): Promise<void> {
  await p.goto(url); await expect(p.locator('.tg-gnode').first()).toBeVisible({ timeout: 20_000 }); await settle(p);
  await p.locator('.tg-zoom-fit').click(); await p.waitForTimeout(400);
}
// working is compared at exactly 100 % (the zoom label resets to 1): at the fitted 0.82 the DC harness's
// <span class="sc-interp"> wrappers shift glyph runs under fractional css zoom by a sub-pixel, which reads as
// ~1.4 % anti-aliasing noise with an identical DOM and identical boxes (see PORT-NOTES §5)
async function zoomSteps(p: Page, n: number): Promise<void> { if (n === 0) { await p.locator('.tg-zoom-label').click(); await p.waitForTimeout(500); return; } const btn = p.locator('.tg-zoom-btn', { hasText: n > 0 ? '+' : '−' }); for (let i = 0; i < Math.abs(n); i++) { await btn.click(); await p.waitForTimeout(80); } await p.waitForTimeout(500); }
async function shot(p: Page): Promise<PNG> { const b = (await p.locator('.tg-gcanvas').boundingBox())!; const buf = await p.screenshot({ clip: { x: b.x, y: b.y, width: Math.floor(b.width), height: Math.floor(b.height) } }); return PNG.sync.read(buf); }

// zoom ladder: fit ≈ 0.82 → −7 → overview (0.42) · −3 → compact (0.62) · 0 → working · +5 → detail (1.32)
const LEVELS: Array<[string, number]> = [['overview', -7], ['compact', -3], ['working', 0], ['detail', 5]];

for (const theme of ['dark', 'light'] as const) for (const [level, steps] of LEVELS) {
  test(`canvas matches the prototype · ${level} · ${theme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
    const a = await ctx.newPage(), b = await ctx.newPage();
    await prep(a, PROTO); await prep(b, 'http://localhost:4173/');
    for (const p of [a, b]) { if (theme === 'light') { await p.keyboard.press('d'); await p.waitForTimeout(200); } await zoomSteps(p, steps); await expect(p.locator('.tg-gcanvas')).toHaveAttribute('data-zoom', level); }
    const A = await shot(a), B = await shot(b);
    expect([B.width, B.height]).toEqual([A.width, A.height]);
    const diff = new PNG({ width: A.width, height: A.height });
    const bad = pixelmatch(A.data, B.data, diff.data, A.width, A.height, { threshold: 0.12, includeAA: false });
    const ratio = bad / (A.width * A.height);
    console.log(`[visual] ${level} · ${theme}: ${(ratio * 100).toFixed(3)} % pixels differ (${bad})`);
    if (ratio > 0.01) { const fs = await import('node:fs'); fs.mkdirSync('test-results/visual', { recursive: true }); fs.writeFileSync(`test-results/visual/${level}-${theme}-proto.png`, PNG.sync.write(A)); fs.writeFileSync(`test-results/visual/${level}-${theme}-port.png`, PNG.sync.write(B)); fs.writeFileSync(`test-results/visual/${level}-${theme}-diff.png`, PNG.sync.write(diff)); }
    expect(ratio).toBeLessThanOrEqual(0.01);
    await ctx.close();
  });
}
