// the third chrome surface: from · ○—○ · to · protocol · reverse · detach. Placed once, pinned (WB 447–457)
import type { EdgeCardVM, WorkbenchController } from '../app/controller';
import type { GraphEdge } from '../model/document';

const BTN = { maxWidth: '104px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'auto' } as const;
export function EdgeCard({ ctl, e, vm }: { ctl: WorkbenchController; e: GraphEdge; vm: EdgeCardVM }) {
  return (
    <div ref={el => { ctl.refs.card = el; }} data-chrome="1" onPointerEnter={() => ctl.keepCardAlive()} onPointerLeave={() => ctl.edgeLeave(e.id)}
      style={{ position: 'absolute', left: vm.left + 'px', top: vm.top + 'px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', boxShadow: 'var(--shadow-float)', zIndex: 6, whiteSpace: 'nowrap', pointerEvents: 'none', animation: 'wb-fade var(--motion-fast) ease-out' }}>
      <button onClick={() => ctl.select({ kind: 'node', id: e.from })} className="tg-btn" style={BTN} title="select source node">{vm.fromName}</button>
      <span style={{ color: 'var(--text-faint)' }}>○—○</span>
      <button onClick={() => ctl.select({ kind: 'node', id: e.to })} className="tg-btn" style={BTN} title="select target node">{vm.toName}</button>
      <span style={{ color: 'var(--text-muted)', padding: '0 2px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vm.proto}</span>
      <span style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />
      <button onClick={() => ctl.flipEdge(e.id)} className="tg-btn wb-ico" title="reverse direction" aria-label="reverse direction" style={{ pointerEvents: 'auto' }}>⇄</button>
      <button onClick={() => ctl.delEdge(e.id)} className="tg-btn wb-ico tg-btn--danger" title="detach relationship" aria-label="detach" style={{ pointerEvents: 'auto' }}>✕</button>
    </div>
  );
}
