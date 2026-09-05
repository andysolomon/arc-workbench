// View models are plain data. render/ never imports sim: every telemetry string arrives here
// already formatted, and the 4 Hz patcher writes later values straight into the DOM.
import type { PointerEvent as RPointerEvent, MouseEvent as RMouseEvent } from 'react';
import type { EdgeRel, NodeForm, ParadigmId, RegionVariant, VisualFamily } from '../model/document';
import type { Side } from '../router/geometry';

export type Mode = 'design' | 'simulate' | 'analyze';
export type ZoomLevelAttr = 'overview' | 'compact' | 'working' | 'detail';
export type OnOff = 'on' | 'off';
export type Tone = 'ok' | 'warn' | 'critical' | 'error';
export type Sev = 'crit' | 'warn' | 'info' | '';

export interface Row { k: string; v: string; cfg: '1' | null; dk: '1' | null; hasShort: boolean; short: string }
export type PortState = '' | 'origin' | 'connected';

export interface NodeVM {
  id: string;
  kind: string;
  family: VisualFamily;
  state: string;
  health: string;
  terminal: '1' | null;
  initial: '1' | null;
  side: '1' | null;
  form: NodeForm | null;
  run: null;
  density: 'compact' | null;
  aria: string;
  x: number; y: number; w: number;
  pixel: boolean;
  title: string;
  typeLbl: string;
  showHdot: boolean; glyph: string; hword: string;
  hasAnn: boolean; annSev: Sev; annText: string;
  showTel: boolean; rate: string; unit: string; spark: string; p99: string; q: string; utilV: number; tone: Tone; dotTone: Tone;
  showBody: boolean; rows: Row[];
  showStatus: boolean;
  showPorts: boolean; pl: PortState; pr: PortState; pt: PortState; pb: PortState;
}

export interface PktStyle { opacity: number; strokeWidth: string; dur?: string }
export interface EdgeVM {
  id: string;
  d: string;
  rel: EdgeRel;
  state: string;
  weight: string;
  stress: string;
  run: null;
  msg: 'self' | null;
  aria: string;
  onPath: boolean;
  hasLabel: boolean; labelText: string; labelRole: 'event' | null; lx: number; ly: number;
  hasGuard: boolean; guardText: string; lyG: number;
  hasAction: boolean; actionText: string; lyA: number;
  ly2: number;
  rateText: string;
  packets: boolean; pktStyle: PktStyle;
}

export interface RegionVM {
  id: string;
  variant: RegionVariant;
  family: VisualFamily;
  alt: '1' | null;
  dashed: '1' | null;
  state: 'selected' | null;
  label: string;
  owner: string;
  hasOwner: boolean;
  needsOwner: boolean;
  selectable: boolean;
  aria: string;
  left: number; top: number; width: number; height: number;
}
export interface TierVM { id: string; family: VisualFamily; label: string; left: number; top: number; width: number; height: number }

export interface SeqLineVM { id: string; x: number; y1: number; y2: number }
export interface SeqTickVM { x1: number; x2: number; y: number; ty: number; label: string }
export interface SeqActVM { id: string; family: VisualFamily; x: number; y: number; w: number; h: number }
export interface SeqVM { lines: SeqLineVM[]; ticks: SeqTickVM[]; acts: SeqActVM[]; cursor: { x1: number; x2: number; y: number } | null }
export interface ChanGuide { x1: number; y1: number; x2: number; y2: number }

/** Endpoint handles: screen-constant — r and hit are already divided by k */
export interface EndsVM { edgeId: string; x1: number; y1: number; x2: number; y2: number; hr: number; vr: number; isSel: boolean; strokeWidth: number }

export interface CanvasAttrs {
  paradigm: ParadigmId;
  mode: Mode;
  zoom: ZoomLevelAttr;
  trace: OnOff;
  touch: '1' | '0';
  oLabels: OnOff; oRates: OnOff; oPackets: OnOff; oSpark: OnOff; oChan: OnOff;
  chan: 'tight' | 'normal' | 'loose';
}

export interface CanvasVM {
  attrs: CanvasAttrs;
  viewStyle: { zoom: string; transform: string };
  gridStyle: { backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string };
  tiers: TierVM[];
  regions: RegionVM[];
  chanGuides: ChanGuide[];
  seq: SeqVM | null;
  edges: EdgeVM[];
  nodes: NodeVM[];
  hasConnect: boolean;
  ends: EndsVM | null;
}

export type El = HTMLElement | null;
export interface Handlers {
  onBgDown(e: RPointerEvent<HTMLDivElement>): void;
  onNodeDown(id: string, e: RPointerEvent<HTMLDivElement>): void;
  onPortDown(id: string, side: Side, e: RPointerEvent<HTMLSpanElement>): void;
  onEdgeEnter(id: string): void;
  onEdgeLeave(id: string): void;
  onEdgeMove(id: string, e: RPointerEvent<SVGGElement>): void;
  onEdgeClick(id: string, e: RMouseEvent<SVGPathElement>): void;
  onRegionSelect(id: string, e: RMouseEvent<HTMLSpanElement>): void;
  onGrabEnd(edgeId: string, end: 'from' | 'to', e: RPointerEvent<SVGCircleElement>): void;
  setCanvasEl(el: HTMLDivElement | null): void;
  setGridEl(el: HTMLDivElement | null): void;
  setViewEl(el: HTMLDivElement | null): void;
  setNodeEl(id: string, el: HTMLDivElement | null): void;
  setEdgeEl(id: string, el: SVGGElement | null): void;
  setConnectEl(el: SVGPathElement | null): void;
  setEndsEl(el: SVGSVGElement | null): void;
  setCursorEl(el: SVGLineElement | null): void;
}
