// onboarding hints: pills that retire once the gesture has been used (WB 405–411)
import type { WorkbenchController } from '../app/controller';
export function Hints({ ctl }: { ctl: WorkbenchController }) {
  const hints = (ctl.touch
    ? [{ k: 'zoom', t: 'pinch to zoom' }, { k: 'pan', t: 'drag to pan' }, { k: 'rewire', t: 'tap an edge · drag ○ to rewire' }]
    : [{ k: 'zoom', t: 'scroll to zoom' }, { k: 'pan', t: 'drag to pan' }, { k: 'rewire', t: 'hover an edge to rewire' }]).filter(h => !ctl.hintsDone[h.k]);
  if (!hints.length) return null;
  return (
    <div style={{ position: 'absolute', left: '14px', top: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', maxWidth: 'calc(100% - 28px)', pointerEvents: 'none' }}>
      {hints.map(h => <span key={h.k} className="tg-label" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '999px', padding: '4px 11px', whiteSpace: 'nowrap' }}>{h.t}</span>)}
    </div>
  );
}
