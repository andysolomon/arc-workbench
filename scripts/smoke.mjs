// interactive smoke: drives the built app through the main paths and screenshots each state
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? '.';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
try {
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
const shot = async n => p.screenshot({ path: `${out}/smoke-${n}.png` });
await p.getByRole('button', { name: 'simulate', exact: true }).click(); await p.waitForTimeout(1600); await shot('sim');
console.log('tel nodes', await p.locator('.tg-gnode-tel').count(), 'rate sample', await p.locator('[data-t="rate"]').first().textContent(), 'hud p99', await p.locator('.wb-hud [data-t="p99"]').textContent(), 'packets', await p.locator('.tg-packets').count());
await p.locator('.tg-gnode[data-kind="stream"]').click(); await p.waitForTimeout(300); await shot('insp');
console.log('inspector', await p.locator('.wb-insp').count(), 'metrics grid', await p.locator('[data-mgrid]').count(), 'selected', await p.locator('.tg-gnode[data-state="selected"]').count());
await p.getByRole('button', { name: 'analyze', exact: true }).click(); await p.waitForTimeout(600); await shot('analyze');
console.log('findings', await p.locator('.wb-frow').count(), 'ann', await p.locator('.tg-ann').count());
await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
// edge hover → card
const edge = p.locator('g.tg-edge-g').nth(4); const bb = await edge.locator('.tg-edge-hit').boundingBox();
if (bb) { await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(250); console.log('card', await p.locator('[data-chrome] >> text=○—○').count(), 'ends', await p.locator('circle[data-t="endf"]').count()); await shot('card'); }
// paradigm switch via switcher + keyboard
await p.getByRole('button', { name: 'diagram paradigm' }).click(); await p.getByRole('button', { name: /^workflow/ }).click(); await p.waitForTimeout(700); await shot('workflow');
console.log('paradigm', await p.locator('.tg-gcanvas').getAttribute('data-paradigm'), 'lanes', await p.locator('.tg-region[data-variant="lane"]').count(), 'mode', await p.locator('.tg-gcanvas').getAttribute('data-mode'));
await p.getByRole('button', { name: 'simulate', exact: true }).click(); await p.keyboard.press('t'); await p.waitForTimeout(1200); console.log('trace attr', await p.locator('.tg-gcanvas').getAttribute('data-layer-trace'), 'run active', await p.locator('[data-run="active"]').count()); await shot('trace');
await p.keyboard.press('/'); await p.waitForTimeout(200); console.log('palette', await p.locator('input[aria-label="command"]').count()); await p.keyboard.type('sequence'); await p.keyboard.press('Enter'); await p.waitForTimeout(800); await p.keyboard.press('Escape');
console.log('paradigm after palette', await p.locator('.tg-gcanvas').getAttribute('data-paradigm'), 'lifelines', await p.locator('.tg-lifeline').count());
await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); console.log('seq sel', await p.locator('.tg-edge[data-state="selected"]').count()); await shot('sequence');
await p.getByRole('button', { name: 'diagram paradigm' }).click(); await p.getByRole('button', { name: /^data flow/ }).click(); await p.waitForTimeout(600);
console.log('restored dataflow nodes', await p.locator('.tg-gnode').count(), 'paradigm', await p.locator('.tg-gcanvas').getAttribute('data-paradigm'));
await p.keyboard.press('d'); await p.waitForTimeout(200); console.log('theme', await p.locator('html').getAttribute('data-theme')); await shot('light');
await p.getByRole('button', { name: 'design', exact: true }).click(); await p.waitForTimeout(300); console.log('design health leftovers', await p.locator('.tg-gnode[data-health="warn"],.tg-gnode[data-health="crit"]').count(), 'tel', await p.locator('.tg-gnode-tel').count());
// drag a node
const n0 = p.locator('.tg-gnode').first(); const nb = await n0.boundingBox();
if (nb) { await p.mouse.move(nb.x + 30, nb.y + 10); await p.mouse.down(); await p.mouse.move(nb.x + 130, nb.y + 60, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300); const nb2 = await n0.boundingBox(); console.log('dragged dx', Math.round((nb2?.x ?? 0) - nb.x)); }
await p.keyboard.press('Meta+z'); await p.waitForTimeout(200); const nb3 = await n0.boundingBox(); console.log('undo dx', Math.round((nb3?.x ?? 0) - (nb?.x ?? 0)));
} catch (e) { console.log('FAILED', String(e).split('\n')[0]); await p.screenshot({ path: `${out}/smoke-fail.png` }); console.log(await p.evaluate(() => document.querySelectorAll('[style*="position: fixed"]').length + ' fixed overlays; palette=' + !!document.querySelector('input[aria-label="command"]'))); }
console.log('errors:', errs.length ? errs : 'none'); await b.close();
