// One shared SVG layer; each edge is a memoized <g> with a transparent 12px hit twin. The
// group mirrors data-rel so overview rules are direct attribute matches (no :has()).
import { memo, type CSSProperties } from 'react';
import type { EdgeVM, Handlers } from './types';
import { renderStats } from './stats';

const NOPE: CSSProperties = { pointerEvents: 'none' };
const HIT: CSSProperties = { cursor: 'pointer' };
const AUTO: CSSProperties = { pointerEvents: 'auto' };

function same(a: EdgeVM, b: EdgeVM): boolean {
  for (const k of Object.keys(a) as Array<keyof EdgeVM>) { if (k === 'pktStyle') continue; if (a[k] !== b[k]) return false; }
  return a.pktStyle.opacity === b.pktStyle.opacity && a.pktStyle.strokeWidth === b.pktStyle.strokeWidth && a.pktStyle.dur === b.pktStyle.dur;
}

export const EdgeView = memo(function EdgeView({ e, h }: { e: EdgeVM; h: Handlers }) {
  renderStats.edge++;
  const pkt: CSSProperties = { opacity: e.pktStyle.opacity, strokeWidth: e.pktStyle.strokeWidth };
  if (e.pktStyle.dur) (pkt as Record<string, string>)['--dur'] = e.pktStyle.dur;
  return (
    <g className="tg-edge-g" data-rel={e.rel} ref={el => h.setEdgeEl(e.id, el)} onPointerEnter={() => h.onEdgeEnter(e.id)} onPointerMove={ev => h.onEdgeMove(e.id, ev)} onPointerLeave={() => h.onEdgeLeave(e.id)} style={AUTO}>
      <title>{e.aria}</title>
      {e.onPath ? <path className="wb-hl" d={e.d} /> : null}
      <path className="tg-edge-hit" d={e.d} onClick={ev => h.onEdgeClick(e.id, ev)} style={HIT} />
      <path className="tg-edge" data-rel={e.rel} data-state={e.state} data-weight={e.weight} data-health={e.stress} data-run={e.run ?? undefined} data-msg={e.msg ?? undefined} d={e.d} />
      {e.packets ? <path className="wb-packets" data-t="pkt" data-health={e.stress} d={e.d} style={pkt} /> : null}
      {e.hasLabel ? <text className="tg-edge-label" data-t="elabel" data-role={e.labelRole ?? undefined} x={e.lx} y={e.ly} textAnchor="middle" style={NOPE}>{e.labelText}</text> : null}
      {e.hasGuard ? <text className="tg-edge-label" data-role="guard" x={e.lx} y={e.lyG} textAnchor="middle" style={NOPE}>{e.guardText}</text> : null}
      {e.hasAction ? <text className="tg-edge-label" data-role="action" x={e.lx} y={e.lyA} textAnchor="middle" style={NOPE}>{e.actionText}</text> : null}
      <text className="tg-edge-label wb-erate" data-t="erate" x={e.lx} y={e.ly2} textAnchor="middle" style={NOPE}>{e.rateText}</text>
    </g>
  );
}, (p, q) => p.h === q.h && same(p.e, q.e));
