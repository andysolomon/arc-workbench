// ---- lanes: structural owners. Membership is geometric (header row inside the band) ----
import type { GraphNode, GraphRegion, OwnerKind, ParadigmId } from '../model/document';

export const OWNER_KINDS: ReadonlyArray<readonly [OwnerKind, string, string]> = [
  ['team', 'team', 'people who own the outcome of these steps'],
  ['system', 'system', 'automation that runs the steps'],
  ['actor', 'actor', 'an external party · customer, vendor, regulator'],
  ['boundary', 'boundary', 'an ownership boundary work must be admitted into · governance, compliance, production'],
];
export function lanes(regions: GraphRegion[] | undefined): GraphRegion[] { return (regions || []).filter(r => r.variant === 'lane').sort((a, b) => a.y - b.y); }
export function laneOf(n: GraphNode, regions: GraphRegion[] | undefined): GraphRegion | null { const cy = n.y + 24; return lanes(regions).find(r => cy >= r.y && cy < r.y + r.h) || null; }
export function laneMembers(id: string, nodes: GraphNode[], regions: GraphRegion[] | undefined): GraphNode[] { return nodes.filter(n => { const l = laneOf(n, regions); return !!l && l.id === id; }); }

export interface LaneFit { regions: GraphRegion[]; nodes: GraphNode[] }
/**
 * lanes fit their members: height grows to the lowest step (min 144, 16px snap) and shrinks
 * back when steps leave; the stack then closes up, carrying each lane's steps. The dropped
 * step keeps its position, so the lane it landed in is the one that resizes.
 * `prevNodes` is the committed state before the move (the prototype read `this.state.nodes`).
 */
export function fitLanes(pid: ParadigmId, prevNodes: GraphNode[], regions: GraphRegion[], nodes: GraphNode[], movedId: string | null | undefined, hOf: (n: GraphNode) => number): LaneFit {
  if (pid !== 'workflow') return { regions, nodes };
  const ls = (regions || []).filter(r => r.variant === 'lane').sort((a, b) => a.y - b.y); if (!ls.length) return { regions, nodes };
  const G = 16, PAD = 24;
  const laneAt = (n: GraphNode, L: GraphRegion[]): GraphRegion | undefined => { const cy = n.y + 24; return L.find(r => cy >= r.y && cy < r.y + r.h); };
  const memb: Record<string, GraphNode[]> = {}; ls.forEach(l => memb[l.id] = []); nodes.forEach(n => { const l = laneAt(n, ls); if (l) memb[l.id]!.push(n); });
  // only lanes whose membership changed are re-fit: the drop target, the lane the step left,
  // or every lane when the change wasn't a single step (lane move / delete)
  const touched: Record<string, 1> = {};
  if (movedId) {
    const prev = prevNodes.find(n => n.id === movedId), now = nodes.find(n => n.id === movedId);
    const a = prev && laneAt(prev, ls), b = now && laneAt(now, ls);
    if (a) touched[a.id] = 1; if (b) touched[b.id] = 1;
  } else ls.forEach(l => touched[l.id] = 1);
  let y = ls[0]!.y; const shift: Record<string, number> = {}, sized = ls.map(l => {
    let h = l.h;
    if (touched[l.id]) {
      const need = Math.max(0, ...memb[l.id]!.map(n => n.y + hOf(n) + PAD - l.y));
      const base = l.baseH || l.h; // authored height is the floor; a lane only grows past it while a step needs the room
      h = Math.max(base, Math.ceil(need / G) * G);
    }
    shift[l.id] = y - l.y; const r: GraphRegion = { ...l, y, h, baseH: l.baseH || l.h }; y += h; return r;
  });
  const outR = regions.map(r => sized.find(m => m.id === r.id) || r);
  const outN = nodes.map(n => { const l = laneAt(n, ls); return l && shift[l.id] ? { ...n, y: n.y + shift[l.id]! } : n; });
  return { regions: outR, nodes: outN };
}
