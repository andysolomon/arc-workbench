// Header chrome: one non-wrapping desktop row whose controls never overlap, both header menus
// open clear of any scroll clip, and the preset select shows whole names at desktop widths.
import { expect, test, type Locator } from '@playwright/test';
import { openApp, setMode, state } from './helpers';

/** true when no ancestor between the element and the header (inclusive) clips overflow */
const unclipped = (loc: Locator): Promise<boolean> => loc.evaluate(el => {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') return false;
    if (n.classList.contains('wb-header')) return true;
  }
  return true;
});
/** hit-test a popover: its corners, its centre and the centre of every row must land inside it */
const hitTest = (loc: Locator, rows: string): Promise<{ ok: boolean; inView: boolean }> => loc.evaluate((el, rowSel) => {
  const r = el.getBoundingClientRect();
  const pts: Array<[number, number]> = [[r.left + 6, r.top + 6], [r.right - 6, r.top + 6], [r.left + r.width / 2, r.top + r.height / 2], [r.left + 6, r.bottom - 6], [r.right - 12, r.bottom - 6]];
  const rowsOk = Array.from(el.querySelectorAll<HTMLElement>(rowSel)).every(row => {
    const b = row.getBoundingClientRect();
    return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest(rowSel) === row;
  });
  return {
    ok: rowsOk && pts.every(([x, y]) => el.contains(document.elementFromPoint(x, y))),
    inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
  };
}, rows);

// Desktop header must stay on a single row (from 1200px up to ~1840px), with no control
// overlap/clipping; if the middle viewport scrolls, every control must still be reachable.
for (const width of [1840, 1500, 1280, 1200]) {
  for (const mode of ['design', 'simulate', 'analyze'] as const) {
    test(`desktop header is one row, unclipped, reachable at ${width}px in ${mode} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openApp(page);
      await expect(page.locator('html')).toHaveAttribute('data-form', 'desktop');
      await setMode(page, mode);
      const header = page.locator('.wb-header');
      await expect(header).toBeVisible();
      const info = await header.evaluate(h => {
        const hr = h.getBoundingClientRect();
        const items = Array.from(h.querySelectorAll<HTMLElement>('button, select, input'));
        // a control inside the desktop scroll viewport may be scrolled out of its clip; intersect
        // it with the clipping ancestor's box so only what is actually painted counts
        const clipOf = (el: HTMLElement): DOMRect | null => {
          for (let n = el.parentElement; n && n !== h; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') return n.getBoundingClientRect();
          }
          return null;
        };
        const name = (el: HTMLElement) => el.getAttribute('aria-label') ?? el.getAttribute('title') ?? el.textContent?.trim() ?? el.tagName;
        const boxes = items.map(el => {
          const r = el.getBoundingClientRect(), clip = clipOf(el);
          const left = clip ? Math.max(r.left, clip.left) : r.left, right = clip ? Math.min(r.right, clip.right) : r.right;
          return { name: name(el), top: r.top, bottom: r.bottom, left, right };
        }).filter(b => b.right - b.left > 0 && b.bottom - b.top > 0);
        // one row = a single horizontal line crosses every control, whatever their heights
        const rowTop = Math.max(...boxes.map(b => b.top)), rowBottom = Math.min(...boxes.map(b => b.bottom));
        const tallest = Math.max(...boxes.map(b => b.bottom - b.top));
        const overlaps: string[] = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!, b = boxes[j]!;
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push(a.name + ' × ' + b.name);
        }
        const clipped = boxes.filter(b => b.top < hr.top - 0.5 || b.bottom > hr.bottom + 0.5 || b.left < -0.5 || b.right > innerWidth + 0.5).map(b => b.name);
        const mid = h.querySelector<HTMLElement>('.wb-hscroll')!;
        return { count: boxes.length, oneRow: rowTop < rowBottom, headerH: hr.height, tallest, overlaps, clipped, midW: mid.clientWidth, noPageScroll: h.scrollWidth <= h.clientWidth + 1 };
      });
      expect(info.count, 'header has its controls').toBeGreaterThan(6);
      expect(info.oneRow, 'a single horizontal line crosses every control (no wrapped row)').toBe(true);
      expect(info.headerH, 'the header is one control row tall').toBeLessThan(info.tallest * 2);
      expect(info.overlaps, 'no two painted controls overlap').toEqual([]);
      expect(info.clipped, 'no control is clipped by the header or viewport').toEqual([]);
      expect(info.noPageScroll, 'the header itself never overflows').toBe(true);
      // the middle viewport keeps usable room: at least the title and undo/redo fit in it
      expect(info.midW, 'the middle scroll viewport is not starved').toBeGreaterThanOrEqual(160);
      // the scroll viewport wraps only the middle controls; every popover trigger (paradigm
      // switcher, settings) and the right actions live outside any clipping ancestor
      expect(await header.evaluate(h => !!h.querySelector('.wb-hscroll')), 'a dedicated desktop scroll viewport exists').toBe(true);
      expect(await unclipped(page.getByRole('button', { name: 'diagram paradigm' })), 'paradigm switcher has no clipping ancestor').toBe(true);
      expect(await unclipped(page.getByRole('button', { name: 'display settings' })), 'settings trigger has no clipping ancestor').toBe(true);
      expect(await unclipped(page.getByRole('button', { name: 'share', exact: true })), 'share has no clipping ancestor').toBe(true);
      // if the middle row is wider than its viewport, scrolling must bring every control fully
      // into view, where it — not a neighbour — receives the hit at its centre
      const unreachable = await header.evaluate(async h => {
        const bad: string[] = [];
        for (const el of Array.from(h.querySelectorAll<HTMLElement>('button, select, input'))) {
          if (!el.getClientRects().length) continue;
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          await new Promise(r => requestAnimationFrame(() => r(null)));
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!(r.left >= -0.5 && r.right <= innerWidth + 0.5 && hit && (hit === el || el.contains(hit)))) bad.push(el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName);
        }
        h.querySelectorAll<HTMLElement>('.wb-hscroll').forEach(s => { s.scrollLeft = 0; });
        return bad;
      });
      expect(unreachable, 'each control scrolls fully into view and takes the hit').toEqual([]);
    });
  }
}

// Keyboard focus follow-up: tabbing through the middle scroller must auto-scroll focused
// controls fully into view, and the focus outline (2px + 2px offset) of the controls at either
// edge of the scrollport must stay visible, never clipped by the scroller at 1200px.
test('keyboard focus in the header scroller auto-scrolls into view with the outline visible at 1200px', async ({ page }) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1200, height: 900 });
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('data-form', 'desktop');
  // a control's focus outline paints up to 4px past its box; probe checks that expanded box
  // against the scroller's scrollport and against the viewport
  const probe = (): Promise<{ inScroller: boolean; outlineClipped: boolean; inViewport: boolean; atStart: boolean; atEnd: boolean }> => page.evaluate(() => {
    const sc = document.querySelector<HTMLElement>('.wb-hscroll')!;
    const a = document.activeElement as HTMLElement | null;
    if (!a || !sc.contains(a)) return { inScroller: false, outlineClipped: false, inViewport: false, atStart: false, atEnd: false };
    const r = a.getBoundingClientRect(), s = sc.getBoundingClientRect();
    return {
      inScroller: true,
      outlineClipped: r.left - 4 < s.left - 0.5 || r.right + 4 > s.right + 0.5 || r.top - 4 < s.top - 0.5 || r.bottom + 4 > s.bottom + 0.5,
      inViewport: r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight,
      atStart: sc.scrollLeft <= 2,
      atEnd: sc.scrollLeft >= sc.scrollWidth - sc.clientWidth - 2,
    };
  });
  const inScroller = async () => {
    for (let i = 0; i < 25; i++) {
      const p = await probe();
      if (p.inScroller) return p;
      await page.keyboard.press('Tab');
    }
    return probe();
  };
  const first = await inScroller();
  expect(first.inScroller, 'Tab reaches the middle scroller').toBe(true);
  expect(first.outlineClipped, 'first-edge control outline is not clipped at rest').toBe(false);
  expect(first.inViewport, 'first-edge control sits in the viewport').toBe(true);
  // walk to the scroller's last control; the browser must auto-scroll it fully into view
  let last = first;
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const p = await probe();
    if (!p.inScroller) break;
    last = p;
    expect(p.outlineClipped, `control ${i + 1} outline is not clipped`).toBe(false);
    expect(p.inViewport, `control ${i + 1} is fully in the viewport`).toBe(true);
  }
  expect(last.outlineClipped, 'last focused control and its outline stay visible').toBe(false);
  // and back: focus returns over the scrolled-back content with the outline still visible
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Shift+Tab');
    const p = await probe();
    if (!p.inScroller) break;
    last = p;
    expect(p.outlineClipped, `reversed control ${i + 1} outline is not clipped`).toBe(false);
    expect(p.inViewport, `reversed control ${i + 1} is fully in the viewport`).toBe(true);
  }
  expect(last.atStart, 'auto-scroll returns to the start edge').toBe(true);
});

// Both header menus must open outside any scroll clip, be hit-testable everywhere, and take
// real clicks at the narrowest and widest desktop widths.
for (const width of [1200, 1280, 1840]) {
  test(`paradigm menu and display settings open unclipped and take clicks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page);
    const para = page.getByRole('button', { name: 'diagram paradigm' });
    await para.click();
    const menu = page.locator('.tg-pmenu'); await expect(menu).toBeVisible();
    expect(await unclipped(menu), 'paradigm menu has no clipping ancestor').toBe(true);
    expect(await hitTest(menu, '.tg-pitem'), 'paradigm menu is hit-testable and on screen').toEqual({ ok: true, inView: true });
    await menu.locator('.tg-pitem').filter({ hasText: 'sequence' }).first().click();
    await expect(page.locator('.tg-gcanvas')).toHaveAttribute('data-paradigm', 'sequence');
    await expect(menu).toHaveCount(0);
    // and back, via the keyboard-reachable trigger, to prove the menu reopens after a switch
    await para.click(); await expect(menu).toBeVisible();
    await menu.locator('.tg-pitem').filter({ hasText: 'workflow' }).first().click();
    await expect(page.locator('.tg-gcanvas')).toHaveAttribute('data-paradigm', 'workflow');

    const gear = page.getByRole('button', { name: 'display settings' });
    await gear.click();
    const pop = page.locator('.wb-settings'); await expect(pop).toBeVisible();
    expect(await unclipped(pop), 'settings popover has no clipping ancestor').toBe(true);
    expect(await hitTest(pop, '[role="switch"]'), 'settings popover is hit-testable and on screen').toEqual({ ok: true, inView: true });
    const dense = await state<boolean>(page, 'ctl.state.ui.dense');
    await pop.getByRole('switch', { name: 'compact inspector' }).click();
    expect(await state<boolean>(page, 'ctl.state.ui.dense')).toBe(!dense);
    await pop.getByRole('switch', { name: 'compact inspector' }).click();
    expect(await state<boolean>(page, 'ctl.state.ui.dense')).toBe(dense);
    await gear.click(); await expect(pop).toHaveCount(0);
  });
}

for (const width of [1500, 1280, 1024]) {
  test(`preset names are fully readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page);
    const select = page.getByRole('combobox', { name: 'example preset' });
    const ids = await select.evaluate((el: HTMLSelectElement) => Array.from(el.options).map(o => o.value));
    for (const id of ids) {
      await select.selectOption(id);
      const fit = await select.evaluate((el: HTMLSelectElement) => {
        const probe = document.createElement('span'); const cs = getComputedStyle(el);
        probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font};letter-spacing:${cs.letterSpacing}`;
        probe.textContent = el.options[el.selectedIndex]!.text; document.body.appendChild(probe);
        const text = probe.getBoundingClientRect().width; probe.remove();
        const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
        return { text, room: el.getBoundingClientRect().width - pad - 18, name: el.options[el.selectedIndex]!.text, title: el.title };
      });
      expect(fit.room, `${fit.name} needs ${fit.text}px, has ${fit.room}px`).toBeGreaterThanOrEqual(fit.text);
      expect(fit.title).toContain(fit.name);
    }
  });
}

test('display settings never covers an open inspector, in either inspector density', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('ArrowRight');
  const insp = page.locator('.wb-insp'); await expect(insp).toBeVisible();
  await page.getByRole('button', { name: 'display settings' }).click();
  const pop = page.locator('.wb-settings'); await expect(pop).toBeVisible();
  const apart = async () => {
    const a = (await insp.boundingBox())!, b = (await pop.boundingBox())!;
    return a.x >= b.x + b.width || b.x >= a.x + a.width || a.y >= b.y + b.height || b.y >= a.y + a.height;
  };
  expect(await apart()).toBe(true);
  // the popover must be actually hit-testable at several points, not clipped away by a
  // scroll container: elementFromPoint has to land inside it (or in a scrollable part of it)
  const hit = (): Promise<boolean> => pop.evaluate(el => {
    const r = el.getBoundingClientRect();
    const pts: Array<[number, number]> = [[r.left + 10, r.top + 10], [r.left + r.width / 2, r.top + r.height / 2], [r.right - 10, r.bottom - 14]];
    return pts.every(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.wb-settings'));
  });
  expect(await hit(), 'popover is hit-testable with the inspector open').toBe(true);
  await pop.getByRole('switch', { name: 'compact inspector' }).click();
  expect(await state<boolean>(page, 'ctl.state.ui.dense')).toBe(true);
  await expect(pop).toHaveAttribute('data-insp', 'dense');
  expect(await apart()).toBe(true);
  expect(await hit(), 'popover is hit-testable in dense inspector layout').toBe(true);
  // and the popover hangs below the header row, never inside a clipped ancestor
  const hangs = await pop.evaluate(el => {
    const h = el.closest('.wb-header')!.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return b.top >= h.top && b.bottom > h.bottom;
  });
  expect(hangs, 'popover hangs fully below the header').toBe(true);
  await pop.getByRole('switch', { name: 'compact inspector' }).click();
  // with no inspector the popover returns to its anchor under the button
  await page.keyboard.press('Escape'); // closes settings first
  await expect(pop).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(insp).toHaveCount(0);
  await page.getByRole('button', { name: 'display settings' }).click();
  await expect(page.locator('.wb-settings')).toHaveAttribute('data-insp', 'off');
  expect(await hit(), 'popover is hit-testable with no inspector').toBe(true);
});

test('tablet header wraps instead of scrolling, and its controls stay reachable', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('data-form', 'tablet-portrait');
  const info = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('.wb-header button, .wb-header select, .wb-header input')) as HTMLElement[];
    const boxes = items.map(el => { const r = el.getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right, w: r.width, h: r.height }; }).filter(b => b.w > 0 && b.h > 0);
    const rows = new Set(boxes.map(b => Math.round(b.top / 8) * 8));
    return { wrapped: rows.size > 1, reachable: boxes.every(b => b.left >= 0 && b.right <= innerWidth + 1), count: boxes.length };
  });
  expect(info.count, 'tablet header has its controls').toBeGreaterThan(6);
  expect(info.wrapped, 'the tablet header wraps into more than one row').toBe(true);
  expect(info.reachable, 'every tablet control stays inside the viewport').toBe(true);
  const dissolved = await page.locator('.wb-hscroll').evaluate(el => getComputedStyle(el).display);
  expect(dissolved, 'tablet keeps no clipping scroll viewport (display:contents)').toBe('contents');
  // the settings popover still opens fully clickable over the wrapped layout
  await page.getByRole('button', { name: 'display settings' }).click();
  const pop = page.locator('.wb-settings'); await expect(pop).toBeVisible();
  const hit = await pop.evaluate(el => {
    const r = el.getBoundingClientRect();
    const pts: Array<[number, number]> = [[r.left + 10, r.top + 10], [r.left + r.width / 2, r.top + r.height / 2], [r.right - 10, r.bottom - 14]];
    return pts.every(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.wb-settings'));
  });
  expect(hit, 'tablet popover is fully hit-testable').toBe(true);
});

test('replacing an edited document with a preset asks first, and one undo brings the edit back', async ({ page }) => {
  await openApp(page);
  const select = page.getByRole('combobox', { name: 'example preset' });
  const count = () => state<number>(page, 'ctl.state.nodes.length');
  const n = await count();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Delete');
  expect(await count()).toBe(n - 1);
  await select.selectOption('blank');
  const dialog = page.getByRole('alertdialog'); await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Replace Product Analytics with Blank?');
  await dialog.getByRole('button', { name: 'cancel' }).click();
  await expect(dialog).toHaveCount(0); expect(await count()).toBe(n - 1); await expect(select).toHaveValue('analytics');
  await select.selectOption('blank');
  await page.getByRole('alertdialog').getByRole('button', { name: 'replace' }).click();
  await expect(select).toHaveValue('blank'); expect(await count()).toBe(0);
  await page.keyboard.press('Control+z');
  await expect(select).toHaveValue('analytics'); expect(await count()).toBe(n - 1);
  await page.keyboard.press('Shift+Control+z');
  await expect(select).toHaveValue('blank'); expect(await count()).toBe(0);
});

test('a blank document offers its first actions; ? opens keyboard help', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('.wb-empty')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'example preset' }).selectOption('blank');
  const empty = page.getByRole('region', { name: /originate|transformed/ });
  await expect(empty).toBeVisible();
  await expect(empty.getByRole('button', { name: /^\+ add / })).toBeVisible();
  await expect(empty.getByRole('button', { name: /load example/ })).toBeVisible();
  await expect(empty.getByRole('button', { name: 'import json' })).toBeVisible();
  await empty.getByRole('button', { name: /keyboard help/ }).click();
  const help = page.getByRole('dialog', { name: 'Keyboard' }); await expect(help).toBeVisible();
  await expect(help).toContainText('command palette');
  await page.keyboard.press('Escape'); await expect(help).toHaveCount(0);
  await page.keyboard.press('?'); await expect(help).toBeVisible(); await page.keyboard.press('Escape');
  // guidance follows the paradigm
  await page.getByRole('button', { name: 'diagram paradigm' }).click();
  await page.locator('.tg-pmenu .tg-pitem').filter({ hasText: 'sequence' }).first().click();
  await page.getByRole('combobox', { name: 'example preset' }).selectOption('blank');
  await expect(page.locator('.wb-empty')).toContainText(/participant|message/i);
  await page.locator('.wb-empty').getByRole('button', { name: /^\+ add / }).click();
  await expect(page.locator('.tg-gnode')).toHaveCount(1);
  await expect(page.locator('.wb-empty')).toHaveCount(0);
});
