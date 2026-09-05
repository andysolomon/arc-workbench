// Header chrome: the preset select shows whole names — no mid-word clipping at desktop widths.
import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

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
