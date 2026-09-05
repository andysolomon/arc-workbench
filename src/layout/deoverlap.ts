// minimal downward push: only nodes whose columns overlap, only the lower one, 16px grid
import type { GraphNode } from '../model/document';

/** returns the pushed node list, or null when nothing overlapped */
export function deoverlap(nodes: GraphNode[], footH: (id: string) => number, W: number): GraphNode[] | null {
  const G = 16, GAP = 24;
  const ns = nodes.map(n => ({ id: n.id, x: n.x, y: n.y, h: footH(n.id) })).sort((a, b) => a.y - b.y);
  let hit = false;
  for (let p = 0; p < 3; p++) {
    let moved = false;
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i]!, b = ns[j]!;
      if (Math.abs(a.x - b.x) >= W - 8) continue;
      if (b.y >= a.y + a.h + GAP - 0.5) continue;
      b.y = Math.ceil((a.y + a.h + GAP) / G) * G; moved = hit = true;
    }
    ns.sort((a, b) => a.y - b.y);
    if (!moved) break;
  }
  if (!hit) return null;
  const by: Record<string, number> = {}; ns.forEach(n => by[n.id] = n.y);
  return nodes.map(n => by[n.id] === n.y ? n : { ...n, y: by[n.id]! });
}
