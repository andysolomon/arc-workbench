// The Workbench controller — the prototype's component class minus render (WB 707–2113).
// `this.state` became the store; every imperative field (element refs, drag, timers, sim state,
// history, parked documents) lives here. React components read the store and call methods.
import type { GraphEdge, GraphNode, GraphRegion, Graph, ParadigmId, Selection, View } from '../model/document';
import { edgeId as newEdgeId, laneId, nodeId, phaseId } from '../model/ids';
import { BLANK, EXAMPLES, ORDER, PARADIGMS, defaultEdgeKind, edgeDefaults, familyOf, familyOfGk, nodeDefaults, type Field, type Paradigm } from '../paradigms';
import { OWNER_KINDS, autoLayout, deoverlap as deoverlapNodes, fitLanes as fitLanesPure, laneMembers as laneMembersPure, laneOf as laneOfPure, lanes as lanesPure } from '../layout';
import { RoutePlanner, SEQ, anchorOf, geomOfWith, seqGeo as seqGeoPure, seqMsgs as seqMsgsPure, type Box, type EdgeGeo, type Overrides, type PlanInput, type Ptr, type RouteMap, type SeqGeo, type Side } from '../router';
import { analyze as analyzeAll, handoffs, type Analysis, type Finding } from '../analyze';
import { fmt, hasPackets, makeParadigmSim, makeSim, protoOf as protoOfPure, rateText, tick, tickSequence, tickState, tickWorkflow, timeline, transitionText, type Metrics, type ParadigmSim, type QueueSim, type RunState, type SimState } from '../sim';
import { CULL_FROM, crispK, crispStep, docBounds, fitView, gridStyleFor, viewCss, worldBox, zoomCentred, zoomLevelOf, type GridStyle, type ViewCss, type WorldBox, type ZoomLevel } from '../view';
import { Refs, applyEdgeGeo, applyRoutes, clearRuntimeDom, patchTelemetry, type PatchCtx } from '../telemetry';
import { History, createStore, initialState, type Docks, type Mode, type Patch, type ParkedDoc, type Snapshot, type Store, type Theme, type UiKey, type WorkbenchState, UIOPTS } from '../store';
import type { Handlers } from '../render/types';
import { resolveProps, type ResolvedProps, type WorkbenchProps } from './props';
import { W } from './viewModel';
import { stressDoc } from './stress';
import { Gestures } from './gestures';
import { onKey } from './keyboard';
import { SHARED_PRESET, decodeDocument, docOf, sharePayload, shareUrl } from './share';
import { LocalStorageStore, Workspace, newDocumentId, type KeyValueStore, type LoadResult, type StoredDocument } from '../persist';
import { migrate, type GraphDocument } from '../model';
import type { Toast } from '../store';

export interface PaletteItem { label: string; hint: string; run: () => void }
export interface EdgeCardVM { fromName: string; toName: string; proto: string; left: number; top: number }
/** the slice of state a stored record is built from — a save is due when any of these change identity */
interface DocSig { paradigm: ParadigmId; nodes: GraphNode[]; edges: GraphEdge[]; regions: GraphRegion[]; rps: number; view: View; title: string; presetId: string }
export interface InspectorField { key: string; label: string; half: '1' | null; isText: boolean; isNum: boolean; isSel: boolean; isCheck: boolean; ph: string; min: number | undefined; max: number | undefined; step: number | undefined; value: string | number; checked: boolean; options: Array<{ v: string; l: string }>; onChange: (v: string | boolean) => void }

const GAPS = { tight: 6, normal: 8, loose: 12 } as const;

export class WorkbenchController {
  readonly store: Store<WorkbenchState>;
  readonly refs = new Refs();
  readonly planner = new RoutePlanner();
  readonly history = new History();
  readonly workspace: Workspace;
  readonly gestures: Gestures;
  props: ResolvedProps;
  docs: Docks = {};
  simState: SimState | null = null;
  metrics: Metrics | null = null;
  nhist: Record<string, number[]> = {};
  hadM = false;
  uptimeS = 0;
  findings: Finding[] = [];
  hintsDone: Record<string, 1> = {};
  touched = false;
  nodeH: Record<string, number> = {};
  nodeHMax: Record<string, number> = {};
  readonly W = W;
  readonly SEQ = SEQ;
  readonly UIOPTS = UIOPTS;
  readonly OWNER_KINDS = OWNER_KINDS;
  readonly touch: boolean;
  readonly tev: boolean;
  // transient
  connectInvalid: Record<string, 1> | null = null;
  prevOver: string | null = null;
  cardFor: string | null = null;
  cardPos: { left: number; top: number } | null = null;
  hoverPtr: { x: number; y: number; w: number; h: number } | null = null;
  endsFor: string | null = null;
  fitPending = false;
  private _focusLane: 'name' | 'owner' | null = null;
  private _nByIdFor: GraphNode[] | null = null;
  private _nById: Record<string, GraphNode> = {};
  private _gapV: number | null = null;
  private _maxSig: string | null = null;
  private _zsafe: Map<string, boolean> | null = null;
  private _zoomOk: boolean | null = null;
  private _zq = 0; private _doq = 0; private _geoQ = false; private _fitRaf = 0; private _af = 0; private _rf = 0; private _roq = 0;
  private _fsig: string | null = null; private _fAt = 0; private _rpsT = 0;
  private _hoverOn = 0; private _hoverOff = 0;
  private _clearedFor: string | null = null;
  private timer = 0;
  private _toastT = 0;
  private _hc: (() => void) | null = null;
  private _sharedPayload: string | null = null;
  /** the document as loaded (JSON); the doc is dirty when the live graph differs from it */
  private _cleanDoc: string | null = null;
  private _savedSig: DocSig | null = null;
  private _seenSig: DocSig | null = null;
  private _saveT = 0;
  private _hide: (() => void) | null = null;
  private ro: ResizeObserver | null = null;
  private _kd: ((e: KeyboardEvent) => void) | null = null;
  readonly handlers: Handlers;

  constructor(props: WorkbenchProps = {}, opts: { storage?: KeyValueStore } = {}) {
    this.props = resolveProps(props);
    this.store = createStore(initialState());
    this.workspace = new Workspace(opts.storage ?? new LocalStorageStore(), { familyOfAlias: familyOfGk });
    this.store.subscribe(() => this.onStoreChange());
    this.touch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0 && !!(typeof matchMedia === 'function' && matchMedia('(hover:none)').matches);
    this.tev = typeof window !== 'undefined' && typeof (window as Window & { ontouchstart?: unknown }).ontouchstart !== 'undefined';
    this.gestures = new Gestures(this);
    const g = this.gestures, R = this.refs;
    this.handlers = {
      onBgDown: e => g.onBgDown(e.nativeEvent),
      // React propagates synthetic events on its own tree: stop both, or the canvas starts a pan
      onNodeDown: (id, e) => { e.stopPropagation(); g.nodeDown(id, e.nativeEvent); },
      onPortDown: (id, side, e) => { e.stopPropagation(); g.portDown(id, side, e.nativeEvent); },
      onEdgeEnter: id => this.edgeEnter(id), onEdgeLeave: id => this.edgeLeave(id), onEdgeMove: (id, e) => this.edgeMove(id, e.nativeEvent),
      onEdgeClick: (id, e) => { e.stopPropagation(); this.setState({ sel: { kind: 'edge', id } }); },
      onRegionSelect: (id, e) => { e.stopPropagation(); this.setState({ sel: { kind: 'region', id }, hoverEdge: null }); },
      onGrabEnd: (edgeId, end, e) => { e.stopPropagation(); g.grabEnd(edgeId, end, e.nativeEvent); },
      setCanvasEl: el => { R.canvas = el; if (el) g.setCanvas(el); },
      setGridEl: el => { R.grid = el; }, setViewEl: el => { R.view = el; },
      setNodeEl: (id, el) => R.setNode(id, el), setEdgeEl: (id, el) => R.setEdge(id, el),
      setConnectEl: el => { R.connect = el; }, setEndsEl: el => { R.ends = el; }, setCursorEl: el => { R.cursor = el; },
    };
  }

  // ---- state access ----
  get state(): WorkbenchState { return this.store.get(); }
  setState(patch: Patch<WorkbenchState>, cb?: () => void): void { this.store.set(patch, cb); }
  get T(): Paradigm { return PARADIGMS[this.state.paradigm]; }
  paraId(): ParadigmId { return this.state.paradigm; }
  get nById(): Record<string, GraphNode> { const ns = this.state.nodes; if (this._nByIdFor !== ns) { this._nById = {}; ns.forEach(n => this._nById[n.id] = n); this._nByIdFor = ns; } return this._nById; }
  graph(): Graph { const s = this.state; return { nodes: s.nodes, edges: s.edges, regions: s.regions }; }
  relOf(e: GraphEdge): string { return this.T.EDGES[e.kind]?.rel ?? 'flow'; }
  protoOf(e: GraphEdge): string { return protoOfPure(this.paraId(), e); }
  transitionText(e: GraphEdge): string { return transitionText(e); }
  th(): Theme { return this.state.theme || this.props.theme; }
  applyTheme(): void {
    const h = document.documentElement, d = this.th() === 'dark';
    if (d) h.setAttribute('data-theme', 'dark'); else h.removeAttribute('data-theme');
    h.style.colorScheme = d ? 'dark' : 'light'; // native number spinners + scrollbars
  }
  setUi(k: UiKey): void {
    const ui = { ...this.state.ui, [k]: !this.state.ui[k] };
    try { localStorage.setItem('wb.ui', JSON.stringify(ui)); } catch { /* storage unavailable */ }
    if (k === 'edgeCard' && !ui.edgeCard) this.closeCard(false);
    this.setState({ ui });
  }
  setMode(mode: Mode): void {
    if (mode === 'design') { this.clearRuntimeDom(); this.setState({ mode, drawerOpen: false, focus: null }); }
    else this.setState({ mode, focus: null });
  }
  toggleTheme(): void { this.setState({ theme: this.th() === 'dark' ? 'light' : 'dark' }); }
  toggleRunning(): void { this.setState(s => ({ running: !s.running })); }
  setRps(val: number): void { clearTimeout(this._rpsT); this._rpsT = window.setTimeout(() => this.setState({ rps: val }), 40); }

  // ---- lifecycle ----
  mount(): void {
    this.applyTheme();
    try { this.hintsDone = JSON.parse(localStorage.getItem('wb.hintsDone') || '{}') as Record<string, 1>; } catch { this.hintsDone = {}; }
    try { const u = JSON.parse(localStorage.getItem('wb.ui') || 'null') as Partial<WorkbenchState['ui']> | null; if (u) this.setState(s => ({ ui: { ...s.ui, ...u } })); } catch { /* storage unavailable */ }
    this.metrics = null; this.nhist = {}; this.history.reset();
    this.simState = this.makeSimState();
    const invalid = this.restoreSession(); // the stored workspace (or the default example), then a `#d=` share link on top
    this.openLocation();
    this._savedSig = this._seenSig = this.docSig();
    this.setState({ ready: true, mode: 'design', libOpen: window.innerWidth > 1060, save: this.workspace.stored().includes(this.state.paradigm) ? 'saved' : 'clean' });
    if (invalid.length) this.recoveryDialog(invalid[0]!.pid, invalid[0]!.reason);
    // a hidden tab or a closing page flushes whatever the debounce still holds
    this._hide = () => { if (document.visibilityState === 'hidden') this.flushSave(); };
    document.addEventListener('visibilitychange', this._hide); window.addEventListener('pagehide', this._hide);
    // simulation: 4Hz metric snapshots; the tick path is worker-shaped (snapshot in, patch out)
    this.timer = window.setInterval(() => { if (this.state.running && this.state.mode !== 'design') this.step(0.25); }, 250);
    this.gestures.mountWindow();
    window.addEventListener('keydown', this._kd = e => onKey(this, e));
    // a share link pasted into this tab's address bar opens without a reload; our own share() writes are ignored
    window.addEventListener('hashchange', this._hc = () => { const p = sharePayload(location.hash); if (p && p !== this._sharedPayload) this.openLocation(); });
  }
  unmount(): void {
    if (this.ro) this.ro.disconnect();
    for (const id of [this._fitRaf, this._zq, this._roq, this._doq]) if (id) cancelAnimationFrame(id);
    clearInterval(this.timer); clearTimeout(this._rf); clearTimeout(this._toastT);
    this.flushSave(); clearTimeout(this._saveT);
    if (this._hide) { document.removeEventListener('visibilitychange', this._hide); window.removeEventListener('pagehide', this._hide); } clearTimeout(this._rpsT); clearTimeout(this._hoverOn); clearTimeout(this._hoverOff);
    this.gestures.unmountWindow();
    if (this._kd) window.removeEventListener('keydown', this._kd);
    if (this._hc) window.removeEventListener('hashchange', this._hc);
  }
  /** componentDidUpdate: after every React commit */
  didUpdate(): void {
    this.applyTheme(); this.measure(); this.ensureClear();
    if (this.refs.canvas) this.refs.canvas.dataset['oChan'] = this.state.ui.channels ? 'on' : 'off';
    this._gapV = null; // re-read the channel token after commit
    // React re-renders reset data-state; restore the transient drag-target highlight
    const d = this.gestures.drag;
    if (d && this.prevOver) { const el = this.refs.nodeEl(this.prevOver); if (el) el.dataset['state'] = (d.t === 'connect' && this.connectInvalid && this.connectInvalid[this.prevOver]) ? 'invalid-target' : 'compatible'; }
    this.store.drainAfterCommit();
  }

  // ---- paradigm dispatch: the paradigm decides grammar; the lens (mode) decides information ----
  makeSimState(): SimState { const p = this.paraId(); return (p === 'architecture' || p === 'dataflow') ? makeSim() : makeParadigmSim(p); }
  simTick(dt: number): Metrics {
    const s = this.state, p = s.paradigm, { nodes, edges } = s, st = this.simState!;
    if (p === 'workflow') return tickWorkflow(st as ParadigmSim, nodes, edges, s.rps, dt);
    if (p === 'state') return tickState(st as ParadigmSim, nodes, edges, s.rps, dt);
    if (p === 'sequence') return tickSequence(st as ParadigmSim, nodes, edges, s.rps, dt);
    return tick(st as QueueSim, nodes, edges, s.rps, dt);
  }
  defaultEdgeKind(a: GraphNode, b: GraphNode): string { return defaultEdgeKind(this.paraId(), a, b, this.state.nextKind); }
  // a document per paradigm: switching never destroys work — the other document is parked
  parkDoc(): void { const s = this.state; this.docs[s.paradigm] = { nodes: s.nodes, edges: s.edges, regions: s.regions, rps: s.rps, presetId: s.presetId, view: s.view, touched: this.touched, hist: this.history.hist, future: this.history.future, clean: this._cleanDoc, docId: s.docId, title: s.title }; }
  switchParadigm(pid: ParadigmId): void {
    if (pid === this.state.paradigm) { this.setState({ paraOpen: false }); return; }
    // a running simulation never carries over: the new model waits for an explicit run
    const wasRunning = this.state.running && this.state.mode !== 'design';
    if (wasRunning) { this.setState({ running: false }); this.notify('simulation paused · press run or r to start it on ' + PARADIGMS[pid].label, 'ok', 4000); }
    this.flushSave(); // the outgoing document is durable before it parks
    this.parkDoc(); this.clearRuntimeDom();
    const d: ParkedDoc | null = this.docs[pid] ?? null;
    this.simState = null; this.metrics = null; this.nhist = {}; this.hadM = false; this.uptimeS = 0; this.planner.invalidate(); this.nodeH = {}; this.nodeHMax = {}; this._maxSig = null;
    this.setState({ paradigm: pid, nodes: [], edges: [], regions: [], paraOpen: false, createOpen: false, sel: null, connect: null, rewire: null, hoverEdge: null, focus: null, nextKind: null, search: '', collapsed: {} }, () => {
      this.simState = this.makeSimState();
      if (d) { this.history.reset(d.hist || [], d.future || []); this.touched = false; this._cleanDoc = d.clean ?? null; this.setState({ nodes: d.nodes, edges: d.edges, regions: d.regions, rps: d.rps, presetId: d.presetId, view: d.view, docId: d.docId ?? newDocumentId(), title: d.title ?? this.titleFor(d.presetId) }, () => this.fitWhenReady()); }
      else this.openPreset(EXAMPLES[pid][0]!.id);
      this.saveNow(); // the session's active paradigm moves with the switch
    });
  }
  createDoc(pid: ParadigmId): void {
    const go = (): void => { this.snapDoc(); const b = BLANK(pid); this.setState({ nodes: [], edges: [], regions: [], rps: b.rps, presetId: 'blank', docId: newDocumentId(), title: this.titleFor('blank'), sel: null, createOpen: false, paraOpen: false }, () => { this.simState = this.makeSimState(); this.metrics = null; this.hadM = false; }); this.markClean(); };
    if (pid === this.state.paradigm) go(); else { this.parkDoc(); this.docs[pid] = null; this.switchParadigm(pid); setTimeout(go, 0); }
  }
  autoLayout(): void {
    const s = this.state; if (!s.nodes.length) return;
    this.snap();
    const r = autoLayout(s.paradigm, s.nodes, s.edges, s.regions, { W: this.W, hOf: id => this.footH(id) });
    this.touched = false;
    this.setState({ nodes: r.nodes, regions: r.regions }, () => this.fitWhenReady());
  }

  // ---- sequence geometry ----
  seqMsgs(): GraphEdge[] { return seqMsgsPure(this.state.nodes, this.state.edges); }
  seqGeo(): SeqGeo {
    const s = this.state;
    return seqGeoPure({ nodes: s.nodes, edges: s.edges, nodeH: this.nodeH, geomOf: this.geomOf, regions: s.regions, W: this.W, edgeDef: e => PARADIGMS.sequence.EDGES[e.kind], familyOf: n => familyOf('sequence', n), timeline });
  }

  // ---- geometry / router ----
  footH(id: string): number { return Math.max(this.nodeHMax[id] || 0, this.nodeH[id] || 0, 88); }
  geomOf = (n: GraphNode, ov: Overrides | null): Box => geomOfWith(this.W, this.nodeH)(n, ov);
  gapPx(): number {
    if (this._gapV == null) {
      const k = this.props.channelGap, el = this.refs.canvas;
      const v = el ? parseFloat(getComputedStyle(el).getPropertyValue('--edge-channel-gap')) : 0;
      if (el) this._gapV = v || GAPS[k] || 8; else return GAPS[k] || 8;
    }
    return this._gapV;
  }
  planInput(): PlanInput {
    const s = this.state;
    return { paradigm: s.paradigm, nodes: s.nodes, edges: s.edges, geomOf: this.geomOf, gap: this.gapPx(), plain: this.props.router === 'independent', protoOf: e => this.protoOf(e), structured: !!this.T.structured, labels: s.ui.labels, nodeH: this.nodeH };
  }
  routes(ov: Overrides | null, ptr: Ptr | null): RouteMap { return this.planner.routes(this.planInput(), ov, ptr); }
  edgeGeom(e: GraphEdge, ov: Overrides | null, ptr: Omit<Ptr, 'edge'> | null): EdgeGeo | null { return this.planner.edgeGeom(this.planInput(), e, ov, ptr); }
  anchorOf(G: Box, s: Side, o?: number): [number, number] { return anchorOf(G, s, o); }

  // read every node at the TALLEST density in one synchronous pass (no paint between set and
  // restore, so nothing flickers). Layout reserves this height at every zoom level, which is
  // why crossing into 'detail' can no longer make neighbours collide.
  maxSig(): string {
    const s = this.state, u = s.ui;
    return s.paradigm + '|' + s.nodes.map(n => n.id).join(',') + '|' + s.mode + '|' + (s.running ? 1 : 0) + [u.rates, u.spark, u.packets, u.labels, u.semantic].map(x => x ? 1 : 0).join('');
  }
  measureMax(): boolean {
    const cEl = this.refs.canvas; if (!cEl) return false;
    const sig = this.maxSig();
    if (sig === this._maxSig) return false;
    this._maxSig = sig;
    const prev = cEl.dataset['zoom'], need = prev !== 'detail';
    if (need) { cEl.dataset['probe'] = '1'; cEl.dataset['zoom'] = 'detail'; }
    let ch = false;
    for (const id in this.refs.nodes) { const el = this.refs.nodes[id]!.el; const h = el.offsetHeight; if (h && h > (this.nodeHMax[id] || 0) + 1) { this.nodeHMax[id] = h; ch = true; } }
    if (need) { if (prev) cEl.dataset['zoom'] = prev; void cEl.offsetHeight; delete cEl.dataset['probe']; }
    return ch;
  }
  deoverlap(force?: boolean): boolean {
    if (this.gestures.drag || (!force && !this.state.ui.tidy) || this.state.paradigm === 'sequence') return false;
    const r = deoverlapNodes(this.state.nodes, id => this.footH(id), this.W);
    if (!r) return false;
    this.setState({ nodes: r });
    return true;
  }
  measure(): void {
    let ch = this.measureMax();
    for (const id in this.refs.nodes) { const el = this.refs.nodes[id]!.el; const h = el.offsetHeight; if (h && Math.abs((this.nodeH[id] || 0) - h) > 3) { this.nodeH[id] = h; ch = true; } }
    if (ch) this._zsafe = null;
    if (ch && !this._doq) { this._doq = requestAnimationFrame(() => { this._doq = 0; this.deoverlap(); }); }
    if (ch && !this._geoQ) { this._geoQ = true; requestAnimationFrame(() => { this._geoQ = false; this.setState(s => ({ geo: s.geo + 1 }), () => { if (this.fitPending) this.tryFit(); else if (!this.touched && (this._af = (this._af || 0) + 1) <= 2) this.fit(); }); }); }
    else if (this.fitPending) this.tryFit();
  }

  // ---- viewport ----
  dpr(): number { return window.devicePixelRatio || 1; }
  crisp(): boolean { return this.props.zoomSnap === 'crisp'; }
  crispK(k: number): number { return crispK(k, this.crisp(), this.dpr()); }
  crispStep(k: number, up: boolean): number { return crispStep(k, up, this.crisp(), this.dpr()); }
  zoomLevelOf(k: number): ZoomLevel { return zoomLevelOf(k, this.state.ui.semantic); }
  gridStyleFor(v: View): GridStyle { return gridStyleFor(v, this.props.grid && this.state.ui.grid, this.state.ui.semantic); }
  viewCss(v: View, live: boolean): ViewCss {
    if (this._zoomOk == null) this._zoomOk = !!(window.CSS && CSS.supports && CSS.supports('zoom', '1.5'));
    return viewCss(v, { live, zoomOk: this._zoomOk, smooth: this.props.zoomMode === 'smooth', zoomSafe: k => this.zoomSafe(k) });
  }
  zoomSafe(k: number): boolean {
    const key = k.toFixed(3) + '@' + this.dpr(), c = this._zsafe || (this._zsafe = new Map());
    const hit = c.get(key); if (hit !== undefined) return hit;
    const el = this.refs.view, ids = Object.keys(this.refs.nodes).filter(id => this.refs.nodes[id]!.el.isConnected).slice(0, 24);
    if (!el || !ids.length) return false;
    const st = el.style as CSSStyleDeclaration & { zoom: string };
    const z0 = st.zoom, t0 = st.transform, h = (id: string): number => this.refs.nodes[id]!.el.getBoundingClientRect().height / k;
    st.zoom = ''; st.transform = 'scale(' + k + ')';
    const a = ids.map(h);
    st.zoom = String(k); st.transform = '';
    const ok = ids.every((id, i) => Math.abs(h(id) - a[i]!) < 0.6);
    st.zoom = z0; st.transform = t0;
    if (c.size > 64) c.clear();
    c.set(key, ok); return ok;
  }
  applyViewDom(v: View, live: boolean): void {
    const R = this.refs;
    if (R.view) { const c = this.viewCss(v, live !== false); (R.view.style as CSSStyleDeclaration & { zoom: string }).zoom = c.zoom; R.view.style.transform = c.transform; }
    if (R.grid) { const g = this.gridStyleFor(v); R.grid.style.backgroundImage = g.backgroundImage || 'none'; R.grid.style.backgroundSize = g.backgroundSize || ''; R.grid.style.backgroundPosition = g.backgroundPosition || ''; }
    // crossing a density band changes node heights via CSS alone — re-measure so the
    // router stops solving against stale geometry (endpoints detaching from borders)
    if (R.canvas) {
      const z = this.zoomLevelOf(v.k);
      if (R.canvas.dataset['zoom'] !== z) {
        R.canvas.dataset['zoom'] = z;
        if (!this._zq) this._zq = requestAnimationFrame(() => { this._zq = 0; this.measure(); });
      }
    }
  }
  curView(): View { return this.gestures.tView || this.state.view; }
  commitView(): void {
    const g = this.gestures;
    if (g.tView) {
      let v = g.tView; g.tView = null;
      const k = this.crispK(v.k);
      // ladder snap pivots on the gesture's focal point, not the canvas centre — otherwise the
      // content slides under the cursor as it settles
      if (k !== v.k && this.refs.canvas) { const r = this.refs.canvas.getBoundingClientRect(), f = g.focal || { x: r.width / 2, y: r.height / 2 }; v = { k, x: f.x - (f.x - v.x) * k / v.k, y: f.y - (f.y - v.y) * k / v.k }; }
      this.setState({ view: v });
    }
    if (this.refs.view) { this.refs.view.style.willChange = ''; this.applyViewDom(this.curView(), false); }
  }
  canvasRect(): DOMRect | null { return this.refs.canvas ? this.refs.canvas.getBoundingClientRect() : null; }
  worldBox(): WorldBox | null {
    const s = this.state; if (s.nodes.length <= CULL_FROM) return null;
    const r = this.canvasRect(); if (!r) return null;
    return worldBox(s.view, r.width, r.height);
  }
  observeResize(el: HTMLElement): void {
    if (!window.ResizeObserver) return;
    let last = 0;
    // the work is deferred out of the observer callback: fitting from inside it re-lays out
    // the canvas mid-delivery, which is what raised "undelivered notifications"
    this.ro = new ResizeObserver(() => {
      if (this._roq) return;
      this._roq = requestAnimationFrame(() => {
        this._roq = 0;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        if (this.fitPending) { this.tryFit(); return; }
        const sig = Math.round(r.width) * 1e4 + Math.round(r.height);
        if (sig === last) return; last = sig;
        clearTimeout(this._rf); this._rf = window.setTimeout(() => { if (!this.touched) this.userFit(); }, 60);
      });
    });
    this.ro.observe(el);
  }
  // Panels overlay the canvas — the inspector on the right, findings on the left — so a
  // selection can land underneath either. Nudge the viewport just far enough to clear the
  // occluder, once per selection, and never so far that it hides behind the other panel.
  ensureClear(): void {
    const s = this.state.sel;
    if (!s) { this._clearedFor = null; return; }
    const key = s.kind + ':' + s.id;
    if (this._clearedFor === key || this.gestures.drag || this.gestures.pinch || !this.refs.canvas) return;
    const inspEl = this.refs.insp, findEl = this.refs.find;
    if (!inspEl && !findEl) return;
    let x0: number, x1: number;
    if (s.kind === 'node') { const n = this.nById[s.id]; if (!n) return; x0 = n.x; x1 = n.x + this.W; }
    else {
      const e = this.state.edges.find(x => x.id === s.id); if (!e) return;
      const geo = this.edgeGeom(e, null, null); if (!geo) return;
      x0 = Math.min(geo.p1[0], geo.p2[0]); x1 = Math.max(geo.p1[0], geo.p2[0]);
    }
    this._clearedFor = key;
    const r = this.refs.canvas.getBoundingClientRect(), v = this.state.view;
    const right = inspEl ? inspEl.getBoundingClientRect().left - r.left - 20 : r.width - 20;
    const left = findEl ? findEl.getBoundingClientRect().right - r.left + 20 : 20;
    const sx0 = x0 * v.k + v.x, sx1 = x1 * v.k + v.x;
    let dx = 0;
    if (sx1 > right) dx = -Math.min(sx1 - right, Math.max(0, sx0 - left));       // pan left
    else if (sx0 < left) dx = Math.min(left - sx0, Math.max(0, right - sx1));    // pan right
    if (Math.abs(dx) > 1) { this.gestures.tView = null; this.touched = true; this.setState({ view: { ...v, x: v.x + dx } }); }
  }
  toWorld(e: { clientX: number; clientY: number }): { x: number; y: number } { const r = this.refs.canvas!.getBoundingClientRect(), v = this.state.view; return { x: (e.clientX - r.left - v.x) / v.k, y: (e.clientY - r.top - v.y) / v.k }; }
  nodeAt(w: { x: number; y: number }, pad?: number): GraphNode | undefined { const p = pad == null ? 8 : pad; return this.state.nodes.find(n => w.x >= n.x - p && w.x <= n.x + this.W + p && w.y >= n.y - p && w.y <= n.y + (this.nodeH[n.id] || 88) + p); }
  snapPad(): number { return this.touch ? 34 : 24; }

  // ---- simulation: topology state never rerenders on a telemetry tick ----
  step(dt: number): void { try { this.stepInner(dt); } catch (err) { console.warn('[workbench] step failed', err); } }
  private stepInner(dt: number): void {
    if (this.fitPending) this.tryFit();
    const { nodes } = this.state; if (!nodes.length) return;
    if (!this.simState) this.simState = this.makeSimState();
    try { this.metrics = this.simTick(dt); } catch (err) { console.warn('[workbench] sim tick failed', err); return; }
    this.uptimeS += dt;
    const m = this.metrics;
    nodes.forEach(n => { const st = m.nodes[n.id]; if (!st) return; const a = this.nhist[n.id] || (this.nhist[n.id] = []); a.push(st.arr); if (a.length > 36) a.shift(); });
    if (!this.hadM) { this.hadM = true; this.setState({}); return; }
    try { this.patchTelemetry(); } catch (err) { console.warn('[workbench] telemetry patch skipped', err); }
  }
  private patchCtx(m: Metrics): PatchCtx {
    const s = this.state;
    return {
      paradigm: s.paradigm, mode: s.mode, rps: s.rps, rateUnit: this.T.HUD.rate, nodes: s.nodes, edges: s.edges, metrics: m, nhist: this.nhist, refs: this.refs,
      sel: s.sel, hoverEdge: s.hoverEdge, motion: this.props.motion, packets: hasPackets(s.paradigm), trace: s.ui.trace, drawerOpen: s.drawerOpen, hist: this.simState ? this.simState.hist : [], uptimeS: this.uptimeS,
      seqCursor: s.paradigm === 'sequence' ? (run: RunState) => this.seqCursorY(run) : null,
    };
  }
  private seqCursorY(run: RunState): number | null {
    const m = this.metrics; if (!m || !m.tl) return null;
    const g = this.seqGeo(), tl = m.tl, i = tl.msgs.findIndex(x => x.id === run.edge), row = this.SEQ.row;
    const msg = tl.msgs[i];
    return i >= 0 && msg ? g.y0 + i * row - row * 0.5 + (row * Math.min(1, ((run.cursor ?? 0) - msg.start) / Math.max(1, msg.end - msg.start))) : g.yEnd;
  }
  patchTelemetry(): void {
    const m = this.metrics; if (!m) return;
    patchTelemetry(this.patchCtx(m));
    // analyze reads rather than animates: rerender only when the finding set actually moves
    if (this.state.mode === 'analyze') {
      const a = this.analyze();
      const sig = a.list.map(f => f.key + '|' + f.sev + '|' + f.detail + '|' + f.rec).join('¬') + '|' + (a.a ? a.a.value : '') + '|' + (a.b ? a.b.value : '');
      const now = Date.now();
      if (sig !== this._fsig && now - (this._fAt || 0) > 900) { this._fsig = sig; this._fAt = now; this.setState({}); }
    }
  }
  patchEdgeDom(e: GraphEdge, ov: Overrides | null, ptr: Omit<Ptr, 'edge'> | null): void { const geo = this.edgeGeom(e, ov, ptr); if (geo) applyEdgeGeo(this.refs, e, geo, this.endsFor); }
  applyRoutes(rt: RouteMap): void { applyRoutes(this.refs, this.state.edges, rt, this.endsFor); }
  clearRuntimeDom(): void { clearRuntimeDom(this.refs); }
  resetSim(): void { this.simState = this.makeSimState(); this.metrics = null; this.nhist = {}; this.uptimeS = 0; this.hadM = false; this.setState({}); }
  stepOnce(): void { this.setState({ running: false }); this.step(0.25); }

  // ---- analysis ----
  analyze(): Analysis { const s = this.state; const a = analyzeAll(s.paradigm, s.nodes, s.edges, this.metrics, s.regions, s.rps); this.findings = a.list; return a; }
  pickFinding(f: Finding): void {
    if (this.state.focus && this.state.focus.key === f.key) { this.setState({ focus: null }); return; }
    const nodes: Record<string, 1> = {}, edges: Record<string, 1> = {}, keep: Record<string, 1> = {};
    if (f.nodeId) nodes[f.nodeId] = 1;
    (f.nodes || []).forEach(id => nodes[id] = 1);
    (f.edges || []).forEach(id => { edges[id] = 1; keep[id] = 1; const e = this.state.edges.find(x => x.id === id); if (e) { nodes[e.from] = 1; nodes[e.to] = 1; } });
    if (!f.edges.length && f.nodeId) this.state.edges.forEach(e => { if (e.from === f.nodeId || e.to === f.nodeId) { keep[e.id] = 1; nodes[e.from] = 1; nodes[e.to] = 1; } });
    this.state.edges.forEach(e => { if (nodes[e.from] && nodes[e.to]) keep[e.id] = 1; });
    this.setState({ focus: { key: f.key, nodes, edges, keep }, sel: f.nodeId ? { kind: 'node', id: f.nodeId } : null });
  }

  // ---- history / model ops ----
  snap(): void { this.history.snap(this.graph()); }
  /** a document-level transaction: graph + preset + load + clean mark, so one undo restores it all */
  snapDoc(): void { this.history.snap(this.docSnapshot()); }
  private docSnapshot(): Snapshot { const s = this.state; return { ...this.graph(), presetId: s.presetId, rps: s.rps, clean: this._cleanDoc, docId: s.docId, title: s.title }; }
  undo(): void { const g = this.history.undo(this.docSnapshot()); if (g) this.applySnapshot(g); }
  redo(): void { const g = this.history.redo(this.docSnapshot()); if (g) this.applySnapshot(g); }
  private applySnapshot(g: Snapshot): void {
    const { clean, ...rest } = g;
    // crossing a document boundary: the simulation clock, metrics and findings start over (run/pause persists)
    if (g.presetId !== undefined) { this.resetDocRuntime(); this._cleanDoc = clean ?? null; this.touched = false; }
    this.setState({ ...rest, sel: null, connect: null, rewire: null, hoverEdge: null, focus: null }, () => { if (g.presetId !== undefined) this.fitWhenReady(); });
  }
  /** a new document under the same paradigm: runtime DOM, sim clock, metrics, findings and routes all start over */
  private resetDocRuntime(): void {
    this.clearRuntimeDom();
    this.simState = this.makeSimState(); this.metrics = null; this.nhist = {}; this.hadM = false; this.uptimeS = 0; this.findings = []; this.planner.invalidate();
  }
  markClean(): void { this._cleanDoc = JSON.stringify(this.graph()); }
  /** edits since the document was loaded (undoing back to the loaded state makes it clean again) */
  get dirty(): boolean { return this._cleanDoc !== null && JSON.stringify(this.graph()) !== this._cleanDoc; }
  presetName(id: string): string { return id === 'blank' ? 'Blank' : EXAMPLES[this.state.paradigm].find(x => x.id === id)?.name ?? id; }
  /**
   * Presets replace the live document as ONE recoverable history transaction. A dirty document
   * asks first; cancelling changes nothing. An empty, never-edited document (first load, a new
   * paradigm) is opened fresh with no history.
   */
  loadPreset(id: string, confirmed = false): void {
    const pid = this.state.paradigm, s = this.state, p = id === 'blank' ? BLANK(pid) : EXAMPLES[pid].find(x => x.id === id); if (!p) return;
    const empty = !s.nodes.length && !s.edges.length && !s.regions.length;
    if (empty && !this.history.canUndo) { this.openPreset(id); return; }
    if (id === s.presetId && !this.dirty) return;
    if (this.dirty && !confirmed) {
      const n = s.nodes.length;
      this.setState({ palette: false, confirm: {
        title: id === s.presetId ? 'Reload ' + this.presetName(id) + '?' : 'Replace ' + this.presetName(s.presetId) + ' with ' + this.presetName(id) + '?',
        detail: 'Your edited document (' + n + ' ' + this.T.unitNoun + ') leaves the canvas. Undo brings it back.',
        ok: 'replace', run: () => this.loadPreset(id, true),
      } });
      return;
    }
    this.snapDoc();
    this.applyPreset(id, p);
  }
  /** open a preset with no history — the first document of a paradigm */
  openPreset(id: string): void {
    const pid = this.state.paradigm, p = id === 'blank' ? BLANK(pid) : EXAMPLES[pid].find(x => x.id === id); if (!p) return;
    this.history.reset();
    this.applyPreset(id, p);
  }
  private applyPreset(id: string, p: { nodes: GraphNode[]; edges: GraphEdge[]; regions?: GraphRegion[]; rps: number }): void {
    this.resetDocRuntime(); this.touched = false;
    this.setState({ presetId: id, docId: newDocumentId(), title: this.titleFor(id), nodes: p.nodes.map(n => ({ ...n })), edges: p.edges.map(e => ({ ...e })), regions: (p.regions || []).map(r => ({ ...r })), rps: p.rps, sel: null, connect: null, rewire: null, hoverEdge: null, focus: null, confirm: null }, () => this.fitWhenReady());
    this.markClean();
  }
  /** open the document a `#d=` share link carries, if there is one; a broken link says so */
  openLocation(): void {
    const payload = typeof location !== 'undefined' ? sharePayload(location.hash) : null;
    this._sharedPayload = payload;
    const doc = payload ? decodeDocument(payload) : null;
    if (doc) this.loadDocument(doc);
    else if (payload) this.notify('shared link could not be read · your document is unchanged', 'warn', 5000);
  }
  /**
   * Bring an exchange document (share link · import) onto the canvas. In the current paradigm it
   * is one undoable transaction; into another paradigm it replaces that paradigm's stored
   * document, which asks first when that document has content.
   */
  loadDocument(doc: GraphDocument, presetId: string = SHARED_PRESET, confirmed = false): void {
    const pid = doc.paradigm;
    if (pid !== this.state.paradigm) {
      const parked = this.docs[pid];
      if (parked && parked.nodes.length && !confirmed) {
        this.setState({ confirm: { title: 'Replace ' + (parked.title ?? this.titleFor(parked.presetId)) + '?', detail: 'The incoming ' + PARADIGMS[pid].label + ' document replaces your stored one (' + parked.nodes.length + ' ' + PARADIGMS[pid].unitNoun + '). Undo is not available across paradigms.', ok: 'replace', run: () => this.loadDocument(doc, presetId, true) } });
        return;
      }
      this.flushSave(); this.parkDoc(); this.docs[pid] = null; this.history.reset();
    } else if (this.state.nodes.length || this.state.edges.length || this.state.regions.length || this.history.canUndo) this.snapDoc();
    else this.history.reset();
    this.resetDocRuntime(); this.nodeH = {}; this.nodeHMax = {}; this._maxSig = null; this.touched = false;
    const rps = typeof doc.metadata.load === 'number' ? doc.metadata.load : BLANK(pid).rps;
    this.setState({
      paradigm: pid, presetId, docId: newDocumentId(), title: doc.title || this.titleFor(presetId, pid), nodes: doc.nodes.map(n => ({ ...n })), edges: doc.edges.map(e => ({ ...e })), regions: doc.regions.map(r => ({ ...r })), rps, view: { ...doc.view },
      sel: null, connect: null, rewire: null, hoverEdge: null, focus: null, paraOpen: false, createOpen: false, nextKind: null, search: '', collapsed: {}, confirm: null,
    });
    this.simState = this.makeSimState();
    this.markClean();
    this.fitWhenReady();
  }

  // ---- persistence: one named record per paradigm, autosaved, restored on mount ----
  private docSig(): DocSig { const s = this.state; return { paradigm: s.paradigm, nodes: s.nodes, edges: s.edges, regions: s.regions, rps: s.rps, view: s.view, title: s.title, presetId: s.presetId }; }
  private static sameContent(a: DocSig, b: DocSig | null): boolean { return !!b && a.paradigm === b.paradigm && a.nodes === b.nodes && a.edges === b.edges && a.regions === b.regions && a.rps === b.rps && a.title === b.title && a.presetId === b.presetId; }
  private static sameSig(a: DocSig, b: DocSig | null): boolean { return WorkbenchController.sameContent(a, b) && a.view === b!.view; }
  /**
   * Every store change: a new document signature arms the save debounce (once per change, so a
   * failed save does not retry itself). Content edits flip the visible state to dirty; a viewport
   * change only schedules — pan and zoom must never trigger a React render of their own.
   */
  private onStoreChange(): void {
    if (!this.state.ready || !this._savedSig) return;
    const sig = this.docSig();
    if (WorkbenchController.sameSig(sig, this._savedSig) || WorkbenchController.sameSig(sig, this._seenSig)) return;
    this._seenSig = sig;
    if (!WorkbenchController.sameContent(sig, this._savedSig) && this.state.save !== 'dirty') this.setState({ save: 'dirty' });
    clearTimeout(this._saveT); this._saveT = window.setTimeout(() => this.saveNow(), 600);
  }
  record(): StoredDocument { const s = this.state; return { schema: 1, id: s.docId, title: s.title, paradigm: s.paradigm, presetId: s.presetId, updatedAt: Date.now(), doc: docOf(s) }; }
  /** write the live document and the session; false (and a failed state) when the provider refuses */
  saveNow(): boolean {
    clearTimeout(this._saveT);
    if (!this.state.ready) return false;
    const sig = this.docSig();
    try {
      this.workspace.save(this.record()); this.workspace.saveSession(this.state.paradigm);
      this._savedSig = sig; this._seenSig = sig;
      if (this.state.save !== 'saved' && this.state.save !== 'clean') this.setState({ save: 'saved' }); // a viewport-only save is silent
      return true;
    } catch (e) {
      this.setState({ save: 'failed' });
      this.notify('save failed · ' + (e instanceof Error ? e.message : String(e)) + ' — your edits are still on the canvas', 'warn', 6000);
      return false;
    }
  }
  flushSave(): void { if (this.state.save === 'dirty' || this.state.save === 'failed') this.saveNow(); }
  retrySave(): void { if (this.saveNow()) this.notify('saved'); }
  setTitle(title: string): void { this.setState({ title }); }
  titleFor(presetId: string, pid: ParadigmId = this.state.paradigm): string { return presetId === 'blank' ? 'Untitled ' + PARADIGMS[pid].label : presetId === SHARED_PRESET ? 'Shared ' + PARADIGMS[pid].label : EXAMPLES[pid].find(x => x.id === presetId)?.name ?? presetId; }
  /** put the stored workspace on the canvas; returns the paradigms whose records could not be read */
  restoreSession(): Array<{ pid: ParadigmId; reason: string }> {
    const invalid: Array<{ pid: ParadigmId; reason: string }> = [];
    const session = this.workspace.loadSession(), active = session?.active ?? this.state.paradigm;
    const results: Partial<Record<ParadigmId, LoadResult>> = {};
    for (const pid of this.workspace.stored()) {
      const r = results[pid] = this.workspace.load(pid);
      if (r.kind === 'invalid') invalid.push({ pid, reason: r.reason });
      else if (r.kind === 'ok' && r.recovered) this.notify(r.recovered === 'interrupted' ? 'recovered an interrupted save of ' + r.record.title : 'restored the last good save of ' + r.record.title, 'warn', 6000);
    }
    for (const pid of ORDER) {
      const r = results[pid]; if (!r || r.kind !== 'ok' || pid === active) continue;
      const d = r.record.doc;
      this.docs[pid] = { nodes: d.nodes, edges: d.edges, regions: d.regions, rps: typeof d.metadata.load === 'number' ? d.metadata.load : BLANK(pid).rps, presetId: r.record.presetId, view: d.view, touched: false, hist: [], future: [], clean: JSON.stringify({ nodes: d.nodes, edges: d.edges, regions: d.regions }), docId: r.record.id, title: r.record.title };
    }
    if (active !== this.state.paradigm) { this.setState({ paradigm: active }); this.simState = this.makeSimState(); }
    const r = results[active];
    if (r && r.kind === 'ok') this.applyRecord(r.record);
    else this.openPreset(EXAMPLES[active][0]!.id);
    return invalid;
  }
  private applyRecord(rec: StoredDocument): void {
    const d = rec.doc;
    this.history.reset(); this.resetDocRuntime(); this.touched = false;
    this.setState({ presetId: rec.presetId, docId: rec.id, title: rec.title, nodes: d.nodes, edges: d.edges, regions: d.regions, rps: typeof d.metadata.load === 'number' ? d.metadata.load : BLANK(rec.paradigm).rps, view: { ...d.view }, sel: null, connect: null, rewire: null, hoverEdge: null, focus: null }, () => this.fitWhenReady());
    this.markClean();
  }
  private recoveryDialog(pid: ParadigmId, reason: string): void {
    this.setState({ confirm: {
      title: 'Stored ' + PARADIGMS[pid].label + ' document could not be read',
      detail: reason + '. The unreadable copy is kept until the next save — export it now if you want to keep it. The canvas shows the example instead.',
      ok: 'continue', run: () => { /* the example is already on the canvas */ },
      alt: { label: 'export unreadable copy', run: () => this.download(this.workspace.broken(pid) ?? '', PARADIGMS[pid].label + '-unreadable.json') },
    } });
  }
  /** the live document as exchange JSON */
  exportText(): string { return JSON.stringify(docOf(this.state), null, 2); }
  exportDoc(): void { this.download(this.exportText(), (this.state.title || 'workbench').replace(/[^\w.-]+/g, '-').toLowerCase() + '.workbench.json'); this.notify('exported ' + this.state.title); }
  private download(text: string, name: string): void {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') { this.notify('download is not available here', 'warn'); return; }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  /** import exchange JSON; migrations run, garbage is refused with a toast and nothing changes */
  importText(text: string, name = 'document'): boolean {
    let doc: GraphDocument;
    try { doc = migrate(JSON.parse(text), { familyOfAlias: familyOfGk }); }
    catch (e) { this.notify('could not import ' + name + ' · ' + (e instanceof Error ? e.message : 'not a workbench document'), 'warn', 6000); return false; }
    this.loadDocument(doc, 'import');
    this.notify('imported ' + (doc.title || name));
    return true;
  }
  /** open a file picker for a .json document */
  importDoc(): void {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = () => { const f = input.files?.[0]; if (!f) return; void f.text().then(t => this.importText(t, f.name)); };
    input.click();
  }
  /** share: the document becomes the URL fragment, the link goes to the clipboard, and a toast says which */
  async share(): Promise<boolean> {
    const s = this.state, url = shareUrl(s, location);
    history.replaceState(null, '', url);
    this._sharedPayload = sharePayload(location.hash);
    const what = s.nodes.length + ' ' + this.T.unitNoun + ' · ' + s.edges.length + ' ' + this.T.edgeNoun;
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      this.notify('link copied · ' + what);
      return true;
    } catch {
      this.notify('link is in the address bar · copy it to share ' + what, 'warn', 5000);
      return false;
    }
  }
  notify(text: string, tone: Toast['tone'] = 'ok', ms = 2800): void {
    clearTimeout(this._toastT);
    const toast: Toast = { text, tone };
    this.setState({ toast });
    this._toastT = window.setTimeout(() => { if (this.state.toast === toast) this.setState({ toast: null }); }, ms);
  }
  // A pending-fit latch: stays armed until the canvas has a real box AND every node has a
  // measured height. Cleared only by an actual fit, so it cannot be dropped on a timing race.
  fitWhenReady(): void {
    this.fitPending = true; this._af = 0;
    if (this._fitRaf) return;
    const pump = (): void => {
      this._fitRaf = 0;
      if (!this.fitPending || this.touched) { this.fitPending = false; return; }
      this.tryFit();
      if (this.fitPending) this._fitRaf = requestAnimationFrame(pump);
    };
    this._fitRaf = requestAnimationFrame(pump);
  }
  tryFit(): void {
    if (!this.fitPending || !this.refs.canvas) return;
    const r = this.refs.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (!this.state.nodes.length) return;
    const missing = this.state.nodes.filter(x => !this.nodeH[x.id]);
    // heights arrive via measure(); read them directly here so the latch never waits on a render
    if (missing.length) { missing.forEach(x => { const el = this.refs.nodeEl(x.id); if (el && el.offsetHeight) this.nodeH[x.id] = el.offsetHeight; }); if (this.state.nodes.some(x => !this.nodeH[x.id])) return; }
    this.fitPending = false;
    this.fit();
  }
  userFit(): void { this._af = 0; this.fit(); }
  docBounds(): { x0: number; y0: number; x1: number; y1: number } {
    const s = this.state;
    return docBounds({ nodes: s.nodes, regions: s.regions, paradigm: s.paradigm, W: this.W, footH: id => this.footH(id), seq: s.paradigm === 'sequence' ? this.seqGeo() : null });
  }
  fit(): void {
    const { nodes } = this.state; if (!nodes.length || !this.refs.canvas) return;
    const r = this.refs.canvas.getBoundingClientRect();
    if (!r.width || !r.height) { this.fitPending = true; return; }
    this.gestures.tView = null; this.touched = false;
    this.setState({ view: fitView(this.docBounds(), r) });
  }
  zoomBy(f: number): void {
    this.touched = true;
    const r = this.refs.canvas!.getBoundingClientRect(), v = this.curView();
    const k = this.crispStep(v.k, f > 1);
    this.gestures.tView = null;
    this.setState({ view: zoomCentred(v, k, r) });
  }
  resetZoom(): void { this.gestures.tView = null; this.setState(s => ({ view: { ...s.view, k: 1 } })); }
  deleteSel(): void {
    const { sel, nodes, edges } = this.state; if (!sel) return;
    this.snap();
    if (sel.kind === 'node') this.setState({ nodes: nodes.filter(n => n.id !== sel.id), edges: edges.filter(e => e.from !== sel.id && e.to !== sel.id), sel: null });
    else if (sel.kind === 'region') this.deleteLane(sel.id);
    else this.setState({ edges: edges.filter(e => e.id !== sel.id), sel: null, hoverEdge: null });
  }
  // ---- lanes: structural owners ----
  lanes(): GraphRegion[] { return lanesPure(this.state.regions); }
  laneOf(n: GraphNode): GraphRegion | null { return laneOfPure(n, this.state.regions); }
  laneMembers(id: string): GraphNode[] { return laneMembersPure(id, this.state.nodes, this.state.regions); }
  fitLanes(regions: GraphRegion[], nodes: GraphNode[], movedId?: string): { regions: GraphRegion[]; nodes: GraphNode[] } {
    // current rendered card height (design mode), never the tallest-density reserve
    return fitLanesPure(this.state.paradigm, this.state.nodes, regions, nodes, movedId, n => this.nodeH[n.id] || 88);
  }
  addLane(): void {
    if (this.state.paradigm !== 'workflow') return;
    const ls = this.lanes(), last = ls[ls.length - 1];
    const FAM = ['indigo', 'cyan', 'amber', 'purple', 'emerald', 'orange'] as const;
    const id = laneId(), n = ls.length + 1;
    const lane: GraphRegion = { id, variant: 'lane', label: (n < 10 ? '0' : '') + n + ' / new lane', family: FAM[ls.length % FAM.length]!, x: last ? last.x : 16, y: last ? last.y + last.h : 48, w: last ? last.w : 2064, h: 176, owner: '', ownerKind: 'team' };
    this.snap(); this._focusLane = 'name';
    this.setState({ regions: [...(this.state.regions || []), lane], sel: { kind: 'region', id }, palette: false });
  }
  takeLaneFocus(): 'name' | 'owner' | null { const f = this._focusLane; this._focusLane = null; return f; }
  updLane(id: string, patch: Partial<GraphRegion>): void { this.setState({ regions: this.state.regions.map(r => r.id === id ? { ...r, ...patch } : r) }); }
  moveLane(id: string, dir: 1 | -1): void {
    const ls = this.lanes(), i = ls.findIndex(l => l.id === id), j = i + dir; if (i < 0 || j < 0 || j >= ls.length) return;
    this.snap();
    // swap band order by giving the two lanes each other's y, then restack carries the steps
    const a = ls[i]!, b = ls[j]!, ya = a.y, yb = b.y;
    const swapped = this.state.regions.map(r => r.id === a.id ? { ...r, y: dir > 0 ? ya + b.h : yb } : r.id === b.id ? { ...r, y: dir > 0 ? ya : yb + a.h } : r);
    // move members with their lane before restacking so geometry stays consistent
    const memA = this.laneMembers(a.id).map(n => n.id), memB = this.laneMembers(b.id).map(n => n.id);
    const dA = (dir > 0 ? ya + b.h : yb) - ya, dB = (dir > 0 ? ya : yb + a.h) - yb;
    const nodes = this.state.nodes.map(n => memA.includes(n.id) ? { ...n, y: n.y + dA } : memB.includes(n.id) ? { ...n, y: n.y + dB } : n);
    const r = this.fitLanes(swapped, nodes);
    this.setState({ regions: r.regions, nodes: r.nodes });
  }
  deleteLane(id: string): void {
    const regions = this.state.regions.filter(r => r.id !== id);
    const r = this.fitLanes(regions, this.state.nodes);
    this.setState({ regions: r.regions, nodes: r.nodes, sel: null });
  }
  handoffs(): ReturnType<typeof handoffs> { const s = this.state; return handoffs(s.nodes, s.edges, s.regions); }
  delEdge(id: string): void { this.snap(); this.setState({ edges: this.state.edges.filter(e => e.id !== id), sel: null, hoverEdge: null }); }
  flipEdge(id: string): void { this.snap(); this.setState({ edges: this.state.edges.map(e => e.id === id ? { ...e, from: e.to, to: e.from } : e) }); }
  setEnd(id: string, end: 'from' | 'to', val: string): void { this.snap(); this.setState({ edges: this.state.edges.map(e => e.id === id ? { ...e, [end]: val } : e) }); }
  addNode(type: string): void {
    const r = this.refs.canvas!.getBoundingClientRect(); const { view, nodes } = this.state;
    const cx = (r.width / 2 - view.x) / view.k - this.W / 2, cy = (r.height / 2 - view.y) / view.k - 40;
    const t = this.T.TYPES[type]; if (!t) return;
    const cnt = nodes.filter(n => n.type === type).length;
    const id = nodeId(type);
    const G = 16, H = 88;
    let px = Math.round(cx / G) * G, py = Math.round(cy / G) * G;
    if (this.state.paradigm === 'sequence') { px = nodes.length ? Math.max(...nodes.map(n => n.x)) + this.W + 40 : 48; py = nodes.length ? nodes[0]!.y : 48; }
    const free = (x: number, y: number): boolean => !nodes.some(n => Math.abs(n.x - x) < this.W - 8 && y < n.y + this.footH(n.id) + 24 && y + H + 24 > n.y);
    for (let i = 0; i < 60 && !free(px, py); i++) { py += G * 2; if (i % 12 === 11) { px += this.W + 48; py = Math.round(cy / G) * G; } }
    this.snap();
    this.setState({ nodes: [...nodes, { id, type, name: t.label + (cnt ? ' ' + (cnt + 1) : ''), x: px, y: py, ...nodeDefaults(this.state.paradigm, type) }], sel: { kind: 'node', id }, palette: false });
  }
  addEdge(from: string, to: string, kind: string): void {
    this.snap();
    const ne: GraphEdge = { id: newEdgeId(), from, to, ...edgeDefaults(this.state.paradigm, kind) };
    if (this.state.paradigm === 'sequence') ne.seq = this.state.edges.length + 1;
    this.setState({ edges: [...this.state.edges, ne], connect: null, nextKind: null });
  }
  addPhase(): void {
    const msgs = this.seqMsgs(); if (!msgs.length) return;
    const ph = (this.state.regions || []).filter(r => r.variant === 'phase');
    const from = ph.length ? Math.max(...ph.map(r => r.to || 0)) + 1 : 1; if (from > msgs.length) return;
    this.snap();
    this.setState({ regions: [...this.state.regions, { id: phaseId(), variant: 'phase', label: 'phase ' + (ph.length + 1), family: 'stone', x: 0, y: 0, w: 0, h: 0, from, to: msgs.length }] });
  }
  updField(f: Field, raw: string | boolean): void {
    const { sel } = this.state; if (!sel) return;
    let v: string | number;
    if (f.kind === 'number') { v = parseFloat(String(raw)); if (isNaN(v)) v = f.min != null ? f.min : 0; if (f.min != null) v = Math.max(f.min, v); if (f.max != null) v = Math.min(f.max, v); }
    else if (f.kind === 'check') v = raw === true || raw === 'true' ? 1 : 0;
    else v = String(raw);
    if (sel.kind === 'node') this.setState({ nodes: this.state.nodes.map(n => n.id === sel.id ? { ...n, [f.key]: v } : n) });
    else this.setState({ edges: this.state.edges.map(e => e.id === sel.id ? { ...e, [f.key]: v } : e) });
  }
  fieldsFor(schema: Field[], obj: Record<string, unknown>): InspectorField[] {
    const T = this.T;
    return schema.map(f => {
      const base: InspectorField = { key: f.key, label: f.label, half: f.half ? '1' : null, isText: f.kind === 'text', isNum: f.kind === 'number', isSel: f.kind === 'select', isCheck: f.kind === 'check', ph: f.ph || '', min: f.min, max: f.max, step: f.step, value: '', checked: false, options: [], onChange: v => this.updField(f, v) };
      const cur = obj[f.key];
      if (f.kind === 'check') base.checked = !!cur;
      else if (f.kind === 'select') { base.value = String(cur ?? ''); base.options = Object.keys(T.EDGES).map(k => ({ v: k, l: T.EDGES[k]!.label + ' · ' + T.EDGES[k]!.desc })); }
      else base.value = cur == null ? '' : (f.kind === 'number' && typeof cur === 'number' && cur >= 1e9 ? '' : (cur as string | number));
      return base;
    });
  }
  markHint(k: string): void {
    if (!this.hintsDone || this.hintsDone[k]) return;
    this.hintsDone[k] = 1;
    try { localStorage.setItem('wb.hintsDone', JSON.stringify(this.hintsDone)); } catch { /* storage unavailable */ }
    this.setState({});
  }
  // keyboard: arrows step through nodes in reading order; in a sequence ↑/↓ step through messages in time order
  moveSel(key: string): void {
    const s = this.state, sel = s.sel;
    if (s.paradigm === 'sequence' && (key === 'ArrowUp' || key === 'ArrowDown')) {
      const msgs = this.seqMsgs(); if (!msgs.length) return;
      let i = sel && sel.kind === 'edge' ? msgs.findIndex(m => m.id === sel.id) : -1;
      i = key === 'ArrowDown' ? Math.min(msgs.length - 1, i + 1) : Math.max(0, i - 1);
      this.setState({ sel: { kind: 'edge', id: msgs[i]!.id } }); return;
    }
    const ns = s.nodes.slice().sort((a, b) => (key === 'ArrowUp' || key === 'ArrowDown') ? (a.y - b.y || a.x - b.x) : (a.x - b.x || a.y - b.y)); if (!ns.length) return;
    let i = sel && sel.kind === 'node' ? ns.findIndex(n => n.id === sel.id) : -1;
    i = (key === 'ArrowRight' || key === 'ArrowDown') ? Math.min(ns.length - 1, i + 1) : Math.max(0, i - 1);
    this.setState({ sel: { kind: 'node', id: ns[i]!.id } });
  }
  select(sel: Selection | null): void { this.setState({ sel }); }
  openPalette(): void { this.setState({ palette: true, pq: '', pi: 0 }); }
  paletteItems(): PaletteItem[] {
    const s = this.state, q = s.pq.toLowerCase(), all: PaletteItem[] = [];
    (['design', 'simulate', 'analyze'] as Mode[]).forEach(mo => all.push({ label: mo + ' mode', hint: 'mode', run: () => { this.setMode(mo); this.setState({ palette: false }); } }));
    ORDER.forEach(pid => { if (pid !== s.paradigm) all.push({ label: 'change diagram type · ' + PARADIGMS[pid].label, hint: 'paradigm', run: () => this.switchParadigm(pid) }); });
    all.push({ label: 'create diagram…', hint: 'n', run: () => this.setState({ createOpen: true, palette: false }) });
    EXAMPLES[s.paradigm].forEach(p => all.push({ label: 'load example · ' + p.name.toLowerCase(), hint: 'example', run: () => { this.loadPreset(p.id); this.setState({ palette: false }); } }));
    if (s.paradigm === 'workflow') all.push({ label: '+ lane', hint: 'owner', run: () => this.addLane() });
    all.push({ label: 'export document · json', hint: 'file', run: () => { this.exportDoc(); this.setState({ palette: false }); } });
    all.push({ label: 'import document · json', hint: 'file', run: () => { this.setState({ palette: false }); this.importDoc(); } });
    all.push({ label: 'save now', hint: 'file', run: () => { this.retrySave(); this.setState({ palette: false }); } });
    all.push({ label: 'auto layout', hint: 'l', run: () => { this.autoLayout(); this.setState({ palette: false }); } });
    all.push({ label: (s.ui.trace ? 'hide' : 'show') + ' execution trace', hint: 't', run: () => { this.setUi('trace'); this.setState({ palette: false }); } });
    all.push({ label: this.th() === 'dark' ? 'switch to light mode' : 'switch to dark mode', hint: 'd', run: () => this.setState({ theme: this.th() === 'dark' ? 'light' : 'dark', palette: false }) });
    all.push({ label: s.running ? 'pause simulation' : 'run simulation', hint: 'r', run: () => this.setState({ running: !s.running, palette: false }) });
    all.push({ label: 'reset metrics', hint: 'sim', run: () => { this.resetSim(); this.setState({ palette: false }); } });
    all.push({ label: 'tidy overlapping nodes', hint: 'layout', run: () => { this.snap(); this.deoverlap(true); this.setState({ palette: false }); } });
    all.push({ label: 'fit canvas', hint: 'f', run: () => { this.userFit(); this.setState({ palette: false }); } });
    all.push({ label: s.libOpen ? 'hide library' : 'show library', hint: 'panel', run: () => this.setState({ libOpen: !s.libOpen, palette: false }) });
    all.push({ label: 'toggle telemetry drawer', hint: 'drawer', run: () => this.setState({ drawerOpen: !s.drawerOpen, palette: false }) });
    UIOPTS.forEach(([k, label]) => all.push({ label: (s.ui[k] ? 'hide ' : 'show ') + label, hint: 'setting', run: () => { this.setUi(k); this.setState({ palette: false }); } }));
    const T = this.T;
    Object.keys(T.TYPES).forEach(t => all.push({ label: '+ ' + T.TYPES[t]!.label.toLowerCase(), hint: (T.CATS[T.TYPES[t]!.cat]?.label ?? '').toLowerCase(), run: () => this.addNode(t) }));
    return q ? all.filter(i => i.label.toLowerCase().includes(q)) : all;
  }

  // ---- edge card lifecycle: placed ONCE on hover intent, then pinned. It stays while the pointer
  // travels toward it (canvas keep-alive in gestures) and closes on another edge, a click, Esc,
  // or after the pointer has been away from both edge and card. ----
  edgeEnter(id: string): void {
    if (this.gestures.drag) return;
    clearTimeout(this._hoverOff); clearTimeout(this._hoverOn);
    if (this.state.hoverEdge === id) return;
    this._hoverOn = window.setTimeout(() => { if (!this.gestures.drag) { this.cardFor = null; this.cardPos = null; this.setState({ hoverEdge: id }); } }, 80);
  }
  edgeLeave(id: string): void {
    clearTimeout(this._hoverOn); clearTimeout(this._hoverOff);
    this._hoverOff = window.setTimeout(() => { if (this.state.hoverEdge === id && !this.gestures.drag) this.closeCard(); }, 700);
  }
  keepCardAlive(): void { clearTimeout(this._hoverOff); }
  closeCard(clearHover = true): void { clearTimeout(this._hoverOn); clearTimeout(this._hoverOff); this.cardFor = null; this.cardPos = null; if (clearHover && this.state.hoverEdge) this.setState({ hoverEdge: null }); }
  edgeMove(_id: string, e: { clientX: number; clientY: number }): void {
    if (this.gestures.drag || !this.refs.canvas) return;
    const r = this.refs.canvas.getBoundingClientRect();
    this.hoverPtr = { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  placeCard(w: number, h: number): { left: number; top: number } | null {
    const pt = this.hoverPtr; if (!pt) return null;
    const gap = 22;
    let hx = 1, vy = -1;
    if (pt.x + gap + w > pt.w - 10) hx = -1;
    if (pt.x - gap - w < 10) hx = 1;
    if (pt.y - gap - h < 8) vy = 1;
    if (pt.y + gap + h > pt.h - 8) vy = -1;
    const left = Math.max(8, Math.min(Math.max(8, pt.w - w - 8), hx > 0 ? pt.x + gap : pt.x - gap - w));
    const top = Math.max(8, Math.min(Math.max(8, pt.h - h - 8), vy > 0 ? pt.y + gap : pt.y - gap - h));
    return { left, top };
  }
  /** the card for the hovered/selected edge — position computed once per edge, never chased on later renders */
  edgeCard(ce: GraphEdge, geo: EdgeGeo): EdgeCardVM {
    const s = this.state, m = this.metrics, v = s.view, by = this.nById;
    const rate = m ? m.edges[ce.id] || 0 : 0;
    const fromName = by[ce.from]?.name ?? '', toName = by[ce.to]?.name ?? '';
    const tx = this.T.structured ? this.transitionText(ce) : '';
    const protoTxt = tx ? tx + (s.mode !== 'design' && rate > 0.5 ? ' · ' + fmt(rate) + this.T.HUD.rate : '') : rateText(s.paradigm, s.mode, ce, rate);
    const estW = 150 + Math.min(30, fromName.length + toName.length) * 7.2 + Math.min(34, protoTxt.length) * 6.6;
    if (this.cardFor !== ce.id || !this.cardPos) {
      this.cardPos = this.placeCard(estW, 34) || { left: geo.lx * v.k + v.x - estW / 2, top: geo.ly * v.k + v.y - 52 };
      this.cardFor = ce.id;
    }
    return { fromName, toName, proto: protoTxt, left: this.cardPos.left, top: this.cardPos.top };
  }
}

/** test/perf hook: replace the current document with a generated topology at the given scale */
export function loadStress(ctl: WorkbenchController, pid: ParadigmId, nodes: number, edges: number): void {
  if (pid !== ctl.state.paradigm) { ctl.switchParadigm(pid); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit(); }
  const d = stressDoc(pid, nodes, edges, ctl.W);
  ctl.clearRuntimeDom(); ctl.simState = ctl.makeSimState(); ctl.metrics = null; ctl.nhist = {}; ctl.history.reset(); ctl.planner.invalidate(); ctl.hadM = false; ctl.uptimeS = 0;
  ctl.setState({ presetId: 'stress', nodes: d.nodes, edges: d.edges, regions: d.regions, rps: d.rps, sel: null, connect: null, rewire: null, hoverEdge: null, focus: null }, () => ctl.fitWhenReady());
}
