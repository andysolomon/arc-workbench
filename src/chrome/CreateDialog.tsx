// create diagram: five cards with axis and the question they answer (WB 665–687)
import type { WorkbenchController } from '../app/controller';
import { ORDER, PARADIGMS } from '../paradigms';
import { docCount } from '../store';
import { swatch } from './ParadigmSwitcher';
import { useDialog } from './useDialog';

export function CreateDialog({ ctl }: { ctl: WorkbenchController }) {
  const s = ctl.state, ref = useDialog();
  return (
    <div onClick={() => ctl.setState({ createOpen: false })} style={{ position: 'fixed', inset: 0, background: 'var(--wb-scrim)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '90px', zIndex: 50 }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="wb-create-title" onClick={e => e.stopPropagation()} style={{ width: '560px', maxWidth: 'calc(100vw - 32px)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', boxShadow: 'var(--shadow-panel)', overflow: 'hidden', animation: 'wb-fade var(--motion-fast) ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 id="wb-create-title" style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em' }}>Create diagram</h2>
          <span style={{ color: 'var(--text-muted)' }}>one paradigm per document · the lens stays yours</span>
          <button className="tg-btn wb-ico" onClick={() => ctl.setState({ createOpen: false })} aria-label="close" style={{ marginLeft: 'auto', background: 'transparent', borderColor: 'transparent', color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px' }}>
          {ORDER.map(pid => { const TT = PARADIGMS[pid], c = docCount(ctl.docs, pid, s.paradigm, s.nodes.length); return (
            <button key={pid} className="tg-pitem" onClick={() => ctl.createDoc(pid)} style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto', padding: '10px 12px' }}>
              <span className="tg-chip-swatch" style={swatch(TT.family)} />
              <span className="tg-pitem-t" style={{ fontSize: '12px' }}>{TT.title}<span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> · {TT.axis}</span></span>
              <span className="tg-pitem-n">{c ? 'replaces ' + c + ' ' + TT.unitNoun : ''}</span>
              <span className="tg-pitem-d">{TT.ask}</span>
              <span className="tg-pitem-d" style={{ color: 'var(--text-faint)' }}>{TT.blurb}</span>
            </button>
          ); })}
        </div>
        <div style={{ display: 'flex', gap: '16px', padding: '8px 18px', borderTop: '1px solid var(--border-subtle)', fontSize: '10px', color: 'var(--text-faint)' }}><span>creates a blank document in that paradigm</span><span style={{ marginLeft: 'auto' }}>esc close</span></div>
      </div>
    </div>
  );
}
