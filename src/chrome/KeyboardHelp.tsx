// keyboard help: the whole map on one card (README § Keyboard), opened with ? or from the empty state.
import { useRef } from 'react';
import { useDialog } from './useDialog';
import type { WorkbenchController } from '../app/controller';

const ROWS: ReadonlyArray<readonly [string, string]> = [
  ['/ · ⌘K', 'command palette'], ['?', 'this help'], ['Tab', 'reach the canvas · the selected node · the inspector'], ['Enter', 'inspect the selection (focus its first field) · complete a connect'], ['c', 'connect: start from the selected node, arrows pick the target, Enter connects'], ['⇧ + arrows', 'move the selected node one grid step'], ['⌘Z · ⇧⌘Z', 'undo · redo'], ['f', 'fit canvas'], ['l', 'auto layout'], ['t', 'execution trace'],
  ['n', 'new diagram'], ['r', 'run · pause simulation'], ['d', 'dark · light theme'], ['← → ↑ ↓', 'step the selection in reading order (sequence: ↑↓ in time order)'],
  ['Delete · Backspace', 'delete the selection'], ['Escape', 'unwind: drag → dialog → palette → card → selection'],
  ['scroll · pinch', 'zoom'], ['drag', 'pan the canvas · move a node'], ['drag a port', 'connect two nodes'], ['hover an edge', 'rewire from either end'],
];

export function KeyboardHelp({ ctl }: { ctl: WorkbenchController }) {
  const closeRef = useRef<HTMLButtonElement>(null), ref = useDialog(closeRef);
  const close = (): void => ctl.setState({ helpOpen: false });
  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'var(--wb-scrim)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '90px', zIndex: 55 }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="wb-help-title" onClick={e => e.stopPropagation()} style={{ width: '520px', maxWidth: 'calc(100vw - 32px)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', boxShadow: 'var(--shadow-panel)', overflow: 'hidden', animation: 'wb-fade var(--motion-fast) ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 id="wb-help-title" style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em' }}>Keyboard</h2>
          <span style={{ color: 'var(--text-muted)' }}>every gesture has a key</span>
          <button ref={closeRef} className="tg-btn wb-ico" onClick={close} aria-label="close" style={{ marginLeft: 'auto', background: 'transparent', borderColor: 'transparent', color: 'var(--text-muted)' }}>✕</button>
        </div>
        <dl className="wb-help-list" tabIndex={0} aria-label="key map">
          {ROWS.map(([k, what]) => <div key={k} className="wb-help-row"><dt><span className="wb-key">{k}</span></dt><dd>{what}</dd></div>)}
        </dl>
        <div style={{ display: 'flex', gap: '16px', padding: '8px 18px', borderTop: '1px solid var(--border-subtle)', fontSize: '10px', color: 'var(--text-faint)' }}><span>single keys are ignored while typing in a field</span><span style={{ marginLeft: 'auto' }}>esc close</span></div>
      </div>
    </div>
  );
}
