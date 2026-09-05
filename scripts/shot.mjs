import { chromium } from '@playwright/test';
const out = process.argv[2], urls = process.argv.slice(3);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
for (const [i, u] of urls.entries()) { await p.goto(u, { waitUntil: 'networkidle' }); await p.waitForTimeout(400); await p.screenshot({ path: `${out}/shot-${i}.png` }); }
console.log('errors:', errs.length ? errs : 'none'); await b.close();
