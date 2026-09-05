// Deterministic pseudo-random topology per paradigm (ported from Stress Lab.dc.html build()) so the
// perf tests can load "preset scale" (~60 nodes / ~90 edges) and beyond without shipping fixtures.
import type { GraphEdge, GraphNode, GraphRegion, ParadigmId, VisualFamily } from '../model/document';
import { autoLayout } from '../layout/auto';
import { PARADIGMS, nodeDefaults } from '../paradigms/registry';

export interface StressDoc { nodes: GraphNode[]; edges: GraphEdge[]; regions: GraphRegion[]; rps: number }
const rng = (seed: number) => { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const FAM: VisualFamily[] = ['indigo', 'cyan', 'amber', 'purple', 'emerald', 'orange'];

export function stressDoc(pid: ParadigmId, nodeCount: number, edgeCount: number, W = 200): StressDoc {
  const T = PARADIGMS[pid], r = rng(nodeCount * 31 + edgeCount);
  const types = Object.keys(T.TYPES).filter(t => { const d = T.TYPES[t]!; return !(d.terminal || d.side || d.initial || d.source); });
  const terms = Object.keys(T.TYPES).filter(t => T.TYPES[t]!.terminal);
  const ekinds = Object.keys(T.EDGES);
  const N = pid === 'sequence' ? Math.min(nodeCount, 40) : nodeCount;
  const nodes: GraphNode[] = [];
  for (let i = 0; i < N; i++) { const isTerm = terms.length && i >= N - Math.ceil(N * 0.08); const type = isTerm ? terms[i % terms.length]! : types[Math.floor(r() * types.length)]!; nodes.push({ id: 'n' + i, type, name: T.TYPES[type]!.label + ' ' + i, x: 0, y: 0, ...nodeDefaults(pid, type) }); }
  const edges: GraphEdge[] = [];
  if (pid === 'sequence') { for (let i = 0; i < edgeCount; i++) { const a = Math.floor(r() * N); let b = Math.floor(r() * N); if (b === a) b = (a + 1) % N; const kind = ekinds[Math.floor(r() * ekinds.length)]!; edges.push({ id: 'e' + i, from: 'n' + a, to: 'n' + b, kind, seq: i + 1, lat: Math.round(r() * 40), label: i % 3 ? '' : kind + ' ' + i, w: 1 }); } }
  else for (let i = 0; i < edgeCount; i++) { const a = Math.floor(r() * N); const b = Math.min(N - 1, a + 1 + Math.floor(r() * 3)); if (a === b) continue; edges.push({ id: 'e' + i, from: 'n' + a, to: 'n' + b, kind: ekinds[Math.floor(r() * ekinds.length)]!, label: i % 4 ? '' : 'edge ' + i, w: 1 }); }
  // regions: lanes / stages / phases / boundaries, sized by the layout pass
  let regions: GraphRegion[] = [];
  if (pid === 'workflow') regions = [0, 1, 2, 3, 4].map(i => ({ id: 'l' + i, variant: 'lane', label: '0' + (i + 1) + ' / lane', family: FAM[i]!, x: 16, y: 48 + i * 300, w: 4000, h: 300, owner: 'owner ' + i, ownerKind: 'team' }));
  if (pid === 'dataflow') regions = [0, 1, 2, 3, 4, 5].map(i => ({ id: 's' + i, variant: 'stage', label: '0' + (i + 1) + ' / stage', family: FAM[i]!, x: 16 + i * 900, y: 16, w: 900, h: 4000 }));
  if (pid === 'state') regions = [0, 1, 2].map(i => ({ id: 'f' + i, variant: 'phase', label: '0' + (i + 1) + ' / phase', family: FAM[i]!, x: 16, y: 48 + i * 700, w: 6000, h: 700 }));
  if (pid === 'sequence') regions = [0, 1, 2, 3].map(i => ({ id: 'p' + i, variant: 'phase', label: 'phase ' + (i + 1), family: FAM[i]!, x: 0, y: 0, w: 0, h: 0, from: 1 + Math.floor(i * edgeCount / 4), to: Math.floor((i + 1) * edgeCount / 4) }));
  // first pass: a crude grid so band membership exists, then the real layout
  const cols = Math.ceil(Math.sqrt(N * 1.6));
  nodes.forEach((n, i) => { n.x = 48 + (i % cols) * 256; n.y = 48 + Math.floor(i / cols) * 120; });
  if (pid === 'workflow' || pid === 'state' || pid === 'dataflow') nodes.forEach((n, i) => { const rg = regions[i % Math.max(1, regions.length)]; if (rg) { if (rg.variant === 'stage') n.x = rg.x + 36; else n.y = rg.y + 60; } });
  const lay = autoLayout(pid, nodes, edges, regions, { W, hOf: () => 96 });
  if (pid === 'architecture') { const xs = lay.nodes.map(n => n.x), ys = lay.nodes.map(n => n.y); const x0 = Math.min(...xs), x1 = Math.max(...xs) + W, y0 = Math.min(...ys), y1 = Math.max(...ys) + 100; lay.regions = [{ id: 'b0', variant: 'boundary', label: 'region · stress', family: 'stone', x: x0 - 32, y: y0 - 40, w: x1 - x0 + 64, h: y1 - y0 + 72 }, { id: 'b1', variant: 'boundary', label: 'vpc · private', family: 'indigo', x: x0 + (x1 - x0) * 0.3, y: y0 - 16, w: (x1 - x0) * 0.4, h: y1 - y0 + 24 }]; }
  return { nodes: lay.nodes, edges, regions: lay.regions, rps: pid === 'workflow' || pid === 'state' ? 200 : 2000 };
}
