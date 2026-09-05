// Regions are absolutely positioned divs behind nodes with pointer-events:none; only a lane's
// label row opts back in so the lane can be inspected.
import { memo, type CSSProperties } from 'react';
import type { Handlers, RegionVM } from './types';

const HIT: CSSProperties = { pointerEvents: 'auto', cursor: 'pointer', padding: '2px 4px', margin: '-2px -4px' };
export const RegionView = memo(function RegionView({ r, h }: { r: RegionVM; h: Handlers }) {
  const hit = r.selectable ? HIT : undefined, title = r.selectable ? 'click to inspect lane' : undefined;
  const sel = r.selectable ? (e: React.MouseEvent<HTMLSpanElement>) => h.onRegionSelect(r.id, e) : undefined;
  return (
    <div className="tg-region" data-variant={r.variant} data-family={r.family} data-alt={r.alt ?? undefined} data-dashed={r.dashed ?? undefined} data-state={r.state ?? undefined} style={{ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }} aria-label={r.aria}>
      <span className="tg-region-label" onClick={sel} style={hit} title={title}>{r.label}</span>
      {r.hasOwner ? <span className="tg-region-owner" onClick={sel} style={hit} title={title}>{r.owner}</span> : null}
      {r.needsOwner ? <span className="tg-region-owner" onClick={sel} style={hit} title={title}>no owner · click to set</span> : null}
    </div>
  );
});
