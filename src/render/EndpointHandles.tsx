// Endpoint handles live in an overlay ABOVE the nodes so they always beat node ports to the
// pointer; screen-constant size (already divided by k), enlarged and filled once selected.
import type { CSSProperties } from 'react';
import type { EndsVM, Handlers } from './types';

const OVER: CSSProperties = { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' };
const GRAB: CSSProperties = { fill: 'transparent', pointerEvents: 'all', cursor: 'grab' };
export function EndpointHandles({ ends, h }: { ends: EndsVM; h: Handlers }) {
  const dot: CSSProperties = { fill: ends.isSel ? 'var(--selection)' : 'var(--surface-card)', stroke: 'var(--selection)', strokeWidth: ends.strokeWidth, pointerEvents: 'none' };
  return (
    <svg ref={h.setEndsEl} width="10" height="10" style={OVER}>
      <circle data-t="endfh" cx={ends.x1} cy={ends.y1} r={ends.hr} onPointerDown={e => h.onGrabEnd(ends.edgeId, 'from', e)} style={GRAB} />
      <circle data-t="endth" cx={ends.x2} cy={ends.y2} r={ends.hr} onPointerDown={e => h.onGrabEnd(ends.edgeId, 'to', e)} style={GRAB} />
      <circle data-t="endf" cx={ends.x1} cy={ends.y1} r={ends.vr} style={dot} />
      <circle data-t="endt" cx={ends.x2} cy={ends.y2} r={ends.vr} style={dot} />
    </svg>
  );
}
