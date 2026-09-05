// tiers as the drawing reads them: columns of aligned nodes (architecture · design only)
import type { TierVM } from './types';
export function TierBand({ g }: { g: TierVM }) {
  return <div className="tg-group" data-family={g.family} style={{ position: 'absolute', left: g.left + 'px', top: g.top + 'px', width: g.width + 'px', height: g.height + 'px', pointerEvents: 'none' }}><span className="tg-group-label">{g.label}</span></div>;
}
