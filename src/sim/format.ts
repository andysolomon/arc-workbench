// Number formatting shared by the HUD, node telemetry, inspector and findings. Verbatim.
import type { SysStat } from './types';

export function fmt(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 10000) return (v / 1000).toFixed(1) + 'k';
  if (v >= 1000) return (v / 1000).toFixed(2) + 'k';
  return Math.round(v) + '';
}
export function fmtMs(v: number): string { return v >= 10000 ? (v / 1000).toFixed(1) + 's' : v >= 1000 ? (v / 1000).toFixed(2) + 's' : Math.round(v) + 'ms'; }
/** minutes → d / h / m (sim-paradigms.js) */
export const fmtMin = (v: number): string => v >= 1440 ? (v / 1440).toFixed(1) + 'd' : v >= 60 ? (v / 60).toFixed(1) + 'h' : v >= 10 ? Math.round(v) + 'm' : v.toFixed(1) + 'm';

export type HistKey = keyof Omit<SysStat, 'drop'> | 'qtot' | 'p50' | 'p95' | 'p99' | 'rps' | 'goodput' | 'err' | 'sat';
export interface HistPoint extends SysStat { t: number }
export function polyline(hist: HistPoint[], key: HistKey, w: number, h: number, max?: number): string {
  if (!hist.length) return '';
  const m = max || Math.max(1e-6, ...hist.map(s => s[key]));
  return hist.map((s, i) => `${(i / Math.max(1, hist.length - 1) * w).toFixed(1)},${(h - Math.min(1, s[key] / m) * (h - 2) - 1).toFixed(1)}`).join(' ');
}
