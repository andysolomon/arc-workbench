// Every shortcut in the brief's keyboard map has an assertion here (§4 · Behaviour).
import { expect, test } from '@playwright/test';
import { nodeBox, openApp, setMode, state, switchParadigm } from './helpers';

test.beforeEach(async ({ page }) => { await openApp(page); });

test('/ and ctrl+k open the palette; Escape closes it', async ({ page }) => {
  await page.keyboard.press('/');
  await expect(page.locator('input[aria-label="command"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('input[aria-label="command"]')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(page.locator('input[aria-label="command"]')).toBeVisible();
  await page.keyboard.type('auto layout');
  await expect(page.locator('text=auto layout').first()).toBeVisible();
  await page.keyboard.press('Escape');
});

test('ctrl+z undoes a drag and shift+ctrl+z redoes it', async ({ page }) => {
  const b = await nodeBox(page);
  await page.mouse.move(b.x + 40, b.y + 10); await page.mouse.down(); await page.mouse.move(b.x + 160, b.y + 10, { steps: 8 }); await page.mouse.up();
  const moved = await nodeBox(page); expect(Math.round(moved.x - b.x)).toBe(120);
  await page.keyboard.press('Control+z');
  expect(Math.round((await nodeBox(page)).x - b.x)).toBe(0);
  await page.keyboard.press('Shift+Control+z');
  expect(Math.round((await nodeBox(page)).x - b.x)).toBe(120);
});

test('f fits, l lays out, arrows step the selection in reading order, Delete removes it', async ({ page }) => {
  await page.locator('.tg-zoom-label').click(); // reset to 100%
  await expect(page.locator('.tg-zoom-label')).toHaveText('100%');
  await page.keyboard.press('f');
  await expect(page.locator('.tg-zoom-label')).not.toHaveText('100%');
  const before = await state<Array<{ id: string; x: number; y: number }>>(page, 'ctl.state.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }))');
  await page.keyboard.press('l'); await page.waitForTimeout(300);
  const after = await state<Array<{ id: string; x: number; y: number }>>(page, 'ctl.state.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }))');
  expect(after.some((n, i) => n.x !== before[i]!.x || n.y !== before[i]!.y)).toBe(true);
  expect(after.every(n => n.x % 16 === 0 && n.y % 16 === 0)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.wb-insp')).toBeVisible();
  const first = await state<string>(page, 'ctl.state.sel.id');
  const leftmost = [...after].sort((a, b) => a.x - b.x || a.y - b.y)[0]!.id;
  expect(first).toBe(leftmost);
  await page.keyboard.press('ArrowRight');
  expect(await state<string>(page, 'ctl.state.sel.id')).not.toBe(first);
  await page.keyboard.press('ArrowLeft');
  expect(await state<string>(page, 'ctl.state.sel.id')).toBe(first);
  const n = await page.locator('.tg-gnode').count();
  await page.keyboard.press('Delete');
  await expect(page.locator('.tg-gnode')).toHaveCount(n - 1);
  await expect(page.locator('.wb-insp')).toHaveCount(0);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Backspace');
  await expect(page.locator('.tg-gnode')).toHaveCount(n - 2);
});

test('t toggles the trace layer (simulate only), r pauses and resumes, d flips the theme', async ({ page }) => {
  await setMode(page, 'simulate');
  await expect(page.locator('.tg-gcanvas')).toHaveAttribute('data-layer-trace', 'off');
  await page.keyboard.press('t');
  await expect(page.locator('.tg-gcanvas')).toHaveAttribute('data-layer-trace', 'on');
  await setMode(page, 'design');
  await expect(page.locator('.tg-gcanvas')).toHaveAttribute('data-layer-trace', 'off');
  await setMode(page, 'simulate');
  await page.keyboard.press('t');
  await expect(page.locator('.tg-gcanvas')).toHaveAttribute('data-layer-trace', 'off');
  await expect(page.getByRole('button', { name: 'run or pause' })).toHaveClass(/tg-btn--active/);
  await page.keyboard.press('r');
  await expect(page.getByRole('button', { name: 'run or pause' })).not.toHaveClass(/tg-btn--active/);
  await page.keyboard.press('r');
  await expect(page.getByRole('button', { name: 'run or pause' })).toHaveClass(/tg-btn--active/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('d');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('d');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('n opens create diagram; Escape unwinds palette → dialog → switcher → card → selection', async ({ page }) => {
  await page.keyboard.press('n');
  await expect(page.getByText('Create diagram')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Create diagram')).toHaveCount(0);
  await page.locator('.tg-gnode').first().click();
  await expect(page.locator('.wb-insp')).toBeVisible();
  await page.keyboard.press('n'); await page.keyboard.press('/');
  await page.keyboard.press('Escape'); // palette first
  await expect(page.locator('input[aria-label="command"]')).toHaveCount(0);
  await expect(page.getByText('Create diagram')).toBeVisible();
  await page.keyboard.press('Escape'); // then the dialog
  await expect(page.getByText('Create diagram')).toHaveCount(0);
  await expect(page.locator('.wb-insp')).toBeVisible(); // selection survived both
  await page.getByRole('button', { name: 'diagram paradigm' }).click();
  await expect(page.locator('.tg-pmenu')).toBeVisible();
  await page.keyboard.press('Escape'); // then the switcher
  await expect(page.locator('.tg-pmenu')).toHaveCount(0);
  await page.keyboard.press('Escape'); // finally the selection
  await expect(page.locator('.wb-insp')).toHaveCount(0);
});

test('in a sequence, ↑↓ step messages in time order', async ({ page }) => {
  await switchParadigm(page, 'sequence');
  await page.keyboard.press('ArrowDown');
  expect(await state<{ kind: string; id: string }>(page, 'ctl.state.sel')).toEqual({ kind: 'edge', id: 'user>web#1' });
  await page.keyboard.press('ArrowDown');
  expect(await state<string>(page, 'ctl.state.sel.id')).toBe('web>api#2');
  await expect(page.locator('.tg-edge[data-state="selected"]')).toHaveCount(1);
  await page.keyboard.press('ArrowUp');
  expect(await state<string>(page, 'ctl.state.sel.id')).toBe('user>web#1');
});

test('Escape during a drag drops it without committing', async ({ page }) => {
  const b = await nodeBox(page);
  await page.mouse.move(b.x + 40, b.y + 10); await page.mouse.down(); await page.mouse.move(b.x + 160, b.y + 10, { steps: 6 });
  await expect(page.locator('.tg-gnode[data-state="dragging"]')).toHaveCount(1);
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.locator('.tg-gnode[data-state="dragging"]')).toHaveCount(0);
  expect(Math.round((await nodeBox(page)).x - b.x)).toBe(0);
});
