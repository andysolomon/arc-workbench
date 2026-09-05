// Acceptance: all five paradigms load their first example, lay out, simulate, analyze and trace;
// switching parks the current document and restores it.
import { expect, test } from '@playwright/test';
import { openApp, paradigm, setMode, state, switchParadigm } from './helpers';

const FIVE: Array<[string, string, number]> = [['architecture', 'architecture', 12], ['workflow', 'workflow', 11], ['sequence', 'sequence', 7], ['data flow', 'dataflow', 11], ['state machine', 'state', 11]];

test.beforeEach(async ({ page }) => { await openApp(page); });

for (const [label, pid, nodes] of FIVE) {
  test(`${pid}: loads, lays out, simulates, analyzes, traces`, async ({ page }) => {
    if (pid !== 'dataflow') await switchParadigm(page, label);
    expect(await paradigm(page)).toBe(pid);
    await expect(page.locator('.tg-gnode')).toHaveCount(nodes);
    await expect(page.locator('g.tg-edge-g')).toHaveCount(await state<number>(page, 'ctl.state.edges.length'));
    await page.keyboard.press('l'); await page.waitForTimeout(300);
    expect(await state<boolean>(page, 'ctl.state.nodes.every(n => n.x % 16 === 0 && n.y % 16 === 0)')).toBe(true);
    await setMode(page, 'simulate');
    await expect(page.locator('.tg-gnode-tel').first()).toBeVisible({ timeout: 3000 });
    await expect.poll(() => page.locator('[data-t="rate"]').first().textContent(), { timeout: 3000 }).not.toBe('');
    // a value once the window is warm; until then the HUD says so instead of printing a number
    await expect.poll(async () => { const el = page.locator('.wb-hud [data-t="p99"]'); return (await el.textContent()) !== '—' || /warming up/.test((await el.getAttribute('title')) || ''); }).toBe(true);
    await page.keyboard.press('t');
    await expect(page.locator('.tg-gcanvas')).toHaveAttribute('data-layer-trace', 'on');
    if (pid === 'workflow' || pid === 'state' || pid === 'sequence') await expect(page.locator('[data-run="active"]').first()).toBeAttached({ timeout: 4000 });
    await setMode(page, 'analyze');
    await expect(page.getByText('findings', { exact: true })).toBeVisible();
    await expect(page.locator('.wb-frow').first()).toBeVisible({ timeout: 3000 });
    await page.locator('.wb-frow').first().click();
    await expect(page.locator('.wb-frow[data-on="1"]')).toHaveCount(1);
    await setMode(page, 'design');
    await expect(page.locator('.tg-gnode-tel')).toHaveCount(0);
    await expect(page.locator('.tg-gnode[data-health="warn"], .tg-gnode[data-health="crit"]')).toHaveCount(0);
  });
}

test('switching paradigm parks the document and restores it, edits and history included', async ({ page }) => {
  const n = await page.locator('.tg-gnode').count();
  await page.locator('.tg-gnode').first().click(); await page.keyboard.press('Delete');
  await expect(page.locator('.tg-gnode')).toHaveCount(n - 1);
  await switchParadigm(page, 'workflow');
  await expect(page.locator('.tg-region[data-variant="lane"]')).toHaveCount(4);
  await switchParadigm(page, 'state');
  await switchParadigm(page, 'data flow');
  await expect(page.locator('.tg-gnode')).toHaveCount(n - 1);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.tg-gnode')).toHaveCount(n);
  // the menu reports the parked documents' sizes
  await page.getByRole('button', { name: 'diagram paradigm' }).click();
  await expect(page.locator('.tg-pmenu .tg-pitem').filter({ hasText: 'workflow' })).toContainText('11 steps');
  await expect(page.locator('.tg-pmenu .tg-pitem').filter({ hasText: 'sequence' })).toContainText('empty');
});

test('library adds a node of the paradigm type with the family colour channel', async ({ page }) => {
  const n = await page.locator('.tg-gnode').count();
  await page.getByRole('button', { name: /ƒ transform/ }).click();
  await expect(page.locator('.tg-gnode')).toHaveCount(n + 1);
  const el = page.locator('.tg-gnode[data-kind="transform"]');
  await expect(el).toHaveAttribute('data-family', 'cyan');
  await expect(el).toHaveAttribute('data-form', 'process');
  await expect(el).toHaveAttribute('data-state', 'selected');
  await expect(page.locator('.wb-insp')).toContainText('ƒ processor');
});

test('switching paradigm while simulating pauses the run and confirms it', async ({ page }) => {
  await setMode(page, 'simulate');
  await expect(page.getByRole('button', { name: 'run or pause' })).toHaveText('❙❙');
  await switchParadigm(page, 'workflow');
  await expect(page.getByRole('button', { name: 'run or pause' })).toHaveText('▶');
  await expect(page.locator('.wb-toast')).toContainText('simulation paused');
  const up = await state<number>(page, 'ctl.uptimeS');
  await page.waitForTimeout(700);
  expect(await state<number>(page, 'ctl.uptimeS')).toBe(up);
  await page.keyboard.press('r');
  await expect(page.getByRole('button', { name: 'run or pause' })).toHaveText('❙❙');
});

test('analyze says whether findings are live or frozen, and over which window', async ({ page }) => {
  await setMode(page, 'simulate'); await page.waitForTimeout(1300);
  await setMode(page, 'analyze');
  const prov = page.locator('.wb-prov');
  await expect(prov).toHaveAttribute('data-live', '1');
  await expect(prov).toContainText('live');
  await expect(prov).toContainText(/instant|completions|timeline|warming/);
  await page.keyboard.press('r');
  await expect(prov).toHaveAttribute('data-live', '0');
  await expect(prov).toContainText('frozen');
  // evidence chips point at the numbers a finding rests on
  await expect(page.locator('.wb-ev').first()).toBeVisible();
});
