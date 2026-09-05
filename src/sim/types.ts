// Same output contract for every paradigm so the Workbench patches telemetry into the DOM
// identically: { nodes: {id: {arr, util, lat, q, err, health}}, edges: {id: rate}, sys, run }
import type { HistPoint } from './format';
import type { Provenance } from './metrics';

export type Health = 'ok' | 'warn' | 'crit';
export interface NodeStat { arr: number; util: number; lat: number; q: number; err: number; health: Health; async?: boolean }
export interface SysStat { rps: number; goodput: number; p50: number; p95: number; p99: number; err: number; qtot: number; sat: number; drop?: number }
/** the traced execution — one token / object (workflow, state) or one replayed request (sequence) */
export interface RunState { node?: string; edge: string | null; t?: number; retries?: number; done?: Record<string, 1>; cursor?: number; total?: number }
export interface TimelineMsg { id: string; start: number; end: number; lat: number }
export interface Timeline<E = unknown> { msgs: Array<TimelineMsg & { e: E }>; total: number }
export interface Metrics { nodes: Record<string, NodeStat>; edges: Record<string, number>; sys: SysStat; run?: RunState | null; tl?: Timeline; /** where this snapshot came from — absent only on legacy fixtures */ prov?: Provenance }

/** queueing engine state (architecture · data flow) */
export interface QueueSim { q: Record<string, number>; retry: Record<string, number>; hist: HistPoint[]; noise: number }
/** token / markov / timeline state (workflow · state · sequence) */
export interface Run { at: string; left: number; t: number; retries?: number; hops: number; last: string | null; dead?: 1; bad?: boolean }
export interface ParadigmSim {
  pid: string; t: number; acc: number; runs: Run[]; done: number[]; /** parallel to `done`: 1 when that completion ended badly — err shares the p99 window */ doneBad: number[]; edgeN: Record<string, number>; nodeN: Record<string, number>;
  dwell: Record<string, number>; doneN: number; badN: number; rate: Record<string, number>; hist: HistPoint[]; cursor: number;
  track: Run | null; noise: number; doneRate?: number;
}
export type SimState = QueueSim | ParadigmSim;
export const isQueueSim = (s: SimState): s is QueueSim => !('runs' in s);
