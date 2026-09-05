// The design-system boundary (ARC-167): @typegram/graph is the canonical source; Workbench only
// consumes it. These pin what `pnpm lint` enforces and what the docs promise.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PKG = 'packages/typegram';
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8')) as { name: string; version: string; exports: Record<string, string> };
const allowed = (rel: string): boolean => Object.keys(pkg.exports).some(k => new RegExp('^' + k.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+') + '$').test('./' + rel));

describe('@typegram/graph is the source of truth', () => {
  it('is a versioned package whose exports cover every stylesheet it ships', () => {
    expect(pkg.name).toBe('@typegram/graph'); expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    const css = walk(PKG).filter(f => f.endsWith('.css')).map(f => f.slice(PKG.length + 1));
    expect(css.length).toBeGreaterThan(10);
    for (const f of css) expect(allowed(f), f).toBe(true);
    expect(allowed('docs/graph-paradigm.md')).toBe(false); // docs are not a code entry point
    expect(existsSync(join(PKG, 'CHANGELOG.md'))).toBe(true);
    expect(readFileSync(join(PKG, 'CHANGELOG.md'), 'utf8')).toMatch(/Migration/);
  });
  it('the app imports the package by name and keeps only chrome in its own stylesheet', () => {
    const theme = readFileSync('src/theme/index.css', 'utf8');
    for (const m of theme.matchAll(/@import\s+'([^']+)'/g)) expect(m[1]!.startsWith('@typegram/graph/') || m[1] === './workbench.css', m[1]).toBe(true);
    expect(theme).toContain('@typegram/graph/components/graph/telemetry.css');
    const app = readFileSync('src/theme/workbench.css', 'utf8');
    expect(app).not.toMatch(/^\s*\.tg-(gnode|gcanvas|port|edge|region|packets|spark|hdot|erate|chan|ann|hl)\b/m);
    expect(app).not.toMatch(/rgba?\(|#[0-9a-f]{6}/i);
    for (const m of app.matchAll(/(--[a-z0-9-]+)\s*:/g)) expect(m[1]!.startsWith('--wb-') || m[1]!.startsWith('--edge-channel-gap') || m[1] === '--port-hit', m[1]).toBe(true);
  });
  it('the graph layer that used to live in the app is in the package under stable tg- names', () => {
    const tel = readFileSync(join(PKG, 'components/graph/telemetry.css'), 'utf8');
    for (const c of ['.tg-packets', '.tg-hl', '.tg-spark', '.tg-hdot', '.tg-erate', '.tg-elayer', '.tg-chan', '.tg-ann', '@keyframes tg-flow', '[data-zoom="overview"]', '[data-health="crit"]', '.tg-edge-label[data-role="guard"]']) expect(tel, c).toContain(c);
    expect(readFileSync(join(PKG, 'tokens/base.css'), 'utf8')).toContain('--scrim:');
    // the renderer emits the package's class names, not app-local ones
    const render = walk('src/render').concat(walk('src/telemetry')).map(f => readFileSync(f, 'utf8')).join('\n');
    expect(render).not.toMatch(/['"`]wb-(packets|hl|spark|hdot|erate|elayer|chan|ann)\b/);
    for (const c of ['tg-packets', 'tg-spark', 'tg-hdot', 'tg-erate', 'tg-elayer', 'tg-ann', 'tg-hl']) expect(render, c).toContain(c);
  });
  it('documents the Graph Paradigm with a live specimen for every paradigm × lens, built from package CSS only', () => {
    const doc = readFileSync(join(PKG, 'docs/graph-paradigm.md'), 'utf8');
    for (const w of ['architecture', 'workflow', 'sequence', 'data flow', 'state machine', 'design', 'simulate', 'analyze', 'DOM contract']) expect(doc).toContain(w);
    const dir = join(PKG, 'docs/specimens');
    for (const pid of ['architecture', 'workflow', 'sequence', 'dataflow', 'state']) for (const lens of ['design', 'simulate', 'analyze']) {
      const html = readFileSync(join(dir, `${pid}-${lens}.html`), 'utf8');
      expect(existsSync(join(dir, `${pid}-${lens}.png`)), pid + lens).toBe(true);
      expect(html).toContain('class="tg-gcanvas"'); expect(html).toContain(`data-mode="${lens}"`); expect(html).toContain(`data-paradigm="${pid}"`);
      for (const m of html.matchAll(/href="\.\.\/\.\.\/([^"]+)"/g)) { expect(allowed(m[1]!), m[1]).toBe(true); expect(existsSync(join(PKG, m[1]!)), m[1]).toBe(true); }
      expect(html).not.toMatch(/<script/);
      if (lens !== 'design') expect(html).toContain('tg-gnode-tel');
      if (lens === 'analyze') expect(html).toContain('tg-ann');
    }
    expect(existsSync(join(dir, 'index.html'))).toBe(true);
  });
});
