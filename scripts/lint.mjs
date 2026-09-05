// Acceptance greps from the brief (§8), run as part of `pnpm lint`:
//  - no hex colour literals under src/ (every colour is a var(--*) token)
//  - the legacy triad aliases never appear in src/model or src/store
//  - no `any`, `@ts-expect-error`, `@ts-ignore` or disabled lint rule without a one-line justification
//  - no TODO comments (open issues go in PORT-NOTES.md)
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
if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log('lint: ok');
