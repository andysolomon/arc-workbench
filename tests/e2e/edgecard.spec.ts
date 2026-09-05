// The edge card is placed once and pinned — never chased on later renders. 80 ms open intent,
// 700 ms close, 56 px keep-alive halo.
import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test('edge card: open intent, pinned position, keep-alive halo, close delay', async ({ page }) => {
  await openApp(page);
  const hit = page.locator('g.tg-edge-g .tg-edge-hit').nth(5);
  const bb = (await hit.boundingBox())!;
  // a long straight run: sample the path midpoint
  const mid = await hit.evaluate(p => { const l = (p as SVGPathElement).getTotalLength(); const pt = (p as SVGPathElement).getPointAtLength(l / 2); const r = (p as SVGPathElement).getBoundingClientRect(); const c = (p.closest('.tg-gcanvas') as HTMLElement).getBoundingClientRect(); const ctm = (p as SVGPathElement).getScreenCTM()!; return { x: ctm.a * pt.x + ctm.c * pt.y + ctm.e, y: ctm.b * pt.x + ctm.d * pt.y + ctm.f, r, c }; });
  await page.mouse.move(mid.x, mid.y);
  await page.waitForTimeout(30);
  await expect(page.getByText('○—○')).toHaveCount(0); // before the 80 ms intent window
  await expect(page.getByText('○—○')).toBeVisible({ timeout: 400 });
  const card = page.locator('[data-chrome]').filter({ hasText: '○—○' });
  const p1 = (await card.boundingBox())!;
  await page.mouse.move(mid.x + 6, mid.y); await page.waitForTimeout(150);
  const p2 = (await card.boundingBox())!;
  expect(p2.x).toBe(p1.x); expect(p2.y).toBe(p1.y); // pinned
  // travel toward the card: inside the 56px halo the close timer is cancelled
  await page.mouse.move(p1.x - 40, p1.y + p1.height / 2, { steps: 4 }); await page.waitForTimeout(800);
  await expect(card).toBeVisible();
  await page.mouse.move(p1.x + p1.width / 2, p1.y + p1.height / 2, { steps: 4 }); await page.waitForTimeout(800);
  await expect(card).toBeVisible();
  // leave everything: still there at 400 ms, gone after 700 ms
  await page.mouse.move(mid.x, mid.y, { steps: 2 }); await page.waitForTimeout(100);
  await page.mouse.move(mid.x + 300, bb.y + bb.height + 500, { steps: 2 });
  await page.waitForTimeout(400);
  await expect(card).toBeVisible();
  await expect(card).toHaveCount(0, { timeout: 1500 });
  expect(bb.width).toBeGreaterThan(0);
});

test('endpoint handles are screen-constant and rewire on drop', async ({ page }) => {
  await openApp(page);
  await page.locator('.tg-zoom-label').click(); // k = 1
  const path = page.locator('g.tg-edge-g .tg-edge-hit').nth(2);
  const pt = await path.evaluate(p => { const el = p as SVGPathElement, l = el.getTotalLength(), q = el.getPointAtLength(l / 2), m = el.getScreenCTM()!; return { x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f }; });
  await page.mouse.move(pt.x, pt.y); await page.mouse.click(pt.x, pt.y);
  await expect(page.locator('circle[data-t="endf"]')).toHaveCount(1);
  const r1 = await page.locator('circle[data-t="endfh"]').getAttribute('r');
  expect(Number(r1)).toBe(20);
  // the inspector covers the zoom control while an edge is selected (as in the prototype): zoom with the wheel
  const c = (await page.locator('.tg-gcanvas').boundingBox())!;
  await page.mouse.move(c.x + 300, c.y + c.height - 80); await page.mouse.wheel(0, 400); await page.waitForTimeout(400);
  await expect.poll(async () => Number(await page.locator('circle[data-t="endfh"]').getAttribute('r'))).toBeGreaterThan(20); // ÷ k
  // drop the source handle on another node: the edge rewires
  const from = await page.evaluate(() => window.__workbench.ctl.state.edges.find(e => e.id === window.__workbench.ctl.state.sel!.id)!.from);
  const h = (await page.locator('circle[data-t="endfh"]').boundingBox())!;
  const target = page.locator('.tg-gnode').filter({ hasNot: page.locator(`[data-kind="${await page.evaluate(id => window.__workbench.ctl.nById[id]!.type, from)}"]`) }).last();
  const tb = (await target.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down(); await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 8 }); await page.mouse.up();
  const after = await page.evaluate(() => window.__workbench.ctl.state.edges.find(e => e.id === window.__workbench.ctl.state.sel!.id)!.from);
  expect(after).not.toBe(from);
});
