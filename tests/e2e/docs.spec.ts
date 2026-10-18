// The System designs page (/docs/): every example has a section, the live Anatomy figure loads
// and runs the Workbench engine inside its frame, #fragment links land, and axe stays clean.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DESIGNS } from '../../src/docs/designs';

const LIVE = DESIGNS.filter((d) => d.figure.status === 'live');

test('every example has a section, and every live figure runs in its frame', async ({ page }) => {
  await page.goto('/docs/');
  await expect(page.locator('.wb-doc-section')).toHaveCount(DESIGNS.length);
  await expect(page.locator('.wb-doc-toc a[data-status="live"]')).toHaveText(LIVE.map((d) => d.title));
  for (const d of LIVE) {
    await page.locator(`#${d.id} iframe`).scrollIntoViewIfNeeded();
    const figure = page.frameLocator(`#${d.id} iframe`);
    await expect(figure.locator('.bx-stage'), d.id).toHaveAttribute('tabindex', '0');
    await expect(figure.locator('[data-readout]'), d.id).not.toHaveText('');
  }
});

test('a #fragment lands on its section once the page has mounted', async ({ page }) => {
  await page.goto('/docs/#agentrun');
  await expect(page.locator('#agentrun')).toBeInViewport();
});

test('axe: the docs page in both themes', async ({ page }) => {
  await page.goto('/docs/');
  await expect(page.locator('.wb-doc-section')).toHaveCount(12);
  for (const theme of ['dark', 'light']) {
    const r = await new AxeBuilder({ page }).disableRules(['color-contrast']).exclude('iframe').analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${theme}: ${v.id} — ${v.help}`), theme).toEqual([]);
    await page.getByRole('button', { name: /switch to (light|dark) mode/ }).click();
  }
});
