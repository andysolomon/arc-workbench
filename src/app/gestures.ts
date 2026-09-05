// ---- gestures (WB 1222–1489): pointer capture + a single rAF-coalesced pointermove. Pan writes
// transform on the viewport element; a node drag moves the node with transform and re-solves
// edges live; connect / rewire draw previews imperatively; everything commits on pointerup. ----
import type { View } from '../model/document';
import type { Overrides, Side } from '../router';
import { pathFrom, routePts, sidesFor, type Box } from '../router/geometry';
import { clampK, wheelK, zoomAbout } from '../view';
import type { WorkbenchController } from './controller';

export type Drag =
  | { t: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { t: 'node'; id: string; sx: number; sy: number; nx: number; ny: number; moved: boolean; dx: number; dy: number }
  | { t: 'connect'; from: string; side: Side; p1: [number, number] }
  | { t: 'rewire'; edgeId: string; end: 'from' | 'to' };
interface Pinch { p?: Array<{ x: number; y: number }>; d0: number; v0: View; c0: { x: number; y: number } }
type PtrLike = { clientX: number; clientY: number };

export class Gestures {
  drag: Drag | null = null;
  ptr: PointerEvent | null = null;
  tView: View | null = null;
  pinch: Pinch | null = null;
  ptrs = new Map<number, { x: number; y: number }>();
  focal: { x: number; y: number } | null = null;
  private raf = 0;
  private wc = 0;
  private mv: ((e: PointerEvent) => void) | null = null;
  private up: ((e: PointerEvent) => void) | null = null;
  private wired = new WeakSet<HTMLElement>();
  constructor(private readonly c: WorkbenchController) {}

  mountWindow(): void {
    window.addEventListener('pointermove', this.mv = e => {
      if (this.pinch && this.ptrs.has(e.pointerId)) { this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.queue(); return; }
      if (this.drag) { this.ptr = e; this.queue(); }
    });
    window.addEventListener('pointerup', this.up = e => this.onUp(e));
    window.addEventListener('pointercancel', this.up);
  }
  unmountWindow(): void {
    if (this.mv) window.removeEventListener('pointermove', this.mv);
    if (this.up) { window.removeEventListener('pointerup', this.up); window.removeEventListener('pointercancel', this.up); }
    if (this.raf) cancelAnimationFrame(this.raf); clearTimeout(this.wc);
  }
  private queue(): void { if (!this.raf) this.raf = requestAnimationFrame(() => this.frame()); }

  setCanvas(el: HTMLDivElement): void {
    if (this.wired.has(el)) return; this.wired.add(el);
    const c = this.c;
    // touch: two fingers = pinch-zoom + pan. Capture phase so it beats node/port handlers.
    el.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || c.tev) return;
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.ptrs.size !== 2) return;
      this.abortDragForPinch();
      const p = [...this.ptrs.values()], r = el.getBoundingClientRect(), v = c.curView();
      this.pinch = { d0: Math.hypot(p[0]!.x - p[1]!.x, p[0]!.y - p[1]!.y) || 1, v0: { ...v }, c0: { x: (p[0]!.x + p[1]!.x) / 2 - r.left, y: (p[0]!.y + p[1]!.y) / 2 - r.top } };
      if (c.refs.view) c.refs.view.style.willChange = 'transform';
      el.style.cursor = '';
    }, true);
    // iPadOS/Safari: touch events are the reliable pinch source, and preventDefault here is
    // the only thing that stops the browser scaling the whole page instead of the canvas.
    if (c.tev) {
      el.addEventListener('touchstart', e => { if (e.touches.length < 2) return; e.preventDefault(); this.startPinch(e.touches); }, { passive: false, capture: true });
      el.addEventListener('touchmove', e => { if (!this.pinch) return; e.preventDefault(); if (e.touches.length < 2) return; this.pinch.p = this.pinchPts(e.touches); this.queue(); }, { passive: false, capture: true });
      const end = (e: TouchEvent): void => { if (this.pinch && e.touches.length < 2) this.endPinch(); };
      el.addEventListener('touchend', end, true);
      el.addEventListener('touchcancel', end, true);
      const stop = (e: Event): void => e.preventDefault();
      el.addEventListener('gesturestart', stop, { passive: false });
      el.addEventListener('gesturechange', stop, { passive: false });
    }
    c.observeResize(el);
    // keep-alive leash: while a card is open, hovering anywhere near it cancels the close timer
    el.addEventListener('pointermove', e => {
      if (this.drag || !c.state.hoverEdge || !c.refs.card) return;
      const b = c.refs.card.getBoundingClientRect(), m = 56;
      if (e.clientX > b.left - m && e.clientX < b.right + m && e.clientY > b.top - m && e.clientY < b.bottom + m) c.keepCardAlive();
    }, { passive: true });
    el.addEventListener('wheel', e => {
      e.preventDefault(); c.touched = true; c.markHint('zoom');
      const r = el.getBoundingClientRect(), v = c.curView();
      const k = wheelK(v.k, e.deltaY);
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      this.focal = { x: cx, y: cy };
      this.tView = zoomAbout(v, k, cx, cy);
      if (c.refs.view) c.refs.view.style.willChange = 'transform';
      this.queue();
      // 240ms: a mouse wheel's notches arrive 100–250ms apart — committing between them would
      // flip transform ↔ zoom on every notch. Trackpad and momentum streams are far denser.
      clearTimeout(this.wc); this.wc = window.setTimeout(() => c.commitView(), 240);
    }, { passive: false });
  }

  onBgDown(e: PointerEvent): void {
    const c = this.c;
    if (e.button !== 0) return;
    // the inspector and the other floating panels live INSIDE the canvas, so a press on them
    // used to start a pan and clear the selection on release — closing the panel mid-edit
    const t = e.target as Element | null;
    if (t && t.closest && t.closest('[data-chrome]')) return;
    if (c.state.settingsOpen) c.setState({ settingsOpen: false });
    c.closeCard();
    this.drag = { t: 'pan', sx: e.clientX, sy: e.clientY, vx: c.state.view.x, vy: c.state.view.y, moved: false };
    if (c.refs.view) c.refs.view.style.willChange = 'transform';
    if (c.refs.canvas) c.refs.canvas.style.cursor = 'grabbing';
  }
  nodeDown(id: string, e: PointerEvent): void {
    const c = this.c;
    if (e.button !== 0) return; e.stopPropagation();
    const n = c.nById[id]; if (!n) return;
    c.setState({ sel: { kind: 'node', id }, hoverEdge: null });
    this.drag = { t: 'node', id, sx: e.clientX, sy: e.clientY, nx: n.x, ny: n.y, moved: false, dx: 0, dy: 0 };
  }
  portDown(id: string, side: Side, e: PointerEvent): void {
    const c = this.c;
    e.stopPropagation(); e.preventDefault();
    const n = c.nById[id]; if (!n) return;
    const p1 = c.anchorOf(c.geomOf(n, null), side);
    const invalid: Record<string, 1> = {}, seq = c.state.paradigm === 'sequence';
    c.state.nodes.forEach(t => { if ((t.id === id && !seq) || (!seq && c.state.edges.some(x => x.from === id && x.to === t.id))) invalid[t.id] = 1; });
    c.connectInvalid = invalid; c.prevOver = null;
    this.drag = { t: 'connect', from: id, side, p1 };
    c.setState({ connect: { from: id, side }, hoverEdge: null });
  }
  grabEnd(edgeId: string, end: 'from' | 'to', e: PointerEvent): void {
    const c = this.c;
    e.stopPropagation(); e.preventDefault();
    this.drag = { t: 'rewire', edgeId, end }; c.prevOver = null;
    if (c.refs.canvas) c.refs.canvas.style.cursor = 'grabbing';
    c.setState({ sel: { kind: 'edge', id: edgeId }, rewire: { edgeId, end }, hoverEdge: null });
  }
  frame(): void {
    this.raf = 0;
    const c = this.c;
    if (this.pinch) { this.applyPinch(); return; }
    if (!this.drag) { if (this.tView) c.applyViewDom(this.tView, true); return; }
    const d = this.drag, e = this.ptr; if (!e) return;
    if (d.t === 'pan') {
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
      this.tView = { x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy, k: c.state.view.k };
      c.applyViewDom(this.tView, true);
    } else if (d.t === 'node') {
      if (!d.moved) {
        d.moved = true; c.snap();
        const el = c.refs.nodeEl(d.id); if (el) el.dataset['state'] = 'dragging';
        // corridors re-solve live but the guide layer is React-rendered — hide it until the drop
        if (c.refs.canvas) c.refs.canvas.dataset['oChan'] = 'off';
      }
      const k = c.state.view.k;
      d.dx = (e.clientX - d.sx) / k; d.dy = c.state.paradigm === 'sequence' ? 0 : (e.clientY - d.sy) / k;
      const el = c.refs.nodeEl(d.id); if (el) el.style.transform = 'translate3d(' + d.dx + 'px,' + d.dy + 'px,0)';
      const ov: Overrides = { [d.id]: { x: d.nx + d.dx, y: d.ny + d.dy } };
      c.applyRoutes(c.routes(ov, null));
    } else if (d.t === 'connect') {
      const w = c.toWorld(e);
      const tgt = c.nodeAt(w, c.snapPad());
      const snap = tgt && c.connectInvalid && !c.connectInvalid[tgt.id] ? tgt : null;
      if (c.refs.connect) {
        const P: Box = { x: d.p1[0], y: d.p1[1], w: 0, h: 0 };
        let end: [number, number], s2: Side;
        if (snap) { const G = c.geomOf(snap, null); s2 = sidesFor(P, G)[1]; end = c.anchorOf(G, s2); }
        else { s2 = sidesFor(P, { x: w.x, y: w.y, w: 0, h: 0 })[1]; end = [w.x, w.y]; }
        c.refs.connect.setAttribute('d', pathFrom(routePts(d.p1, d.side, end, s2), 5));
      }
      this.hoverTarget(tgt ?? null, true);
    } else if (d.t === 'rewire') {
      const w = c.toWorld(e);
      const ed = c.state.edges.find(x => x.id === d.edgeId);
      const other = ed ? (d.end === 'from' ? ed.to : ed.from) : null;
      const tgt = c.nodeAt(w, c.snapPad());
      const snap = tgt && tgt.id !== other ? tgt : null;
      if (ed) c.patchEdgeDom(ed, null, { end: d.end, x: w.x, y: w.y, node: snap });
      this.hoverTarget(snap, false);
    }
  }
  /** drop the transient transform and put data-state back to what React last rendered — React
   * will not rewrite an attribute it believes is unchanged, so an imperative '' would stick */
  private restoreNodeState(id: string): void {
    const c = this.c, el = c.refs.nodeEl(id); if (!el) return;
    el.style.transform = '';
    const sel = c.state.sel;
    el.dataset['state'] = sel && sel.kind === 'node' && sel.id === id ? 'selected' : '';
  }
  hoverTarget(n: { id: string } | null, isConnect: boolean): void {
    const c = this.c, id = n ? n.id : null;
    if (id === c.prevOver) return;
    if (c.prevOver) { const pe = c.refs.nodeEl(c.prevOver); if (pe) pe.dataset['state'] = (isConnect && c.connectInvalid && c.connectInvalid[c.prevOver]) ? 'muted' : ''; }
    if (id) { const el = c.refs.nodeEl(id); if (el) el.dataset['state'] = (isConnect && c.connectInvalid && c.connectInvalid[id]) ? 'invalid-target' : 'compatible'; }
    c.prevOver = id;
  }
  onUp(e: PointerEvent): void {
    const c = this.c;
    if (this.pinch && this.pinch.p) return; // touch pinch ends on touchend, not pointerup
    if (this.ptrs.has(e.pointerId)) {
      this.ptrs.delete(e.pointerId);
      if (this.pinch && this.ptrs.size < 2) { this.pinch = null; this.drag = null; this.ptr = null; c.commitView(); return; }
    }
    const d = this.drag; this.drag = null; this.ptr = null;
    if (c.refs.canvas) c.refs.canvas.style.cursor = '';
    if (!d) return;
    if (d.t === 'pan') {
      if (d.moved) { c.touched = true; c.markHint('pan'); c.commitView(); }
      else { this.tView = null; if (c.refs.view) c.refs.view.style.willChange = ''; c.setState({ sel: null }); }
    }
    if (d.t === 'node') {
      this.restoreNodeState(d.id);
      if (d.moved) {
        const nodes = c.state.nodes.map(n => n.id === d.id ? { ...n, x: d.nx + d.dx, y: d.ny + d.dy } : n);
        const r = c.fitLanes(c.state.regions, nodes, d.id);
        c.setState({ nodes: r.nodes, regions: r.regions });
      }
    }
    if (d.t === 'connect') {
      const tgt = c.nodeAt(c.toWorld(e), c.snapPad());
      this.hoverTarget(null, true);
      if (tgt && c.connectInvalid && !c.connectInvalid[tgt.id]) {
        const from = c.nById[d.from]!;
        c.addEdge(d.from, tgt.id, c.defaultEdgeKind(from, tgt));
      } else c.setState({ connect: null });
      c.connectInvalid = null;
    }
    if (d.t === 'rewire') {
      const tgt = c.nodeAt(c.toWorld(e), c.snapPad());
      this.hoverTarget(null, false);
      const ed = c.state.edges.find(x => x.id === d.edgeId);
      if (tgt && ed) {
        const other = d.end === 'from' ? ed.to : ed.from;
        const cur = d.end === 'from' ? ed.from : ed.to;
        if (tgt.id !== other && tgt.id !== cur) {
          c.snap(); c.markHint('rewire');
          c.setState({ edges: c.state.edges.map(x => x.id === d.edgeId ? { ...x, [d.end]: tgt.id } : x), rewire: null });
          return;
        }
      }
      c.setState({ rewire: null });
    }
  }
  /** Escape mid-gesture: drop the drag, restore the node, clear previews */
  cancelDrag(): boolean {
    const c = this.c, d = this.drag; if (!d) return false;
    this.drag = null;
    if (d.t === 'node') this.restoreNodeState(d.id);
    this.hoverTarget(null, d.t === 'connect');
    c.setState({ connect: null, rewire: null });
    return true;
  }
  // pinch: scale about the gesture's original centre, then follow that centre so two
  // fingers pan and zoom in one move. Same tView/commit path as wheel zoom.
  private abortDragForPinch(): void {
    const c = this.c, d = this.drag; this.drag = null; this.ptr = null;
    if (d && d.t === 'node') this.restoreNodeState(d.id);
    if (d && (d.t === 'connect' || d.t === 'rewire')) { this.hoverTarget(null, d.t === 'connect'); c.setState({ connect: null, rewire: null }); }
  }
  pinchPts(t: TouchList): Array<{ x: number; y: number }> { return [{ x: t[0]!.clientX, y: t[0]!.clientY }, { x: t[1]!.clientX, y: t[1]!.clientY }]; }
  startPinch(t: TouchList): void {
    const c = this.c, el = c.refs.canvas; if (!el) return;
    this.abortDragForPinch(); this.ptrs.clear();
    const p = this.pinchPts(t), r = el.getBoundingClientRect(), v = c.curView();
    this.pinch = { p, d0: Math.hypot(p[0]!.x - p[1]!.x, p[0]!.y - p[1]!.y) || 1, v0: { ...v }, c0: { x: (p[0]!.x + p[1]!.x) / 2 - r.left, y: (p[0]!.y + p[1]!.y) / 2 - r.top } };
    if (c.refs.view) c.refs.view.style.willChange = 'transform';
    el.style.cursor = '';
  }
  endPinch(): void { this.pinch = null; this.drag = null; this.ptr = null; this.ptrs.clear(); this.c.commitView(); }
  applyPinch(): void {
    const c = this.c, p = this.pinch && this.pinch.p ? this.pinch.p : [...this.ptrs.values()];
    if (p.length < 2 || !c.refs.canvas || !this.pinch) return;
    const g = this.pinch, r = c.refs.canvas.getBoundingClientRect();
    const d = Math.hypot(p[0]!.x - p[1]!.x, p[0]!.y - p[1]!.y) || 1;
    const k = clampK(g.v0.k * d / g.d0);
    const cx = (p[0]!.x + p[1]!.x) / 2 - r.left, cy = (p[0]!.y + p[1]!.y) / 2 - r.top;
    this.focal = { x: cx, y: cy };
    c.touched = true; c.markHint('zoom'); c.markHint('pan');
    this.tView = { k, x: cx - (g.c0.x - g.v0.x) * k / g.v0.k, y: cy - (g.c0.y - g.v0.y) * k / g.v0.k };
    c.applyViewDom(this.tView, true);
  }
}
export type { PtrLike };
