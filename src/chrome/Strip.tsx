// the status strip and the telemetry drawer (WB 615–661)
import type { WorkbenchController } from '../app/controller';
import { fL, fmt, polyline } from '../sim';

const CARD = { background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '10px 12px' } as const;
const HEAD = { display: 'flex', justifyContent: 'space-between', gap: '10px', whiteSpace: 'nowrap', marginBottom: '6px' } as const;
const SVG = { width: '100%', height: '58px', display: 'block' } as const;
const SAVE_TEXT = { clean: '', dirty: 'unsaved', saving: 'saving…', saved: 'saved', failed: 'save failed' } as const;
const BTN = { flex: 'none', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '10px' } as const;
const line = (stroke: string, w: number) => ({ fill: 'none', stroke, strokeWidth: w, vectorEffect: 'non-scaling-stroke' as const });

export function Strip({ ctl }: { ctl: WorkbenchController }) {
  const s = ctl.state, T = ctl.T, up = Math.floor(ctl.uptimeS);
  const catCount: Record<string, number> = {};
  s.nodes.forEach(n => { const tt = T.TYPES[n.type]; if (!tt) return; const c = (T.CATS[tt.cat]?.label ?? '').toLowerCase(); catCount[c] = (catCount[c] || 0) + 1; });
  const statMix = Object.keys(catCount).length > 1 ? Object.keys(catCount).map(c => catCount[c] + ' ' + c).join(', ') : '';
  const isDesign = s.mode === 'design';
  const hist = ctl.simState ? ctl.simState.hist : [], m = ctl.metrics, sys = m ? m.sys : null;
  const latMax = Math.max(1, ...hist.map(h => h.p99)), thrMax = Math.max(1, ...hist.map(h => h.rps));
  return (
    <section aria-label="status" style={{ flex: 'none', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)' }}>
      <div ref={el => { ctl.refs.strip = el; }} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 18px', padding: '7px 20px', color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        <button onClick={() => ctl.setState({ libOpen: !s.libOpen })} className="tg-btn" aria-expanded={s.libOpen} aria-label="component library" style={{ flex: 'none', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '10px' }}>library {s.libOpen ? '‹' : '›'}</button>
        <span style={{ whiteSpace: 'nowrap' }}>{s.nodes.length} {T.unitNoun}</span>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{statMix}</span>
        <span style={{ whiteSpace: 'nowrap' }}>{s.edges.length} {T.edgeNoun}</span>
        <span style={{ whiteSpace: 'nowrap' }} data-t="uptime">{Math.floor(up / 60) + 'm ' + String(up % 60).padStart(2, '0') + 's'}</span>
        <span className="wb-save" data-save={s.save} role="status" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {s.presetId === 'stress' ? 'fixture · not saved' : SAVE_TEXT[s.save]}
          {s.save === 'failed' ? <><button className="tg-btn" onClick={() => ctl.retrySave()} style={BTN}>retry</button><button className="tg-btn" onClick={() => ctl.exportDoc()} style={BTN}>export copy</button></> : null}
        </span>
        <button onClick={() => { if (!isDesign) ctl.setState({ drawerOpen: !s.drawerOpen }); }} className="tg-btn wb-tel" data-off={isDesign ? '1' : '0'} title={isDesign ? 'telemetry · available in simulate' : 'toggle telemetry drawer'} aria-expanded={s.drawerOpen} aria-disabled={isDesign} style={{ marginLeft: 'auto', flex: 'none', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '10px' }}>telemetry {s.drawerOpen ? '▾' : '▴'}</button>
      </div>
      {s.drawerOpen ? (
        <div ref={el => { ctl.refs.drawer = el; }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '12px', padding: '12px 20px 14px', borderTop: '1px solid var(--border-subtle)', maxHeight: 'min(40vh,240px)', overflowY: 'auto' }}>
          <div style={CARD}>
            <div style={HEAD}><span className="tg-label">latency</span><span style={{ color: 'var(--text-faint)' }} data-t="latmax" title="the maximum of the charted series over the history window — not the current value">{'max ' + fL(s.paradigm, latMax) + ' · ' + hist.length + ' ticks'}</span></div>
            <svg viewBox="0 0 300 64" preserveAspectRatio="none" style={SVG}>
              <polyline data-t="c-p50" points={polyline(hist, 'p50', 300, 64, latMax)} style={line('var(--accent)', 1.4)} />
              <polyline data-t="c-p95" points={polyline(hist, 'p95', 300, 64, latMax)} style={line('var(--health-warn)', 1.2)} />
              <polyline data-t="c-p99" points={polyline(hist, 'p99', 300, 64, latMax)} style={line('var(--health-critical)', 1.2)} />
            </svg>
            <div style={{ display: 'flex', gap: '12px', fontSize: '10px', marginTop: '5px' }}><span style={{ color: 'var(--accent)' }}>p50</span><span style={{ color: 'var(--health-warn)' }}>p95</span><span style={{ color: 'var(--health-critical)' }}>p99</span></div>
          </div>
          <div style={CARD}>
            <div style={HEAD}><span className="tg-label">throughput</span><span style={{ color: 'var(--text-faint)' }} data-t="thrmax">{'max ' + fmt(thrMax) + ' · ' + hist.length + ' ticks'}</span></div>
            <svg viewBox="0 0 300 64" preserveAspectRatio="none" style={SVG}>
              <polyline data-t="c-rps" points={polyline(hist, 'rps', 300, 64, thrMax)} style={line('var(--text-faint)', 1.2)} />
              <polyline data-t="c-good" points={polyline(hist, 'goodput', 300, 64, thrMax)} style={line('var(--health-ok)', 1.4)} />
            </svg>
            <div style={{ display: 'flex', gap: '12px', fontSize: '10px', marginTop: '5px' }}><span style={{ color: 'var(--text-muted)' }}>offered</span><span style={{ color: 'var(--health-ok)' }}>goodput</span></div>
          </div>
          <div style={CARD}>
            <div style={HEAD}><span className="tg-label">error rate</span><span style={{ color: 'var(--text-faint)' }} data-t="errNow">{((sys?.err ?? 0) * 100).toFixed(1) + '%'}</span></div>
            <svg viewBox="0 0 300 64" preserveAspectRatio="none" style={SVG}><polyline data-t="c-err" points={polyline(hist, 'err', 300, 64, 1)} style={line('var(--health-critical)', 1.4)} /></svg>
            <div style={{ fontSize: '10px', marginTop: '5px', color: 'var(--text-faint)' }}>0–100%</div>
          </div>
          <div style={CARD}>
            <div style={HEAD}><span className="tg-label">queue depth</span><span style={{ color: 'var(--text-faint)' }} data-t="qNow">{sys ? fmt(sys.qtot) : ''}</span></div>
            <svg viewBox="0 0 300 64" preserveAspectRatio="none" style={SVG}><polyline data-t="c-q" points={polyline(hist, 'qtot', 300, 64)} style={line('var(--health-warn)', 1.4)} /></svg>
            <div style={{ fontSize: '10px', marginTop: '5px', color: 'var(--text-faint)' }}>total buffered</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
