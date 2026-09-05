// analyze: findings drawer over the same canvas, never a second screen (WB 413–445)
import type { WorkbenchController } from '../app/controller';
import type { Analysis } from '../analyze';
import { fmt, stampOf, windowNote } from '../sim';

export function Findings({ ctl, an }: { ctl: WorkbenchController; an: Analysis }) {
  const s = ctl.state, T = ctl.T, m = ctl.metrics;
  // live while the simulation runs (re-analysed each second); frozen at the stamped tick otherwise
  const live = s.running && !!m, stamp = stampOf(m);
  const fc = s.focus && an.list.some(f => f.key === s.focus!.key) ? s.focus : null;
  const noneNote = s.paradigm === 'architecture' ? 'topology is inside capacity at ' + fmt(s.rps) + ' req/s' : s.paradigm === 'sequence' ? 'the call path is short and direct' : 'the ' + T.label + ' has no structural gaps';
  return (
    <div ref={el => { ctl.refs.find = el; }} data-chrome="1" style={{ position: 'absolute', left: '14px', top: '12px', bottom: '12px', zIndex: 6, width: '308px', maxWidth: 'calc(100% - 28px)', display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', boxShadow: 'var(--shadow-panel)', overflow: 'hidden', animation: 'wb-fade var(--motion-fast) ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 13px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span className="tg-label">findings</span>
        <span style={{ color: 'var(--text-faint)' }}>{an.list.length}</span>
        <span className="wb-prov" data-live={live ? '1' : '0'} title={m ? 'sample window · ' + windowNote(m) : 'design-time analysis: structure only, no run metrics'}>{m ? (live ? 'live' : 'frozen') + (stamp ? ' · ' + stamp : '') + ' · ' + windowNote(m) : 'structure only · no run yet'}</span>
        {fc ? <button className="tg-btn" onClick={() => ctl.setState({ focus: null })} style={{ marginLeft: 'auto' }}>clear focus</button> : null}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {an.list.map(f => (
          <button key={f.key} className="wb-frow" data-on={fc && fc.key === f.key ? '1' : '0'} onClick={() => ctl.pickFinding(f)}>
            <span style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
              <span className="wb-fdot" data-tone={f.sev === 'crit' ? 'crit' : f.sev === 'warn' ? 'warn' : 'info'} style={{ marginTop: '4px' }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: '11px', color: 'var(--text-body)', textWrap: 'pretty' } as React.CSSProperties}>{f.title}</span>
              <span className="tg-label" style={{ flex: 'none', marginTop: '2px', color: 'var(--text-faint)' }}>{f.cat}</span>
            </span>
            <span style={{ color: 'var(--text-muted)', paddingLeft: '15px' }}>{f.detail}</span>
            {f.rec ? <span style={{ color: 'var(--accent-deep)', paddingLeft: '15px' }}>→ {f.rec}</span> : null}
            {f.evidence?.length ? <span className="wb-evs">{f.evidence.map((ev, i) => <span key={i} className="wb-ev" title={ev.scope}>{ev.metric} <b>{ev.value}</b></span>)}</span> : null}
          </button>
        ))}
        {!an.list.length ? <div style={{ padding: '9px', color: 'var(--text-faint)', lineHeight: 1.6 }}>nothing to flag · {noneNote}</div> : null}
      </div>
      <div style={{ display: 'flex', gap: '12px', padding: '9px 13px', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
        <span>{an.a?.label ?? ''} <span style={{ color: 'var(--text-body)' }}>{an.a?.value ?? ''}</span></span>
        <span style={{ marginLeft: 'auto' }}>{an.b?.label ?? ''} <span style={{ color: 'var(--text-body)' }}>{an.b?.value ?? ''}</span></span>
      </div>
    </div>
  );
}
