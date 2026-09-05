// The flat workbench state — the prototype's `state` object, typed (WB 708–711). The document
// fields (nodes · edges · regions · view · rps) are the GraphDocument; everything else is lens state.
import type { GraphEdge, GraphNode, GraphRegion, ParadigmId, Selection, View } from '../model/document';
import type { Side } from '../router/geometry';

export type Theme = 'dark' | 'light';
export type Mode = 'design' | 'simulate' | 'analyze';
export interface UiFlags { labels: boolean; rates: boolean; packets: boolean; spark: boolean; grid: boolean; pixel: boolean; hints: boolean; channels: boolean; dense: boolean; semantic: boolean; tidy: boolean; tiers: boolean; trace: boolean; edgeCard: boolean }
export type UiKey = keyof UiFlags;
export const UIOPTS: ReadonlyArray<readonly [UiKey, string]> = [['labels', 'edge labels'], ['rates', 'edge rate text'], ['edgeCard', 'edge hover card'], ['packets', 'traffic packets'], ['spark', 'node sparklines'], ['grid', 'blueprint grid'], ['tiers', 'tier bands · design'], ['pixel', 'pixel node fill'], ['semantic', 'semantic zoom'], ['tidy', 'auto-tidy overlaps'], ['channels', 'routing channels'], ['dense', 'compact inspector'], ['hints', 'onboarding hints']];

export interface Toast { text: string; tone: 'ok' | 'warn' }
/** a modal yes/no; `run` is the confirmed action, Escape / cancel / scrim leave everything untouched */
export interface Confirm { title: string; detail: string; ok: string; run: () => void; /** an optional second, non-destructive action */ alt?: { label: string; run: () => void } }
/** whether the latest edit is durable: clean (nothing to save) · dirty · saving · saved · failed */
export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'failed';
export interface Connect { from: string; side: Side }
export interface Rewire { edgeId: string; end: 'from' | 'to' }
export interface Focus { key: string; nodes: Record<string, 1>; edges: Record<string, 1>; keep: Record<string, 1> }

export interface WorkbenchState {
  ready: boolean;
  theme: Theme | null;
  mode: Mode;
  running: boolean;
  rps: number;
  sel: Selection | null;
  presetId: string;
  /** the named document record this paradigm's canvas belongs to */
  docId: string;
  title: string;
  save: SaveState;
  paradigm: ParadigmId;
  nodes: GraphNode[];
  edges: GraphEdge[];
  regions: GraphRegion[];
  view: View;
  search: string;
  collapsed: Record<string, boolean>;
  drawerOpen: boolean;
  libOpen: boolean;
  palette: boolean;
  pq: string;
  pi: number;
  connect: Connect | null;
  hoverEdge: string | null;
  rewire: Rewire | null;
  /** bumped when measured geometry changes so routes re-solve */
  geo: number;
  focus: Focus | null;
  paraOpen: boolean;
  createOpen: boolean;
  nextKind: string | null;
  settingsOpen: boolean;
  /** transient confirmation strip (share · load failures); cleared by a timer */
  toast: Toast | null;
  confirm: Confirm | null;
  helpOpen: boolean;
  ui: UiFlags;
}

export const INITIAL_UI: UiFlags = { labels: true, rates: true, edgeCard: true, packets: true, spark: true, grid: true, pixel: true, hints: true, channels: false, dense: false, semantic: true, tidy: false, tiers: true, trace: false };
export const initialState = (): WorkbenchState => ({
  ready: false, theme: null, mode: 'simulate', running: true, rps: 2400, sel: null, presetId: 'video', docId: '', title: '', save: 'clean', paradigm: 'dataflow',
  nodes: [], edges: [], regions: [], view: { x: 60, y: 30, k: 1 }, search: '', collapsed: {}, drawerOpen: false, libOpen: true,
  palette: false, pq: '', pi: 0, connect: null, hoverEdge: null, rewire: null, geo: 0, focus: null, paraOpen: false, createOpen: false, nextKind: null,
  settingsOpen: false, toast: null, confirm: null, helpOpen: false, ui: { ...INITIAL_UI },
});
