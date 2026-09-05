import { readFileSync } from 'node:fs';
import { expect } from 'vitest';
import type { GraphNode } from '../../src/model';

export const load = <T = unknown>(name: string): T => JSON.parse(readFileSync(new URL(`./data/${name}.json`, import.meta.url), 'utf8')) as T;

/** the generator's PRNG — the port must consume randomness in the same order */
export const mulberry32 = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export function seeded<T>(seed: number, fn: () => T): T {
  const realRandom = Math.random, realNow = Date.now;
  Math.random = mulberry32(seed); let t = 1_700_000_000_000; Date.now = () => (t += 250);
  try { return fn(); } finally { Math.random = realRandom; Date.now = realNow; }
}
export const hOf = (nodes: GraphNode[]): Record<string, number> => { const h: Record<string, number> = {}; nodes.forEach((n, i) => h[n.id] = 88 + (i % 3) * 16); return h; };

/** deep equality with 1e-6 tolerance on numbers and exact match on everything else */
export function expectClose(actual: unknown, expected: unknown, path = '$'): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (Math.abs(actual - expected) > 1e-6) throw new Error(`${path}: ${actual} ≠ ${expected}`);
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) throw new Error(`${path}: expected array`);
    if (actual.length !== expected.length) throw new Error(`${path}: length ${actual.length} ≠ ${expected.length}`);
    expected.forEach((v, i) => expectClose(actual[i], v, `${path}[${i}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') throw new Error(`${path}: expected object, got ${String(actual)}`);
    const a = actual as Record<string, unknown>, e = expected as Record<string, unknown>;
    const ak = Object.keys(a).filter(k => a[k] !== undefined).sort(), ek = Object.keys(e).sort();
    if (ak.join() !== ek.join()) throw new Error(`${path}: keys ${ak.join(',')} ≠ ${ek.join(',')}`);
    for (const k of ek) expectClose(a[k], e[k], `${path}.${k}`);
    return;
  }
  expect(actual, path).toBe(expected);
}
