// confirm: one question, one destructive-looking action, one way out. Same shell as CreateDialog.
import { useEffect, useRef } from 'react';
import type { WorkbenchController } from '../app/controller';
import type { Confirm } from '../store';

export function ConfirmDialog({ ctl, c }: { ctl: WorkbenchController; c: Confirm }) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { okRef.current?.focus(); }, []);
  const close = (): void => ctl.setState({ confirm: null });
  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'var(--wb-scrim)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '120px', zIndex: 60 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="wb-confirm-title" aria-describedby="wb-confirm-detail" onClick={e => e.stopPropagation()} style={{ width: '440px', maxWidth: 'calc(100vw - 32px)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', boxShadow: 'var(--shadow-panel)', overflow: 'hidden', animation: 'wb-fade var(--motion-fast) ease-out' }}>
        <div style={{ padding: '16px 18px 6px' }}>
          <div id="wb-confirm-title" style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em' }}>{c.title}</div>
        </div>
        <div id="wb-confirm-detail" style={{ padding: '0 18px 14px', color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.5 }}>{c.detail}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>esc cancel</span>
          <button className="tg-btn" onClick={close} style={{ marginLeft: 'auto' }}>cancel</button>
          <button ref={okRef} className="tg-btn tg-btn--primary" onClick={() => { c.run(); }}>{c.ok}</button>
        </div>
      </div>
    </div>
  );
}
