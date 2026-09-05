// Nodes render as .tg-gnode[data-kind][data-family][data-state][data-health][data-terminal]
// [data-initial][data-side][data-form][data-run][data-density]. CSS keys off these; renaming an
// attribute is a visual regression. Telemetry values are initial text only — the patcher owns
// every [data-t] target after mount.
import { memo, type CSSProperties } from 'react';
import { NodePort } from './NodePort';
import { renderStats } from './stats';
import type { Handlers, NodeVM, Row } from './types';

const TITLE: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '158px' };
const RATE: CSSProperties = { fontSize: '13.5px', fontWeight: 500 };
const UNIT: CSSProperties = { fontSize: '9px', letterSpacing: '0.07em', textTransform: 'uppercase' };
const SPARK: CSSProperties = { width: '54px', height: '14px', flex: 'none' };
const POLY: CSSProperties = { fill: 'none', stroke: 'var(--nt)', strokeWidth: 1, opacity: 0.8, vectorEffect: 'non-scaling-stroke' };

function rowsEqual(a: Row[], b: Row[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) { const x = a[i]!, y = b[i]!; if (x.k !== y.k || x.v !== y.v || x.cfg !== y.cfg || x.dk !== y.dk || x.hasShort !== y.hasShort || x.short !== y.short) return false; }
  return true;
}
function same(a: NodeVM, b: NodeVM): boolean {
  for (const k of Object.keys(a) as Array<keyof NodeVM>) { if (k === 'rows') continue; if (a[k] !== b[k]) return false; }
  return rowsEqual(a.rows, b.rows);
}

export const NodeView = memo(function NodeView({ n, h }: { n: NodeVM; h: Handlers }) {
  renderStats.node++;
  const style: CSSProperties = { position: 'absolute', left: n.x + 'px', top: n.y + 'px', width: n.w + 'px', cursor: 'grab' };
  if (!n.pixel) style.backgroundImage = 'none';
  return (
    <div
      className="tg-gnode"
      data-kind={n.kind}
      data-family={n.family}
      data-state={n.state}
      data-health={n.health}
      data-terminal={n.terminal ?? undefined}
      data-initial={n.initial ?? undefined}
      data-side={n.side ?? undefined}
      data-form={n.form ?? undefined}
      data-run={n.run ?? undefined}
      data-density={n.density ?? undefined}
      role="button"
      aria-label={n.aria}
      aria-pressed={n.state === 'selected'}
      tabIndex={n.state === 'selected' ? 0 : -1}
      ref={el => h.setNodeEl(n.id, el)}
      onPointerDown={e => h.onNodeDown(n.id, e)}
      style={style}
    >
      <div className="tg-gnode-hd">
        <span className="tg-gnode-swatch" />
        <div style={{ minWidth: 0 }}>
          <div className="tg-gnode-kind">{n.typeLbl}</div>
          <div className="tg-gnode-title" style={TITLE}>{n.title}</div>
        </div>
        {n.showHdot ? <span className="tg-hdot" data-t="hdot" title={n.hword}>{n.glyph}</span> : null}
      </div>
      {n.hasAnn ? <span className="tg-ann" data-sev={n.annSev}>{n.annText}</span> : null}
      {n.showTel ? (
        <div className="tg-gnode-tel">
          <div className="tg-tel-row" data-primary="1" style={{ alignItems: 'center' }}>
            <span style={{ whiteSpace: 'nowrap' }}><span className="tg-tel-v" data-t="rate" style={RATE}>{n.rate}</span> <span data-t="unit" style={UNIT}>{n.unit}</span></span>
            <svg className="tg-spark" viewBox="0 0 54 14" preserveAspectRatio="none" style={SPARK}>
              <polyline data-t="spark" points={n.spark} style={POLY} />
            </svg>
          </div>
          <div className="tg-tel-row"><span>p99 <span className="tg-tel-v" data-t="p99">{n.p99}</span></span><span>waiting <span className="tg-tel-v" data-t="q">{n.q}</span></span></div>
          <span className="tg-telbar"><span className="tg-telbar-fill" data-t="util" data-tone={n.tone} style={{ '--v': n.utilV } as CSSProperties} /></span>
        </div>
      ) : null}
      {n.showBody ? (
        <div className="tg-gnode-body">
          {n.rows.map(r => (
            <div key={r.k} className="tg-gnode-row" data-cfg={r.cfg ?? undefined}>
              <span className="tg-gnode-k" data-dk={r.dk ?? undefined}>{r.k}</span>
              <span className="tg-gnode-v"><span data-vf={r.dk ?? undefined}>{r.v}</span>{r.hasShort ? <span data-vs="1">{r.short}</span> : null}</span>
            </div>
          ))}
        </div>
      ) : null}
      {n.showStatus ? (
        <div className="tg-gnode-status" data-t="status" data-tone={n.dotTone}><span className="tg-gnode-dot" data-t="dot" data-tone={n.dotTone}>{n.glyph}</span><span data-t="hword">{n.hword}</span></div>
      ) : null}
      {n.showPorts ? (
        <>
          <NodePort side="left" state={n.pl} onDown={e => h.onPortDown(n.id, 'left', e)} />
          <NodePort side="right" state={n.pr} onDown={e => h.onPortDown(n.id, 'right', e)} />
          <NodePort side="top" state={n.pt} onDown={e => h.onPortDown(n.id, 'top', e)} />
          <NodePort side="bottom" state={n.pb} onDown={e => h.onPortDown(n.id, 'bottom', e)} />
        </>
      ) : null}
    </div>
  );
}, (p, q) => p.h === q.h && same(p.n, q.n));
