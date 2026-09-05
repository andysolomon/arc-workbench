// viewport culling: nodes fully outside a 400px halo around the canvas skip their body, telemetry and ports
import type { GraphNode, View } from '../model/document';

export const CULL_FROM = 40;
export interface WorldBox { x0: number; y0: number; x1: number; y1: number }
export function worldBox(v: View, width: number, height: number): WorldBox { return { x0: (-v.x - 400) / v.k, y0: (-v.y - 400) / v.k, x1: (width - v.x + 400) / v.k, y1: (height - v.y + 400) / v.k }; }
export function isCulled(n: GraphNode, h: number, W: number, wb: WorldBox | null): boolean { return !!wb && (n.x > wb.x1 || n.y > wb.y1 || n.x + W < wb.x0 || n.y + h < wb.y0); }
