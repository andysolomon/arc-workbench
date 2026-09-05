// / or ⌘K: every command, filtered by substring; ↑↓ navigate, ↵ run, esc close (WB 688–703)
import type { WorkbenchController } from '../app/controller';

export function CommandPalette({ ctl }: { ctl: WorkbenchController }) {
  const s = ctl.state, items = ctl.paletteItems().slice(0, 12);
  return (
    <div onClick={() => ctl.setState({ palette: false })} style={{ position: 'fixed', inset: 0, background: 'var(--wb-scrim)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '110px', zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '480px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', boxShadow: 'var(--shadow-panel)', overflow: 'hidden', animation: 'wb-fade var(--motion-fast) ease-out' }}>
        <input ref={el => { if (el && s.palette) setTimeout(() => el.focus(), 30); }} value={s.pq} onChange={e => ctl.setState({ pq: e.target.value, pi: 0 })} placeholder="type a command · add approval gate · change diagram type · trace · auto layout" aria-label="command" style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-body)', padding: '13px 16px', fontSize: '13px', outline: 'none' }} />
        <div style={{ padding: '6px', maxHeight: '330px', overflowY: 'auto' }}>
          {items.map((it, i) => (
            <div key={it.label} onClick={() => it.run()} onPointerEnter={() => ctl.setState({ pi: i })} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', background: i === s.pi ? 'var(--accent-tint)' : 'transparent', color: i === s.pi ? 'var(--accent-deep)' : 'var(--text-secondary)' }}>
              <span>{it.label}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>{it.hint}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '16px', padding: '8px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: '10px', color: 'var(--text-faint)' }}><span>↑↓ navigate</span><span>↵ run</span><span>esc close</span></div>
      </div>
    </div>
  );
}
