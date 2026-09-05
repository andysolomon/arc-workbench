// a compact popover, never five permanent tabs: swatch · lowercase name · ▾ (WB 156–168)
import type { CSSProperties } from 'react';
import type { VisualFamily } from '../model/document';
import { ORDER, PARADIGMS } from '../paradigms';
import { docCount } from '../store';
import type { WorkbenchController } from '../app/controller';

export const swatch = (fam: VisualFamily): CSSProperties => ({ background: 'var(--family-' + fam + '-chip)', borderColor: 'var(--family-' + fam + '-border)', flex: 'none' });

export function ParadigmSwitcher({ ctl }: { ctl: WorkbenchController }) {
  const s = ctl.state, T = ctl.T;
  return (
    <div style={{ position: 'relative', flex: 'none' }} data-chrome="1">
      <button className="tg-pswitch" data-open={s.paraOpen ? '1' : '0'} onClick={() => ctl.setState({ paraOpen: !s.paraOpen, settingsOpen: false })} title="diagram paradigm" aria-label="diagram paradigm" aria-haspopup="menu" aria-expanded={s.paraOpen}><span className="tg-chip-swatch" style={swatch(T.family)} />{T.label}<span style={{ color: 'var(--text-faint)' }}>▾</span></button>
      {s.paraOpen ? (
        <div className="tg-pmenu" role="menu" aria-label="diagram paradigm" style={{ animation: 'wb-fade var(--motion-fast) ease-out' }}>
          <div className="tg-label" style={{ padding: '6px 10px 4px' }}>diagram paradigm · one document each</div>
          {ORDER.map(pid => { const TT = PARADIGMS[pid], c = docCount(ctl.docs, pid, s.paradigm, s.nodes.length); return (
            <button key={pid} role="menuitemradio" aria-checked={pid === s.paradigm} className="tg-pitem" data-on={pid === s.paradigm ? '1' : '0'} onClick={() => ctl.switchParadigm(pid)}><span className="tg-chip-swatch" style={swatch(TT.family)} /><span className="tg-pitem-t">{TT.label}</span><span className="tg-pitem-n">{c ? c + ' ' + TT.unitNoun : 'empty'}</span><span className="tg-pitem-d">{TT.blurb}</span></button>
          ); })}
          <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
          <button role="menuitem" className="tg-pitem" onClick={() => ctl.setState({ createOpen: true, paraOpen: false })}><span style={{ color: 'var(--text-faint)' }}>+</span><span className="tg-pitem-t">create diagram…</span><span className="tg-pitem-n">n</span></button>
        </div>
      ) : null}
    </div>
  );
}
