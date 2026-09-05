// the whole world is ONE css scale, so at a fractional k every crisp feature of the pixel
// motif — 1.5px borders, the 6px fill, the 4/8px hard shadows, the 16px grid — lands on a
// fractional device pixel and resamples soft. The committed scale snaps to a ladder where
// those features stay whole pixels; gestures still scale freely, then settle onto a rung.
export const K_MIN = 0.15, K_MAX = 2.5;
export type ZoomLevel = 'overview' | 'compact' | 'working' | 'detail';

let lad: { d: number; v: number[] } | null = null;
export function zoomLadder(dpr: number): number[] {
  const d = Math.max(1, Math.round(dpr || 1));
  if (lad && lad.d === d) return lad.v;
  const v: number[] = [];
  for (let n = 8; n >= 3; n--) v.push(+(1 / n).toFixed(4));       // integer downscale: 1/8 … 1/3
  for (let i = 1; i <= 10; i++) v.push(+(i * (0.5 / d)).toFixed(4)); // whole-pixel upscale
  const u = [...new Set(v)].filter(x => x >= K_MIN && x <= K_MAX).sort((a, b) => a - b);
  lad = { d, v: u };
  return u;
}
export function crispK(k: number, crisp: boolean, dpr: number): number {
  if (!crisp) return k;
  let b: number | null = null;
  zoomLadder(dpr).forEach(v => { if (b === null || Math.abs(v - k) < Math.abs(b - k)) b = v; });
  return b ?? k;
}
export function crispDown(k: number, crisp: boolean, dpr: number): number {
  if (!crisp) return k;
  const L = zoomLadder(dpr); let b = L[0]!; L.forEach(v => { if (v <= k + 1e-6) b = v; }); return b;
}
export function crispStep(k: number, up: boolean, crisp: boolean, dpr: number): number {
  const L = zoomLadder(dpr);
  if (!crisp) return Math.min(K_MAX, Math.max(K_MIN, up ? k * 1.1 : k / 1.1));
  if (up) return L.find(v => v > k + 1e-6) ?? L[L.length - 1]!;
  for (let i = L.length - 1; i >= 0; i--) if (L[i]! < k - 1e-6) return L[i]!;
  return L[0]!;
}
export function zoomLevelOf(k: number, semantic: boolean): ZoomLevel {
  if (!semantic) return 'working';
  return k < 0.45 ? 'overview' : k < 0.7 ? 'compact' : k <= 1.2 ? 'working' : 'detail';
}
export const clampK = (k: number): number => Math.min(K_MAX, Math.max(K_MIN, k));
/** wheel: exponential zoom about the pointer */
export const wheelK = (k: number, deltaY: number): number => clampK(k * Math.exp(-deltaY * 0.0016));
