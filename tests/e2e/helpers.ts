import { expect, type Page } from '@playwright/test';

export async function openApp(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(page.locator('.tg-gnode').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300); // the fit latch settles once every node has a measured height
}
/** read a slice of controller state from inside the page */
export const state = <T>(page: Page, expr: string): Promise<T> => page.evaluate(e => (new Function('ctl', 'return ' + e))(window.__workbench.ctl) as T, expr);
export const paradigm = (page: Page): Promise<string | null> => page.locator('.tg-gcanvas').getAttribute('data-paradigm');
export async function setMode(page: Page, mode: 'design' | 'simulate' | 'analyze'): Promise<void> { await page.getByRole('radio', { name: mode, exact: true }).click(); }
export async function switchParadigm(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: 'diagram paradigm' }).click();
  await page.locator('.tg-pmenu .tg-pitem').filter({ hasText: label }).first().click();
  await expect(page.locator('.tg-gcanvas')).toHaveAttribute('data-paradigm', label === 'data flow' ? 'dataflow' : label === 'state machine' ? 'state' : label);
  await page.waitForTimeout(400);
}
export const nodeBox = async (page: Page, i = 0) => (await page.locator('.tg-gnode').nth(i).boundingBox())!;
