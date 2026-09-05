// Acceptance greps from the brief (§8), run as part of `pnpm lint`:
//  - no hex colour literals under src/ (every colour is a var(--*) token)
//  - the legacy triad aliases never appear in src/model or src/store
//  - no `any`, `@ts-expect-error`, `@ts-ignore` or disabled lint rule without a one-line justification
//  - no TODO comments (open issues go in PORT-NOTES.md)
//  - design-system boundary (ARC-167): package consumed by name and through `exports` only, no copied
//    token values, no graph-primitive rules or raw colours in app css, every package css exported
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|css)$/.test(f) ? [p] : []; });
const fails = [];
for (const f of walk('src')) {
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    const at = `${f}:${i + 1}`;
    if (/#[0-9a-fA-F]{6}\b/.test(line) && f !== 'src/theme/tokens.ts') fails.push(`${at}: hex colour literal`);
    if (/\bTODO\b/.test(line)) fails.push(`${at}: TODO comment (open an issue in PORT-NOTES.md)`);
    if (/@ts-(expect-error|ignore|nocheck)/.test(line) && !/--\s*\S/.test(line)) fails.push(`${at}: ts directive without justification`);
    if (/eslint-disable/.test(line) && !/--\s*\S/.test(line)) fails.push(`${at}: disabled lint rule without justification`);
    if (/\bas any\b|:\s*any\b|<any>/.test(line)) fails.push(`${at}: any`);
  });
  if ((f.startsWith('src/model') || f.startsWith('src/store')) && /'(service|queue|agent|tool|database|external)'/.test(src)) fails.push(`${f}: legacy triad alias in model/store`);
}
// ---- source-of-truth boundary (ARC-167): the design system is consumed, never copied ----
const pkgDir = 'packages/typegram';
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const exportPatterns = Object.keys(pkg.exports).filter(k => k !== './package.json').map(k => new RegExp('^' + k.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+') + '$'));
const allowed = spec => exportPatterns.some(re => re.test('./' + spec));
// every css file the package ships must be reachable through `exports` (a file nobody can import is drift)
for (const f of walk(pkgDir).filter(f => f.endsWith('.css'))) { const rel = f.slice(pkgDir.length + 1); if (!allowed(rel)) fails.push(`${f}: not covered by package exports`); }
// package token values, to catch copies in the app
const tokenValues = new Map();
for (const f of walk(join(pkgDir, 'tokens'))) for (const m of readFileSync(f, 'utf8').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/g)) tokenValues.set(m[2].trim(), m[1]);
for (const f of walk('src')) {
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    const at = `${f}:${i + 1}`;
    // consume the package by name; no relative reach into it, no deep import outside `exports`
    for (const m of line.matchAll(/@import\s+['"]([^'"]+)['"]|from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1] ?? m[2];
      if (/(^|\/)(ds|packages)\/typegram/.test(spec)) fails.push(`${at}: relative import of the design system — use @typegram/graph`);
      if (spec.startsWith('@typegram/graph/') && !allowed(spec.slice('@typegram/graph/'.length))) fails.push(`${at}: deep import outside @typegram/graph exports (${spec})`);
    }
    if (!f.endsWith('.css')) return;
    // custom properties defined in the app must stay in the app namespace and must not copy a token value
    for (const m of line.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/g)) {
      const [, name, raw] = m, value = raw.trim();
      if (!name.startsWith('--wb-') && !name.startsWith('--edge-channel-gap') && name !== '--port-hit') fails.push(`${at}: custom property ${name} defined in the app — graph tokens belong in @typegram/graph`);
      if (tokenValues.has(value)) fails.push(`${at}: ${name} copies the value of package token ${tokenValues.get(value)}`);
    }
    if (/rgba?\(|hsla?\(/.test(line) && !/var\(--/.test(line)) fails.push(`${at}: raw colour literal — use a package token`);
    // graph primitives are styled by the package: app css may not restyle them
    if (/^\s*\.tg-(gnode|gcanvas|port|edge|region|lifeline|activation|seq-|packets|spark|hdot|erate|chan|ann|hl)\b/.test(line)) fails.push(`${at}: styles a graph primitive — this rule belongs in @typegram/graph`);
  });
}
if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log('lint: ok · boundary: ok');
