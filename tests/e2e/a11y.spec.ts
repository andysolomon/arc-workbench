// Accessibility gate (ARC-166): axe on every lens and dialog, and the keyboard-only editing path
// documented in README § Keyboard. Runs in CI (pr.yml · merge.yml).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openApp, setMode, state } from './helpers';

// colour contrast is the design system's contract (ds/typegram tokens), audited there, not here
const scan = async (page: Page, what: string) => {
  const r = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  const bad = r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map(v => `${what}: ${v.id} — ${v.help} (${v.nodes.length})\n  ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join('\n  ')}`), what).toEqual([]);
};

test('axe: design (inspector open) · simulate · analyze · palette · settings · dialogs', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('ArrowRight'); await expect(page.locator('.wb-insp')).toBeVisible();
  await scan(page, 'design + inspector');
  await page.getByRole('button', { name: 'display settings' }).click(); await scan(page, 'settings'); await page.keyboard.press('Escape');
  await setMode(page, 'simulate'); await page.waitForTimeout(600); await scan(page, 'simulate');
  await setMode(page, 'analyze'); await expect(page.locator('.wb-frow').first()).toBeVisible(); await scan(page, 'analyze');
  await page.keyboard.press('/'); await expect(page.getByRole('listbox')).toBeVisible(); await scan(page, 'palette'); await page.keyboard.press('Escape');
  await page.keyboard.press('?'); await expect(page.getByRole('dialog', { name: 'Keyboard' })).toBeVisible(); await scan(page, 'help'); await page.keyboard.press('Escape');
  await page.keyboard.press('n'); await expect(page.getByRole('dialog', { name: 'Create diagram' })).toBeVisible(); await scan(page, 'create'); await page.keyboard.press('Escape');
});

test('landmarks, headings and control states describe the shell', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Workbench' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'component library' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveAttribute('aria-label', /Product Analytics · data flow · design/);
  await expect(page.getByRole('region', { name: 'status' })).toBeVisible();
  await expect(page.getByRole('application')).toHaveAttribute('aria-label', /arrow keys select/);
  const lens = page.getByRole('radiogroup', { name: 'lens' });
  await expect(lens.getByRole('radio', { name: 'design' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'labels' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'display settings' }).click();
  const sw = page.getByRole('switch', { name: 'edge labels' }); await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click(); await expect(sw).toHaveAttribute('aria-checked', 'false'); await sw.click();
  await page.keyboard.press('Escape');
  await setMode(page, 'simulate');
  const slider = page.getByRole('slider'); const vt = await slider.getAttribute('aria-valuetext');
  expect(vt).toMatch(/^[\d.]+k? \/s$/); expect(vt).not.toBe(await slider.getAttribute('aria-valuenow'));
  await expect(page.getByRole('button', { name: 'run or pause' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('/'); await page.keyboard.type('fit');
  const opt = page.getByRole('option', { name: /fit canvas/ }); await expect(opt).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('combobox', { name: 'command' })).toHaveAttribute('aria-activedescendant', /wb-pi-0/);
  await page.keyboard.press('Escape');
});

test('keyboard-only path: reach · select · move · connect · inspect · rewire · delete', async ({ page }) => {
  await openApp(page);
  // reach the canvas by Tab from the document title, then select with the arrows
  await page.getByRole('textbox', { name: 'document title' }).focus();
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement).className)).toContain('tg-btn'); // undo
  await page.getByRole('application').focus();
  await page.keyboard.press('ArrowRight');
  const sel = page.locator('.tg-gnode[aria-pressed="true"]'); await expect(sel).toHaveCount(1);
  await expect(sel).toBeFocused(); // roving focus follows the selection
  const before = await state<{ x: number; y: number }>(page, '({ x: ctl.nById[ctl.state.sel.id].x, y: ctl.nById[ctl.state.sel.id].y })');
  await page.keyboard.press('Shift+ArrowRight');
  expect(await state<number>(page, 'ctl.nById[ctl.state.sel.id].x')).toBe(before.x + 16);
  // connect: c, pick a target with the arrows, Enter
  const e0 = await state<number>(page, 'ctl.state.edges.length');
  await page.keyboard.press('c'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  expect(await state<number>(page, 'ctl.state.edges.length')).toBe(e0 + 1);
  await expect(page.locator('.wb-sr-only').last()).toContainText('connected');
  // inspect: Enter moves focus into the inspector; the relationship rows reach the edge; its ends are labelled selects
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'inspector' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.wb-insp') !== null)).toBe(true);
  await page.getByRole('button', { name: /^select (outgoing|incoming)/ }).first().focus(); await page.keyboard.press('Enter');
  expect(await state<string>(page, 'ctl.state.sel.kind')).toBe('edge');
  const to = page.getByRole('combobox', { name: 'to' }); await expect(to).toBeVisible();
  const other = await to.evaluate((el: HTMLSelectElement) => Array.from(el.options).find(o => o.value !== el.value)!.value);
  await to.selectOption(other); expect(await state<string>(page, 'ctl.state.edges.find(e => e.id === ctl.state.sel.id).to')).toBe(other);
  // delete from the keyboard, announced
  await page.getByRole('application').focus(); await page.keyboard.press('Delete');
  expect(await state<number>(page, 'ctl.state.edges.length')).toBe(e0);
  await expect(page.locator('.wb-sr-only').last()).toContainText('deleted');
  // dialogs return focus to where they were opened from
  await page.getByRole('button', { name: 'display settings' }).focus(); await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard' })).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'display settings' })).toBeFocused();
});
