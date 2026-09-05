// Share: the button copies a self-contained link, says so, and the link reopens the same document.
import { expect, test } from '@playwright/test';
import { openApp, state } from './helpers';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('share copies a link, confirms with a toast, and the link restores the document', async ({ page }) => {
  await openApp(page);
  const n = await state<number>(page, 'ctl.state.nodes.length');
  await page.getByRole('button', { name: 'share', exact: true }).click();
  const toast = page.locator('.wb-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('link copied');
  await expect(toast).toContainText(String(n));
  expect(page.url()).toContain('#d=');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toBe(page.url());
  await expect(toast).toHaveCount(0, { timeout: 6000 });
  // a fresh visit through the link lands on the same document, flagged as shared
  await page.goto('about:blank'); await page.goto(link);
  await expect(page.locator('.tg-gnode').first()).toBeVisible();
  expect(await state<number>(page, 'ctl.state.nodes.length')).toBe(n);
  expect(await state<string>(page, 'ctl.state.presetId')).toBe('shared');
  await expect(page.getByRole('combobox', { name: 'example preset' })).toHaveValue('shared');
});
