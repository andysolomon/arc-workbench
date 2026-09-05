// Documents survive a reload: paradigm, graph, title, load, viewport — and the strip says when
// the latest edit is durable.
import { expect, test } from '@playwright/test';
import { openApp, state, switchParadigm } from './helpers';

test('edits autosave, the strip reports it, and a reload restores the workspace', async ({ page }) => {
  await openApp(page);
  const save = page.locator('.wb-save');
  await expect(save).toHaveAttribute('data-save', 'clean');
  const n = await state<number>(page, 'ctl.state.nodes.length');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Delete');
  await expect(save).toHaveText('saved');
  await page.getByRole('textbox', { name: 'document title' }).fill('Checkout events');
  await expect(save).toHaveText('saved');
  await switchParadigm(page, 'workflow');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Delete');
  await expect(save).toHaveText('saved');
  const wf = await state<number>(page, 'ctl.state.nodes.length');
  await page.reload();
  await expect(page.locator('.tg-gnode').first()).toBeVisible();
  await expect(page.locator('.tg-gcanvas')).toHaveAttribute('data-paradigm', 'workflow');
  expect(await state<number>(page, 'ctl.state.nodes.length')).toBe(wf);
  await expect(save).toHaveText('saved');
  await switchParadigm(page, 'data flow');
  expect(await state<number>(page, 'ctl.state.nodes.length')).toBe(n - 1);
  await expect(page.getByRole('textbox', { name: 'document title' })).toHaveValue('Checkout events');
  // export is a real download of the exchange document
  const dl = page.waitForEvent('download');
  await page.keyboard.press('/'); await page.keyboard.type('export document'); await page.keyboard.press('Enter');
  const file = await dl; expect(file.suggestedFilename()).toBe('checkout-events.workbench.json');
  await expect(page.locator('.wb-toast')).toContainText('exported Checkout events');
});
