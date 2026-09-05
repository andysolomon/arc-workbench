// Auto layout — one command, five strategies. Every strategy: rank by longest path from the
// sources (back edges ignored), order within a rank by predecessor barycentre, snap to the
// 16px grid, then re-fit regions around the members they held before the move.
import type { Graph, GraphEdge, GraphNode, GraphRegion, ParadigmId } from '../model/document';

const G = 16, snap = (v: number): number => Math.round(v / G) * G;

interface Ranks { rank: Record<string, number>; pos: Record<string, number>; byRank: Record<number, string[]>; R: number[] }
function ranks(nodes: GraphNode[], edges: GraphEdge[]): Ranks {
  const ids = nodes.map(n => n.id), byId: Record<string, GraphNode> = {}; nodes.forEach(n => byId[n.id] = n);
  const outs: Record<string, string[]> = {}, ins: Record<string, string[]> = {}; ids.forEach(id => { outs[id] = []; ins[id] = []; });
  edges.forEach(e => { if (byId[e.from] && byId[e.to] && e.from !== e.to) { outs[e.from]!.push(e.to); ins[e.to]!.push(e.from); } });
  // DFS to drop back edges
  const color: Record<string, number> = {}, back: Record<string, 1> = {};
  const dfs = (u: string): void => { color[u] = 1; outs[u]!.forEach(v => { if (color[v] === 1) back[u + '>' + v] = 1; else if (!color[v]) dfs(v); }); color[u] = 2; };
  ids.forEach(id => { if (!color[id]) dfs(id); });
  const fwd: Record<string, string[]> = {}; ids.forEach(id => fwd[id] = outs[id]!.filter(v => !back[id + '>' + v]));
  const indeg: Record<string, number> = {}; ids.forEach(id => indeg[id] = 0); ids.forEach(id => fwd[id]!.forEach(v => indeg[v] = (indeg[v] ?? 0) + 1));
  const rank: Record<string, number> = {}, q = ids.filter(id => !indeg[id]); q.forEach(id => rank[id] = 0);
  for (let i = 0; i < q.length; i++) fwd[q[i]!]!.forEach(v => { rank[v] = Math.max(rank[v] || 0, rank[q[i]!]! + 1); indeg[v] = (indeg[v] ?? 0) - 1; if (!indeg[v]) q.push(v); });
  ids.forEach(id => { if (rank[id] == null) rank[id] = 0; });
  // barycentre order
  const pos: Record<string, number> = {}; const byRank: Record<number, string[]> = {};
  ids.forEach(id => (byRank[rank[id]!] = byRank[rank[id]!] || []).push(id));
  const R = Object.keys(byRank).map(Number).sort((a, b) => a - b);
  R.forEach(r => byRank[r]!.forEach((id, i) => pos[id] = i));
  for (let sweep = 0; sweep < 3; sweep++) R.forEach(r => {
    const l = byRank[r]!;
    const bc = (id: string): number => { const p = ins[id]!.filter(v => rank[v]! < r); return p.length ? p.reduce((s, v) => s + pos[v]!, 0) / p.length : pos[id]!; };
    l.sort((a, b) => bc(a) - bc(b) || (byId[a]!.y - byId[b]!.y)); l.forEach((id, i) => pos[id] = i);
  });
  return { rank, pos, byRank, R };
}

const inside = (n: GraphNode, r: GraphRegion, W: number, H: number): boolean => { const cx = n.x + W / 2, cy = n.y + (H / 2); return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h; };

export interface LayoutOpts { W?: number; hOf?: (id: string) => number }
type Pt = { x: number; y: number };

export function autoLayout(pid: ParadigmId, nodes: GraphNode[], edges: GraphEdge[], regions: GraphRegion[] | undefined, opts: LayoutOpts): Graph {
  const W = opts.W || 200, hOf = opts.hOf || (() => 88), gapX = 56, gapY = 24;
  const members: Record<string, string[]> = {}; (regions || []).forEach(r => members[r.id] = nodes.filter(n => inside(n, r, W, hOf(n.id))).map(n => n.id));
  const out: Record<string, Pt> = {}, byId: Record<string, GraphNode> = {}; nodes.forEach(n => byId[n.id] = n);
  const rg = (regions || []).map(r => ({ ...r }));
  if (pid === 'sequence') {
    nodes.slice().sort((a, b) => a.x - b.x).forEach((n, i) => out[n.id] = { x: 48 + i * (W + 40), y: 48 });
    return { nodes: nodes.map(n => ({ ...n, ...out[n.id] })), edges, regions: rg };
  }
  const { rank, pos, byRank, R } = ranks(nodes, edges);
  const rowH = (id: string): number => hOf(id) + gapY;
  if (pid === 'workflow' || pid === 'state') {
    // band-aware: rows are lanes (workflow) or phases (state); x is the rank column
    const bands = rg.filter(r => r.variant === (pid === 'workflow' ? 'lane' : 'phase')).sort((a, b) => a.y - b.y);
    const bandOf: Record<string, string | null> = {}; nodes.forEach(n => { const b = bands.find(r => inside(n, r, W, hOf(n.id))); bandOf[n.id] = b ? b.id : null; });
    let y0 = 48; const colW = W + gapX;
    const place = (list: string[], top: number): number => { const slot: Record<number, number> = {}; let h = 0; list.forEach(id => { const k = rank[id]!; const s = slot[k] || 0; slot[k] = s + 1; out[id] = { x: 48 + rank[id]! * colW, y: top + 56 + s * rowH(id) }; h = Math.max(h, 56 + (s + 1) * rowH(id)); }); return Math.max(h + 16, 144); };
    if (bands.length) {
      bands.forEach(b => {
        const list = nodes.filter(n => bandOf[n.id] === b.id).map(n => n.id).sort((a, c) => rank[a]! - rank[c]! || pos[a]! - pos[c]!);
        const h = place(list, y0);
        b.y = y0; b.h = snap(h); b.x = 16; b.w = snap(48 + (Math.max(0, ...R) + 1) * colW + 16); y0 += b.h;
      });
      const loose = nodes.filter(n => !bandOf[n.id]).map(n => n.id);
      if (loose.length) place(loose, y0);
    } else R.forEach(r => byRank[r]!.forEach((id, i) => out[id] = { x: 48 + r * colW, y: 48 + i * rowH(id) }));
  } else if (pid === 'dataflow') {
    const stages = rg.filter(r => r.variant === 'stage').sort((a, b) => a.x - b.x);
    if (stages.length) {
      const stageOf: Record<string, string | null> = {}; nodes.forEach(n => { const s = stages.find(r => inside(n, r, W, hOf(n.id))); stageOf[n.id] = s ? s.id : null; });
      let x0 = 16, maxH = 0;
      stages.forEach(s => {
        const list = nodes.filter(n => stageOf[n.id] === s.id).map(n => n.id).sort((a, b) => rank[a]! - rank[b]! || pos[a]! - pos[b]!);
        let y = 96; list.forEach(id => { out[id] = { x: x0 + 36, y }; y += rowH(id) + 40; });
        maxH = Math.max(maxH, y);
        s.x = x0; s.w = W + 72; s.y = 16; x0 += s.w + 16;
      });
      stages.forEach(s => s.h = snap(Math.max(maxH, 400)));
      nodes.filter(n => !stageOf[n.id]).forEach((n, i) => out[n.id] = { x: x0 + 36, y: 96 + i * rowH(n.id) });
    } else R.forEach(r => byRank[r]!.forEach((id, i) => out[id] = { x: 48 + r * (W + gapX), y: 48 + i * rowH(id) }));
  } else {
    // architecture: layered left-to-right, ranks centred vertically
    const tall = Math.max(...R.map(r => byRank[r]!.reduce((s, id) => s + rowH(id), 0)));
    R.forEach(r => { const l = byRank[r]!, h = l.reduce((s, id) => s + rowH(id), 0); let y = 48 + (tall - h) / 2; l.forEach(id => { out[id] = { x: 48 + r * (W + gapX), y }; y += rowH(id); }); });
  }
  const placed = nodes.map(n => ({ ...n, x: snap(out[n.id] ? out[n.id]!.x : n.x), y: snap(out[n.id] ? out[n.id]!.y : n.y) }));
  // re-fit free regions (boundary / zone) around their former members
  const pb: Record<string, GraphNode> = {}; placed.forEach(n => pb[n.id] = n);
  rg.forEach(r => {
    if (r.variant !== 'boundary' && r.variant !== 'zone') return;
    const ms = (members[r.id] || []).map(id => pb[id]).filter((n): n is GraphNode => !!n); if (!ms.length) return;
    const pad = 32;
    const x0 = Math.min(...ms.map(n => n.x)) - pad, y0 = Math.min(...ms.map(n => n.y)) - pad - 8;
    const x1 = Math.max(...ms.map(n => n.x + W)) + pad, y1 = Math.max(...ms.map(n => n.y + hOf(n.id))) + pad;
    r.x = snap(x0); r.y = snap(y0); r.w = snap(x1 - x0); r.h = snap(y1 - y0);
  });
  return { nodes: placed, edges, regions: rg };
}
