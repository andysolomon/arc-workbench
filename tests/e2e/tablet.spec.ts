// iPad portrait and landscape (ARC-168): the shell reorganises instead of squeezing, every panel
// leaves half the viewport to the canvas, controls stay whole and 44 px, and editing needs no hover.
import { expect, test, type Page } from '@playwright/test';
import { state } from './helpers';

const FORMS = [
  { name: 'iPad portrait', viewport: { width: 820, height: 1180 }, form: 'tablet-portrait' },
  { name: 'iPad landscape', viewport: { width: 1180, height: 820 }, form: 'tablet-landscape' },
] as const;
type Box = { x: number; y: number; width: number; height: number };
const disjoint = (a: Box, b: Box): boolean => a.x >= b.x + b.width || b.x >= a.x + a.width || a.y >= b.y + b.height || b.y >= a.y + a.height;
const box = async (page: Page, sel: string): Promise<Box> => (await page.locator(sel).first().boundingBox())!;
// a point on the node's title that is clear of the (±22 px) touch hit areas of the top and left ports
const grip = (b: Box): { x: number; y: number } => ({ x: b.x + b.width * 0.35, y: b.y + 30 });
const open = async (page: Page): Promise<void> => { await page.goto('/'); await expect(page.locator('.tg-gnode').first()).toBeVisible(); await page.waitForTimeout(400); };
const touch = (page: Page, type: string, x: number, y: number, target = 'window') => page.evaluate(([t, cx, cy, tg]) => {
  const ev = new PointerEvent(t as string, { clientX: cx as number, clientY: cy as number, pointerId: 7, isPrimary: true, pointerType: 'touch', button: 0, buttons: t === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true });
  const el = tg === 'window' ? window : document.elementFromPoint(cx as number, cy as number)!;
  el.dispatchEvent(ev);
}, [type, x, y, target] as const);

for (const F of FORMS) {
  test.describe(F.name, () => {
    test.use({ viewport: F.viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

    test('form, drawer and panels keep half the viewport for the canvas and never cover the chrome', async ({ page }) => {
      await open(page);
      await expect(page.locator('html')).toHaveAttribute('data-form', F.form);
      expect(await page.evaluate(() => document.querySelector('meta[name=viewport]')!.getAttribute('content'))).toContain('viewport-fit=cover');
      const vw = F.viewport.width, vh = F.viewport.height;
      const header = await box(page, 'header'), strip = await box(page, 'section[aria-label="status"]');
      // library: closed by default on a tablet, an overlay drawer when opened, dismissed by a canvas tap
      await expect(page.locator('nav[aria-label="component library"]')).toHaveCount(0);
      await page.getByRole('button', { name: 'component library' }).click();
      const lib = await box(page, 'nav[aria-label="component library"]');
      expect(lib.width).toBeLessThanOrEqual(vw * 0.6);
      expect((await box(page, '.tg-gcanvas')).width).toBeGreaterThanOrEqual(vw * 0.5);
      await page.touchscreen.tap(vw - 40, header.y + header.height + 200);
      await expect(page.locator('nav[aria-label="component library"]')).toHaveCount(0);
      // inspector + findings
      await page.keyboard.press('ArrowRight');
      const insp = await box(page, '.wb-insp');
      await page.getByRole('radio', { name: 'analyze' }).click();
      await expect(page.locator('.wb-find')).toBeVisible();
      const find = await box(page, '.wb-find'), insp2 = await box(page, '.wb-insp'), canvas = await box(page, '.tg-gcanvas');
      expect(disjoint(find, insp2)).toBe(true);
      for (const b of [find, insp2, insp]) { expect(b.y).toBeGreaterThanOrEqual(header.y + header.height - 1); expect(b.y + b.height).toBeLessThanOrEqual(strip.y + 1); }
      if (F.form === 'tablet-portrait') {
        expect(insp2.height).toBeLessThanOrEqual(vh * 0.45 + 1); expect(find.height).toBeLessThanOrEqual(vh * 0.45 + 1);
        expect(Math.min(find.y, insp2.y) - canvas.y).toBeGreaterThanOrEqual(canvas.height * 0.5 - 2); // the canvas above the sheets
        expect(find.x + find.width).toBeLessThanOrEqual(insp2.x + 1); // side by side, not stacked
      } else {
        expect(canvas.width - find.width - insp2.width).toBeGreaterThanOrEqual(vw * 0.5); // free canvas between the side panels
      }
      // settings never overlaps the inspector, and the zoom control stays reachable
      await page.getByRole('button', { name: 'display settings' }).click();
      const pop = await box(page, '.wb-settings');
      expect(disjoint(pop, insp2)).toBe(true);
      expect(disjoint(await box(page, '.wb-zoom'), insp2)).toBe(true);
      await page.keyboard.press('Escape');
    });

    test('controls stay whole and 44 px; preset and mode names never truncate mid-word', async ({ page }) => {
      await open(page);
      const small = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('header button, header select, header input:not([type=range]), section[aria-label="status"] button, .wb-zoom button')).filter(el => el.offsetParent !== null).map(el => { const r = el.getBoundingClientRect(); return { t: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24), w: r.width, h: r.height }; }).filter(x => x.h < 44 || x.w < 44));
      expect(small).toEqual([]);
      const fit = await page.getByRole('combobox', { name: 'example preset' }).evaluate((el: HTMLSelectElement) => { const probe = document.createElement('span'); const cs = getComputedStyle(el); probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font}`; probe.textContent = el.options[el.selectedIndex]!.text; document.body.appendChild(probe); const w = probe.getBoundingClientRect().width; probe.remove(); return { text: w, room: el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 18 }; });
      expect(fit.room).toBeGreaterThanOrEqual(fit.text);
      for (const mode of ['design', 'simulate', 'analyze']) { const r = page.getByRole('radio', { name: mode }); expect(await r.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true); await expect(r).toHaveText(mode); }
    });

    test('touch: tap selects, one finger drags, a port drag connects, the inspector edits, the canvas pans', async ({ page }) => {
      await open(page);
      expect(await state<boolean>(page, 'ctl.touch')).toBe(true);
      // ports hide at overview zoom by design: zoom in to working level first (44 px buttons, tapped)
      for (let i = 0; i < 3; i++) await page.getByTitle('Zoom in').click();
      await expect(page.locator('.tg-gcanvas')).not.toHaveAttribute('data-zoom', 'overview');
      await page.evaluate(() => { const c = window.__workbench.ctl; const n = c.state.nodes[0]!; const r = c.canvasRect()!; c.setState(s => ({ view: { ...s.view, x: r.width / 3 - n.x * s.view.k, y: r.height / 3 - n.y * s.view.k } })); });
      await page.waitForTimeout(200);
      const n0 = await box(page, '.tg-gnode'), g = grip(n0);
      await page.touchscreen.tap(g.x, g.y);
      await expect(page.locator('.tg-gnode[aria-pressed="true"]')).toHaveCount(1);
      const id = await state<string>(page, 'ctl.state.sel.id'), x0 = await state<number>(page, 'ctl.nById[ctl.state.sel.id].x');
      // drag the node with a touch pointer
      await touch(page, 'pointerdown', g.x, g.y, 'target');
      for (let i = 1; i <= 8; i++) await touch(page, 'pointermove', g.x + i * 15, g.y);
      await touch(page, 'pointerup', g.x + 120, g.y);
      await expect.poll(() => state<number>(page, `ctl.nById['${id}'].x`)).toBeGreaterThan(x0);
      // ports are visible on the selected node; drag one onto another node to connect
      const port = page.locator('.tg-gnode[aria-pressed="true"] .tg-port[data-side="right"]');
      await expect(port).toHaveCSS('opacity', '1');
      const pb = (await port.boundingBox())!, e0 = await state<number>(page, 'ctl.state.edges.length');
      // a target that is on screen and not the selected node
      // a target that is on screen, not the selected node, and not already connected from it
      const target = await page.evaluate(() => {
        const ctl = window.__workbench.ctl, from = ctl.state.sel!.id, taken = new Set(ctl.state.edges.filter(e => e.from === from).map(e => e.to));
        const c = document.querySelector('.tg-gcanvas')!.getBoundingClientRect();
        for (const n of ctl.state.nodes) {
          if (n.id === from || taken.has(n.id)) continue;
          const el = ctl.refs.nodeEl(n.id); if (!el) continue; const r = el.getBoundingClientRect();
          if (r.left > c.left + 20 && r.right < c.right - 20 && r.top > c.top + 20 && r.bottom < c.bottom - 20) return { x: r.left, y: r.top };
        }
        return null;
      });
      expect(target).not.toBeNull();
      await touch(page, 'pointerdown', pb.x + pb.width / 2, pb.y + pb.height / 2, 'target');
      for (let i = 1; i <= 6; i++) await touch(page, 'pointermove', pb.x + (target!.x + 40 - pb.x) * i / 6, pb.y + (target!.y + 30 - pb.y) * i / 6, 'target');
      await touch(page, 'pointerup', target!.x + 40, target!.y + 30, 'target');
      await expect.poll(() => state<number>(page, 'ctl.state.edges.length')).toBe(e0 + 1);
      // inspector edit without hover
      await page.touchscreen.tap(g.x + 120, g.y);
      const name = page.locator('.wb-insp input').first(); await name.fill('Touched'); await expect(page.locator('.tg-gnode[aria-pressed="true"] .tg-gnode-title')).toHaveText('Touched');
      // pan the background
      const vx = await state<number>(page, 'ctl.state.view.x');
      await page.keyboard.press('Escape');
      // a spot that is bare canvas: no node, no floating chrome (zoom control, sheets, hints)
      const bare = await page.evaluate(() => { const c = document.querySelector('.tg-gcanvas')!.getBoundingClientRect(); for (const [fx, fy] of [[0.5, 0.9], [0.5, 0.5], [0.15, 0.5], [0.85, 0.5], [0.3, 0.3]] as Array<[number, number]>) { const x = c.left + c.width * fx, y = c.top + c.height * fy; const el = document.elementFromPoint(x, y); if (el && !el.closest('.tg-gnode') && !el.closest('[data-chrome]') && el.closest('.tg-gcanvas')) return { x, y }; } return null; });
      expect(bare).not.toBeNull();
      await touch(page, 'pointerdown', bare!.x, bare!.y, 'target');
      for (let i = 1; i <= 6; i++) await touch(page, 'pointermove', bare!.x - i * 20, bare!.y);
      await touch(page, 'pointerup', bare!.x - 120, bare!.y);
      await expect.poll(() => state<number>(page, 'ctl.state.view.x')).not.toBe(vx);
    });

    test('rotation re-flows the shell', async ({ page }) => {
      await open(page);
      await page.keyboard.press('ArrowRight');
      await page.setViewportSize({ width: F.viewport.height, height: F.viewport.width });
      const other = F.form === 'tablet-portrait' ? 'tablet-landscape' : 'tablet-portrait';
      await expect(page.locator('html')).toHaveAttribute('data-form', other);
      const insp = await box(page, '.wb-insp');
      if (other === 'tablet-portrait') expect(insp.width).toBeGreaterThan(F.viewport.height * 0.9); else expect(insp.width).toBeLessThanOrEqual(264);
    });
  });
}
