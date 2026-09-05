// one transformed viewport element. Live gestures always use transform; the committed view may
// take css zoom (a true re-raster) where a probe proved the layout identical — see zoomSafe in app.
import type { View } from '../model/document';

export interface ViewCss { zoom: string; transform: string }
export interface TransformOpts { live: boolean; zoomOk: boolean; smooth: boolean; zoomSafe: (k: number) => boolean }
export function viewCss(v: View, o: TransformOpts): ViewCss {
  const tf: ViewCss = { zoom: '', transform: 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.k + ')' };
  if (o.live || !o.zoomOk || o.smooth) return tf;
  // css zoom lays text out at the zoomed size, and Chrome rounds those line boxes differently
  // from the transform — below ~0.85 every node grows 3–20px on settle and edges pop. The
  // re-raster is taken only where a probe proved the layout identical; elsewhere the settled
  // view keeps the transform. Smoothness wins over crispness.
  if (!o.zoomSafe(v.k)) return tf;
  return { zoom: String(v.k), transform: 'translate(' + (v.x / v.k) + 'px,' + (v.y / v.k) + 'px)' };
}
/** zoom about a focal point in canvas pixels, keeping the world under it still */
export function zoomAbout(v: View, k: number, fx: number, fy: number): View { return { k, x: fx - (fx - v.x) * k / v.k, y: fy - (fy - v.y) * k / v.k }; }
export const toWorld = (v: View, cx: number, cy: number): { x: number; y: number } => ({ x: (cx - v.x) / v.k, y: (cy - v.y) / v.k });
