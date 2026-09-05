// HUD / telemetry vocabulary per paradigm (WB 719–725, 1530, 1615–1625). Pure string and
// number formatting — the telemetry patcher and the view model both call these.
import type { GraphEdge, GraphNode, ParadigmId } from '../model/document';
import { PARADIGMS } from '../paradigms/registry';
import { roleOf } from './engine';
import { fmt, fmtMin, fmtMs } from './format';
import type { Metrics, NodeStat, SysStat } from './types';

export type Tone = '' | 'warn' | 'crit';
const minutes = (p: ParadigmId): boolean => p === 'workflow' || p === 'state';

/** latency in the paradigm's unit: minutes for process paradigms, ms otherwise */
export function fL(p: ParadigmId, v: number): string { return minutes(p) ? fmtMin(v) : fmtMs(v); }
export function p99Tone(p: ParadigmId, v: number): Tone { return minutes(p) ? (v > 1440 ? 'crit' : v > 480 ? 'warn' : '') : (v > 1500 ? 'crit' : v > 400 ? 'warn' : ''); }
export function dropTone(p: ParadigmId, drop: number, sys: Pick<SysStat, 'rps'>): Tone { if (minutes(p)) return ''; return drop > sys.rps * 0.05 ? 'crit' : drop > 1 ? 'warn' : ''; }
export function dropOf(sys: SysStat): number { return sys.drop != null ? sys.drop : Math.max(0, sys.rps - sys.goodput); }
export function weightOf(rps: number, r: number): '1' | '2' | '3' { const L = Math.max(1, rps); return r > L * 2 ? '3' : r > L * 0.6 ? '2' : '1'; }
export function unitFor(p: ParadigmId, n: GraphNode, st: Pick<NodeStat, 'util'>): string {
  if ((p === 'architecture' || p === 'dataflow') && roleOf(n) === 'source') return 'sent';
  if (p === 'sequence' && n.type === 'client') return 'caller';
  return Math.round(st.util * 100) + '% ' + (minutes(p) ? 'occupied' : 'busy');
}
export function protoOf(p: ParadigmId, e: Pick<GraphEdge, 'kind'>): string { return PARADIGMS[p].EDGES[e.kind]?.label ?? e.kind; }
export function rateText(p: ParadigmId, mode: string, e: GraphEdge, r: number): string {
  if (p === 'sequence') return protoOf(p, e) + (e.lat != null && (e.lat as unknown) !== '' ? ' · ' + e.lat + ' ms' : '');
  return protoOf(p, e) + (mode !== 'design' && r > 0.5 ? ' · ' + fmt(r) + PARADIGMS[p].HUD.rate : '');
}
/** state machine / workflow: the compact transition string — event [guard] / action */
export function transitionText(e: GraphEdge): string { return [e.label, e.guard ? '[' + e.guard + ']' : '', e.action ? '/ ' + e.action : ''].filter(Boolean).join(' '); }

export function sparkPts(hs: number[] | undefined): string {
  if (!hs || hs.length < 2) return '';
  const mx = Math.max(1e-6, ...hs);
  return hs.map((v, i) => ((i / (hs.length - 1)) * 54).toFixed(1) + ',' + (13 - (v / mx) * 11).toFixed(1)).join(' ');
}

// traffic packets: short indigo dashes flowing along active edges. Bounded to the
// busiest PKT_CAP edges so paint cost stays flat as the graph grows.
export const PKT_CAP = 28;
export function hasPackets(p: ParadigmId): boolean { return p === 'architecture' || p === 'dataflow'; }
export function pktRank(edges: GraphEdge[], m: Metrics | null): Record<string, 1> {
  const r: Record<string, 1> = {}; if (!m) return r;
  const list = edges.map(e => [e.id, m.edges[e.id] || 0] as const).filter(x => x[1] > 0.5).sort((a, b) => b[1] - a[1]).slice(0, PKT_CAP);
  list.forEach(x => r[x[0]] = 1);
  return r;
}
export interface PktStyle { opacity: number; strokeWidth: string; dur?: string }
export function pktStyleFor(rate: number, active: boolean, ranked: boolean | 1 | 0 | undefined): PktStyle {
  if (!ranked || rate <= 0.5) return { opacity: 0, strokeWidth: '1px' };
  const lg = Math.log10(1 + rate);
  return { opacity: Math.min(0.9, (active ? 0.5 : 0.28) + lg * 0.13), strokeWidth: Math.min(2.4, 1 + rate / 5000) + 'px', dur: Math.max(0.5, 2.6 - lg * 0.42).toFixed(2) + 's' };
}

/** health → HUD words / glyphs / tones */
export const HW = { ok: 'healthy', warn: 'degrading', crit: 'saturated' } as const;
export const HG = { ok: '○', warn: '△', crit: '✕' } as const;
export const DT = { ok: 'ok', warn: 'warn', crit: 'error' } as const;
export const BT = { ok: 'ok', warn: 'warn', crit: 'critical' } as const;
