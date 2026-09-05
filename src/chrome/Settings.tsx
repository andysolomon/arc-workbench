// display settings popover — canvas overlay toggles (WB 251–262)
import type { CSSProperties } from 'react';
import type { WorkbenchController } from '../app/controller';

export function Settings({ ctl }: { ctl: WorkbenchController }) {
  const s = ctl.state;
  return (
    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 40, width: '238px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', boxShadow: 'var(--shadow-panel)', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: '10px', animation: 'wb-fade var(--motion-fast) ease-out' }}>
      <div className="tg-label">canvas</div>
      {ctl.UIOPTS.map(([k, label]) => {
        const on = !!s.ui[k];
        const pill: CSSProperties = { width: '26px', height: '14px', flex: 'none', borderRadius: '999px', background: on ? 'var(--accent)' : 'var(--surface-inset)', border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'), display: 'flex', alignItems: 'center', padding: '0 2px', justifyContent: on ? 'flex-end' : 'flex-start' };
        const knob: CSSProperties = { width: '8px', height: '8px', borderRadius: '999px', background: on ? 'var(--surface-card)' : 'var(--text-faint)', display: 'block' };
        return (
          <button key={k} onClick={() => ctl.setUi(k)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '11px' }}>
            <span>{label}</span>
            <span style={pill}><span style={knob} /></span>
          </button>
        );
      })}
    </div>
  );
}
