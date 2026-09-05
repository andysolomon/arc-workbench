// The authoritative metric definitions — every surface (HUD, telemetry patcher, inspector,
// telemetry drawer, findings) derives its numbers and strings from THESE functions, so the same
// measure cannot read differently in two places. Provenance (`Metrics.prov`) says where a
// snapshot came from: its timestamp, tick, sample window and whether it is past warm-up.
import type { ParadigmId } from '../model/document';
import { fL } from './hud';
import { fmt } from './format';
import type { Metrics, NodeStat, SysStat } from './types';

/** provenance of one metrics snapshot */
export interface Provenance {
  /** wall-clock time of the tick that produced the snapshot */
  at: number;
  /** ticks since the simulation was (re)started */
  tick: number;
  /** what the sample window is, in the paradigm's own terms */
  window: string;
  /** samples inside that window: ticks (analytic engines) or completed runs (token engines) */
  samples: number;
  /** enough samples for percentiles and shares to mean something */
  warm: boolean;
  /** token engines: completions in the window that ended in a bad terminal state */
  bad?: number;
  /** queueing engines: events/s piling up across every lagging node (Σ nodeLag) */
  lag?: number;
}

/** warm-up thresholds: below these, percentiles and outcome shares are reported as insufficient */
export const WARM = { ticks: 4, completions: 20 } as const;
export const isWarm = (m: Metrics | null): boolean => !!m && (!m.prov || m.prov.warm);
export const samplesOf = (m: Metrics | null): number => m?.prov?.samples ?? 0;

/** node p99 — an estimate: 2.2 × the node's mean latency (the prototype's factor). Instant. */
export const nodeP99 = (st: Pick<NodeStat, 'lat'>): number => st.lat * 2.2;
/** node lag — events/s arriving beyond what the node can serve (0 while util ≤ 1). Instant. */
export const nodeLag = (st: Pick<NodeStat, 'arr' | 'util'>): number => Math.max(0, st.arr * (1 - 1 / Math.max(st.util, 1)));
/** system lag — Σ nodeLag; what a data-flow HUD calls "lagging" */
export const sysLag = (m: Pick<Metrics, 'nodes'>): number => Object.values(m.nodes).reduce((s, st) => s + nodeLag(st), 0);
/** system shed — offered load that never became goodput (architecture "dropped", sequence "timeouts") */
export const sysDrop = (sys: SysStat): number => sys.drop != null ? sys.drop : Math.max(0, sys.rps - sys.goodput);

/** the HUD's fourth number: lag for data flow, shed for the request paradigms, in-flight for the process ones */
export function hudD(p: ParadigmId, m: Metrics): number { return p === 'dataflow' ? (m.prov?.lag ?? sysLag(m)) : sysDrop(m.sys); }
/** system p99 in the paradigm's unit, or — while warming up */
export function p99Text(p: ParadigmId, m: Metrics | null): string { return m && isWarm(m) ? fL(p, m.sys.p99) : '—'; }
export function nodeP99Text(p: ParadigmId, st: Pick<NodeStat, 'lat'>): string { return fL(p, nodeP99(st)); }
export function hudDText(p: ParadigmId, m: Metrics | null): string { return m ? fmt(hudD(p, m)) : '—'; }
/** "warming up · 3 of 20 completions" while the window is thin, else the window itself */
export function windowNote(m: Metrics | null): string {
  if (!m) return 'no run yet';
  if (!m.prov) return 'snapshot';
  if (!m.prov.warm) return 'warming up · ' + m.prov.samples + ' of ' + (m.prov.window.includes('completion') ? WARM.completions + ' completions' : WARM.ticks + ' ticks');
  return m.prov.window;
}
export const stampOf = (m: Metrics | null): string => m?.prov ? new Date(m.prov.at).toLocaleTimeString() : '';

/** the definitions, for documentation and tooltips */
export interface MetricDef { id: string; label: string; scope: 'system' | 'node' | 'edge'; unit: string; window: string; definition: string; surfaces: string }
export const METRIC_DEFS: readonly MetricDef[] = [
  { id: 'sys.p99', label: 'end-to-end / cycle / lifetime / roundtrip p99', scope: 'system', unit: 'ms · min', window: 'instant (queueing) · last ≤300 completions (token)', definition: 'queueing: visit-weighted mean latency × (2.3 + 2.2·saturation); data flow includes async hops. token: p99 of completed run durations.', surfaces: 'HUD · findings footer · drawer chart' },
  { id: 'node.p99', label: 'node p99', scope: 'node', unit: 'ms · min', window: 'instant', definition: '2.2 × the node\'s mean latency (estimate)', surfaces: 'inspector · node telemetry · bottleneck finding' },
  { id: 'node.lag', label: 'lag', scope: 'node', unit: 'events/s', window: 'instant', definition: 'arrivals × (1 − 1/util) while util > 1, else 0', surfaces: 'lag finding' },
  { id: 'sys.lag', label: 'lagging', scope: 'system', unit: 'events/s', window: 'instant', definition: 'Σ node lag', surfaces: 'data-flow HUD' },
  { id: 'sys.drop', label: 'dropped · timeouts', scope: 'system', unit: '/s', window: 'instant', definition: 'offered load − goodput', surfaces: 'HUD (architecture · sequence)' },
  { id: 'sys.err', label: 'errors · failed · bad exits', scope: 'system', unit: 'share', window: 'instant (queueing) · last ≤300 completions (token)', definition: 'queueing: visit-weighted node error share. token: bad completions ÷ completions in the window.', surfaces: 'HUD · drawer · exit finding' },
  { id: 'drawer.max', label: 'max', scope: 'system', unit: 'as the chart', window: 'last ≤140 ticks', definition: 'the maximum of the charted series over the history window — not the current value', surfaces: 'telemetry drawer' },
];
