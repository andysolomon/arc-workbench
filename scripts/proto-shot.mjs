// screenshots the ORIGINAL prototype (served statically from the export folder) for visual diffs
import { chromium } from '@playwright/test';
const out = process.argv[2] ?? '.', base = process.argv[3] ?? 'http://localhost:4180';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(base + '/Workbench%20v10.dc.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/proto-0.png` });
console.log('nodes', await p.locator('.tg-gnode').count(), 'canvas attrs', await p.locator('.tg-gcanvas').evaluate(e => [...e.attributes].map(a => a.name + '=' + a.value).join(' ')).catch(() => 'none'));
console.log('errors:', errs.length ? errs.slice(0, 5) : 'none'); await b.close();
