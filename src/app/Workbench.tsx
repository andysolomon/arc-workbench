// Workbench root: subscribes to the store, builds the canvas view model, floats the chrome over
// the canvas, and runs the prototype's lifecycle (mount · didUpdate · unmount).
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { CommandPalette, CreateDialog, EdgeCard, Findings, Header, Hints, Inspector, Library, Strip, Toast, ZoomControl } from '../chrome';
import { GraphCanvas } from '../render';
import { useStore } from '../store';
import { WorkbenchController } from './controller';
import type { WorkbenchProps } from './props';
import { buildCanvasVM, tiersOf } from './viewModel';

export function Workbench({ controller, ...props }: WorkbenchProps & { controller?: WorkbenchController }) {
  const ctl = useMemo(() => controller ?? new WorkbenchController(props), [controller]); // eslint-disable-line react-hooks/exhaustive-deps -- props are read once, like DC props
  const s = useStore(ctl.store);
  useEffect(() => { ctl.mount(); return () => ctl.unmount(); }, [ctl]);
  useLayoutEffect(() => { ctl.didUpdate(); });

  const v = s.view, zl = ctl.zoomLevelOf(v.k);
  // the modes are density layers over one canvas: design strips telemetry back to
  // drafting, simulate adds it, analyze lays findings on top of the same drawing.
  const an = s.mode === 'analyze' ? ctl.analyze() : null;
  const routes = ctl.routes(null, null);
  const seq = s.paradigm === 'sequence' ? ctl.seqGeo() : null;
  const footH = (id: string): number => ctl.footH(id);
  const vm = buildCanvasVM({
    paradigm: s.paradigm, mode: s.mode, nodes: s.nodes, edges: s.edges, regions: s.regions, view: v, rps: s.rps, nodeH: ctl.nodeH, footH, zoomLevel: zl,
    metrics: ctl.metrics, nhist: ctl.nhist, sel: s.sel, hoverEdge: s.hoverEdge, rewire: s.rewire, connect: s.connect, connectInvalid: ctl.connectInvalid,
    focus: s.focus, findings: an ? an.list : [], routes, chans: ctl.planner.chans, seq,
    ui: { pixel: ctl.props.pixelFill && s.ui.pixel, tiers: s.ui.tiers, packets: s.ui.packets, channels: s.ui.channels, trace: s.ui.trace, labels: s.ui.labels, rates: s.ui.rates, spark: s.ui.spark, semantic: s.ui.semantic },
    motion: ctl.props.motion, touch: ctl.touch, rect: null, worldBox: ctl.worldBox(), chanGap: ctl.props.channelGap,
    viewStyle: ctl.viewCss(v, false), gridStyle: ctl.gridStyleFor(v),
  });
  ctl.endsFor = vm.ends ? vm.ends.edgeId : null;
  const card = s.ui.edgeCard && vm.cardEdge && vm.cardGeo ? ctl.edgeCard(vm.cardEdge, vm.cardGeo) : null;
  const linked: Record<string, 1> = {}; s.edges.forEach(e => { linked[e.from] = 1; linked[e.to] = 1; });
  const unlinked = s.nodes.filter(n => !linked[n.id]).length;
  const tierCount = s.paradigm === 'architecture' ? tiersOf(s.paradigm, s.nodes, footH).length : vm.regions.length;
  const showHints = s.ui.hints && s.mode !== 'analyze';
  return (
    <div data-screen-label="Workbench" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--surface-page)', color: 'var(--text-body)', fontFamily: 'var(--font-mono)', fontSize: '11px', userSelect: 'none' }}>
      <Header ctl={ctl} tierCount={tierCount} unlinked={unlinked} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {s.libOpen ? <Library ctl={ctl} /> : null}
        <div style={{ flex: 1, position: 'relative', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <GraphCanvas vm={vm} h={ctl.handlers}>
            {showHints ? <Hints ctl={ctl} /> : null}
            {an ? <Findings ctl={ctl} an={an} /> : null}
            {card && vm.cardEdge ? <EdgeCard ctl={ctl} e={vm.cardEdge} vm={card} /> : null}
            <div data-chrome="1" style={{ position: 'absolute', right: '16px', bottom: '16px' }}>
              <ZoomControl value={Math.round(v.k * 100)} onZoomIn={() => ctl.zoomBy(1.1)} onZoomOut={() => ctl.zoomBy(0.9)} onReset={() => ctl.resetZoom()} onFit={() => ctl.userFit()} />
            </div>
            <Inspector ctl={ctl} />
            <Toast ctl={ctl} />
          </GraphCanvas>
          <Strip ctl={ctl} />
        </div>
      </div>
      {s.createOpen ? <CreateDialog ctl={ctl} /> : null}
      {s.palette ? <CommandPalette ctl={ctl} /> : null}
    </div>
  );
}
