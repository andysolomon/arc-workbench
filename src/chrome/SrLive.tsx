// Screen-reader announcements. Two polite regions: derived state (selection · lens · run state ·
// connect mode) and explicit messages the controller pushes (moved · connected · deleted).
import { useEffect, useState } from 'react';
import type { WorkbenchController } from '../app/controller';

export function SrLive({ ctl }: { ctl: WorkbenchController }) {
  const s = ctl.state, T = ctl.T;
  const [derived, setDerived] = useState('');
  const selId = s.sel ? s.sel.kind + ':' + s.sel.id : '';
  useEffect(() => {
    if (!s.sel) { setDerived(s.kbConnect ? '' : 'nothing selected'); return; }
    if (s.sel.kind === 'node') { const n = ctl.nById[s.sel.id]; if (!n) return; const deg = s.edges.filter(e => e.from === n.id || e.to === n.id).length; setDerived('selected ' + n.name + ' · ' + (T.TYPES[n.type]?.label ?? n.type).toLowerCase() + ' · ' + deg + ' ' + T.edgeNoun); }
    else if (s.sel.kind === 'edge') { const e = s.edges.find(x => x.id === s.sel!.id); if (e) setDerived('selected ' + T.edgeNoun.replace(/s$/, '') + ' ' + (ctl.nById[e.from]?.name ?? '') + ' to ' + (ctl.nById[e.to]?.name ?? '') + ' · ' + ctl.protoOf(e)); }
    else { const r = s.regions.find(x => x.id === s.sel!.id); if (r) setDerived('selected lane ' + r.label); }
  }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps -- announce on selection change only
  useEffect(() => { if (s.ready) setDerived(s.mode + ' mode'); }, [s.mode]); // eslint-disable-line react-hooks/exhaustive-deps -- announce on lens change only
  useEffect(() => { if (s.ready && s.mode !== 'design') setDerived(s.running ? 'simulation running' : 'simulation paused'); }, [s.running]); // eslint-disable-line react-hooks/exhaustive-deps -- announce on run state change only
  useEffect(() => { if (s.kbConnect) { const n = ctl.nById[s.kbConnect]; setDerived('connecting from ' + (n?.name ?? '') + ' · arrow keys choose the target, Enter connects, Escape cancels'); } }, [s.kbConnect]); // eslint-disable-line react-hooks/exhaustive-deps -- announce when connect mode starts
  return (
    <>
      <div className="wb-sr-only" aria-live="polite" aria-atomic="true">{derived}</div>
      <div className="wb-sr-only" aria-live="polite" aria-atomic="true">{s.announce}</div>
    </>
  );
}
