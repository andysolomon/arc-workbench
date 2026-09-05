// Header chrome: the preset select shows whole names — no mid-word clipping at desktop widths.
import { expect, test } from '@playwright/test';
import { openApp, state } from './helpers';

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
  await pop.getByRole('switch', { name: 'compact inspector' }).click();
  expect(await state<boolean>(page, 'ctl.state.ui.dense')).toBe(true);
  await expect(pop).toHaveAttribute('data-insp', 'dense');
  expect(await apart()).toBe(true);
  await pop.getByRole('switch', { name: 'compact inspector' }).click();
  // with no inspector the popover returns to its anchor under the button
  await page.keyboard.press('Escape'); // closes settings first
  await expect(pop).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(insp).toHaveCount(0);
  await page.getByRole('button', { name: 'display settings' }).click();
  await expect(page.locator('.wb-settings')).toHaveAttribute('data-insp', 'off');
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
