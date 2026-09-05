// Element registry for the imperative layers. Child [data-t] targets are cached per node/edge
// and invalidated whenever React re-renders that element (the callback ref fires null → el), so
// a 4 Hz pass touches only cached references and allocates nothing per node.
export interface NodeRef {
  el: HTMLElement;
  q: boolean; // children resolved
  rate: HTMLElement | null; unit: HTMLElement | null; p99: HTMLElement | null; q_: HTMLElement | null;
  spark: SVGPolylineElement | null; util: HTMLElement | null; dot: HTMLElement | null; hword: HTMLElement | null; hdot: HTMLElement | null;
  // last written values, so identical strings never touch the DOM
  vRate: string; vUnit: string; vP99: string; vQ: string; vSpark: string; vUtil: string; vTone: string; vHealth: string; vGlyph: string; vHword: string;
}
export interface EdgeRef {
  g: SVGGElement;
  q: boolean;
  path: SVGPathElement | null; hit: SVGPathElement | null; pkt: SVGPathElement | null; hl: SVGPathElement | null;
  elabel: SVGTextElement | null; erate: SVGTextElement | null;
  vRate: string; vWeight: string; vHealth: string; vRun: string; vD: string;
}

const nodeRef = (el: HTMLElement): NodeRef => ({ el, q: false, rate: null, unit: null, p99: null, q_: null, spark: null, util: null, dot: null, hword: null, hdot: null, vRate: '', vUnit: '', vP99: '', vQ: '', vSpark: '', vUtil: '', vTone: '', vHealth: '', vGlyph: '', vHword: '' });
const edgeRef = (g: SVGGElement): EdgeRef => ({ g, q: false, path: null, hit: null, pkt: null, hl: null, elabel: null, erate: null, vRate: '', vWeight: '', vHealth: '', vRun: '', vD: '' });

export function resolveNode(r: NodeRef): NodeRef {
  if (r.q) return r;
  const el = r.el;
  r.rate = el.querySelector('[data-t="rate"]'); r.unit = el.querySelector('[data-t="unit"]'); r.p99 = el.querySelector('[data-t="p99"]'); r.q_ = el.querySelector('[data-t="q"]');
  r.spark = el.querySelector('[data-t="spark"]'); r.util = el.querySelector('[data-t="util"]'); r.dot = el.querySelector('[data-t="dot"]'); r.hword = el.querySelector('[data-t="hword"]'); r.hdot = el.querySelector('[data-t="hdot"]');
  r.q = true;
  return r;
}
export function resolveEdge(r: EdgeRef): EdgeRef {
  if (r.q) return r;
  const g = r.g;
  r.path = g.querySelector('path.tg-edge'); r.hit = g.querySelector('.tg-edge-hit'); r.pkt = g.querySelector('.wb-packets'); r.hl = g.querySelector('.wb-hl');
  r.elabel = g.querySelector('[data-t="elabel"]'); r.erate = g.querySelector('[data-t="erate"]');
  r.q = true;
  return r;
}

export type ChromeSlot = 'canvas' | 'grid' | 'view' | 'connect' | 'ends' | 'cursor' | 'hud' | 'strip' | 'drawer' | 'insp' | 'find' | 'card';
export class Refs {
  nodes: Record<string, NodeRef> = {};
  edges: Record<string, EdgeRef> = {};
  canvas: HTMLDivElement | null = null;
  grid: HTMLDivElement | null = null;
  view: HTMLDivElement | null = null;
  connect: SVGPathElement | null = null;
  ends: SVGSVGElement | null = null;
  cursor: SVGLineElement | null = null;
  hud: HTMLElement | null = null;
  strip: HTMLElement | null = null;
  drawer: HTMLElement | null = null;
  insp: HTMLElement | null = null;
  find: HTMLElement | null = null;
  card: HTMLElement | null = null;

  setNode(id: string, el: HTMLDivElement | null): void { if (el) { const cur = this.nodes[id]; if (cur && cur.el === el) cur.q = false; else this.nodes[id] = nodeRef(el); } else delete this.nodes[id]; }
  setEdge(id: string, el: SVGGElement | null): void { if (el) { const cur = this.edges[id]; if (cur && cur.g === el) cur.q = false; else this.edges[id] = edgeRef(el); } else delete this.edges[id]; }
  nodeEl(id: string): HTMLElement | null { return this.nodes[id]?.el ?? null; }
  edgeEl(id: string): SVGGElement | null { return this.edges[id]?.g ?? null; }
  node(id: string): NodeRef | null { const r = this.nodes[id]; return r ? resolveNode(r) : null; }
  edge(id: string): EdgeRef | null { const r = this.edges[id]; return r ? resolveEdge(r) : null; }
}
