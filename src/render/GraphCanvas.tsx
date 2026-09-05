// The canvas: one grid layer, ONE transformed viewport (regions → edge layer → nodes → endpoint
// overlay), and whatever chrome the app floats over it as children. Pan/zoom writes transform
// on the viewport element and nothing else re-renders.
import type { CSSProperties, ReactNode } from 'react';
import { EdgeMarkerDefs } from './EdgeMarkerDefs';
import { EdgeView } from './GraphEdge';
import { NodeView } from './GraphNode';
import { RegionView } from './GraphRegion';
import { EndpointHandles } from './EndpointHandles';
import { SequenceLayer } from './SequenceLayer';
import { TierBand } from './TierBand';
import type { CanvasVM, Handlers } from './types';

const ROOT: CSSProperties = { flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0, backgroundImage: 'none' };
const LAYER: CSSProperties = { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' };
const GRID_BASE: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };

export function GraphCanvas({ vm, h, children }: { vm: CanvasVM; h: Handlers; children?: ReactNode }) {
  const a = vm.attrs;
  const viewStyle: CSSProperties = { position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', zoom: vm.viewStyle.zoom, transform: vm.viewStyle.transform } as CSSProperties;
  return (
    <div
      ref={h.setCanvasEl}
      className="tg-gcanvas"
      data-paradigm={a.paradigm}
      data-layer-trace={a.trace}
      data-touch={a.touch}
      data-zoom={a.zoom}
      data-mode={a.mode}
      data-o-labels={a.oLabels}
      data-o-rates={a.oRates}
      data-o-packets={a.oPackets}
      data-o-spark={a.oSpark}
      data-o-chan={a.oChan}
      data-chan={a.chan}
      onPointerDown={h.onBgDown}
      style={ROOT}
    >
      <div ref={h.setGridEl} style={{ ...GRID_BASE, ...vm.gridStyle }} />
      <div ref={h.setViewEl} style={viewStyle}>
        {vm.tiers.map(g => <TierBand key={g.id} g={g} />)}
        {vm.regions.map(r => <RegionView key={r.id} r={r} h={h} />)}
        <svg className="wb-elayer" width="10" height="10" style={LAYER}>
          <EdgeMarkerDefs />
          {vm.chanGuides.map((g, i) => <line key={i} className="wb-chan" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />)}
          {vm.seq ? <SequenceLayer s={vm.seq} h={h} /> : null}
          {vm.edges.map(e => <EdgeView key={e.id} e={e} h={h} />)}
          {vm.hasConnect ? <path className="tg-edge" data-state="preview" ref={h.setConnectEl} d="" style={{ pointerEvents: 'none' }} /> : null}
        </svg>
        {vm.nodes.map(n => <NodeView key={n.id} n={n} h={h} />)}
        {vm.ends ? <EndpointHandles ends={vm.ends} h={h} /> : null}
      </div>
      {children}
    </div>
  );
}
