// blueprint grid: 16px minor + 80px major, density follows zoom (minor fades at compact, drops at overview)
import type { View } from '../model/document';
import { zoomLevelOf } from './zoom';

export interface GridStyle { position: 'absolute'; inset: 0; pointerEvents: 'none'; backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string }
export function gridStyleFor(v: View, on: boolean, semantic: boolean): GridStyle {
  const base: GridStyle = { position: 'absolute', inset: 0, pointerEvents: 'none' };
  if (!on) return base;
  const lvl = zoomLevelOf(v.k, semantic);
  const minor = 'color-mix(in srgb,var(--graph-grid-minor-color) ' + (lvl === 'compact' ? '55%' : '100%') + ',transparent)';
  const imgs: string[] = [], sizes: number[] = [];
  if (lvl !== 'overview') { imgs.push('linear-gradient(' + minor + ' 1px,transparent 1px)', 'linear-gradient(90deg,' + minor + ' 1px,transparent 1px)'); sizes.push(16, 16); }
  imgs.push('linear-gradient(var(--graph-grid-major-color) 1px,transparent 1px)', 'linear-gradient(90deg,var(--graph-grid-major-color) 1px,transparent 1px)'); sizes.push(80, 80);
  return { ...base, backgroundImage: imgs.join(','), backgroundSize: sizes.map(s => (s * v.k) + 'px ' + (s * v.k) + 'px').join(','), backgroundPosition: sizes.map(() => v.x + 'px ' + v.y + 'px').join(',') };
}
