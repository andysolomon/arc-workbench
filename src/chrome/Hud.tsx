// load HUD (simulate · analyze) and the drafting HUD (design) — WB 181–246
import type { WorkbenchController } from '../app/controller';
import { dropTone, fmt, hudD, p99Text, p99Tone, windowNote } from '../sim';

const tickLbl = (v: number): string => v >= 1000 ? (v / 1000) + 'k' : String(v);
const STAT = { fontSize: '13px', fontWeight: 500, lineHeight: 1.35 } as const;

export function Hud({ ctl }: { ctl: WorkbenchController }) {
  const s = ctl.state, T = ctl.T, H = T.HUD, m = ctl.metrics, p = s.paradigm;
  const sys = m ? m.sys : { rps: 0, goodput: 0, p50: 0, p95: 0, p99: 0, err: 0, qtot: 0, sat: 0 };
  const dropped = m ? hudD(p, m) : 0, lg = Math.log(H.max / H.min);
  const rpsSlider = Math.round(1000 * Math.log(Math.max(H.min, s.rps) / H.min) / lg);
  const onRps = (v: string): void => ctl.setRps(Math.round(H.min * Math.pow(H.max / H.min, +v / 1000)));
  return (
    <div className="wb-hud" ref={el => { ctl.refs.hud = el; }} style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '8px 14px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', flex: 'none' }}>
        <div className="tg-label">{H.load}</div>
        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-body)', lineHeight: 1.2, minWidth: '46px' }}>{fmt(s.rps)}</div>
        <span style={{ fontSize: '9.5px', color: 'var(--text-faint)' }}>{H.unit}</span>
      </div>
      <div style={{ flex: '0 1 150px', minWidth: '90px' }}>
        <input type="range" min="0" max="1000" value={rpsSlider} onChange={e => onRps(e.target.value)} onInput={e => onRps((e.target as HTMLInputElement).value)} aria-label={H.load + ' · offered load'} aria-valuetext={fmt(s.rps) + ' ' + H.unit} style={{ width: '100%', height: '12px', cursor: 'pointer', display: 'block' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', letterSpacing: '0.06em', color: 'var(--text-faint)', padding: '1px 1px 0' }}>
          <span>{tickLbl(H.min)}</span><span>{tickLbl(Math.round(H.min * Math.exp(lg / 3)))}</span><span>{tickLbl(Math.round(H.min * Math.exp(lg * 2 / 3)))}</span><span>{tickLbl(H.max)}</span>
        </div>
      </div>
      <div className="wb-hud-spacer" style={{ flex: 1 }} />
      <div className="wb-hud-stats" style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flex: 'none' }}>
        <div><div className="tg-label">{H.a}</div><div data-t="p99" data-hud-tone={m && p99Text(p, m) !== '—' ? p99Tone(p, sys.p99) : ''} title={'system p99 · ' + windowNote(m)} style={{ fontSize: '15px', fontWeight: 500, lineHeight: 1.2, minWidth: '46px' }}>{p99Text(p, m)}</div></div>
        <div><div className="tg-label">{H.b}</div><div style={{ ...STAT, minWidth: '54px' }}><span data-t="good">{m ? fmt(sys.goodput) : '—'}</span><span style={{ color: 'var(--text-faint)' }}>{H.rate}</span></div></div>
        <div><div className="tg-label">{H.c}</div><div data-t="err" data-hud-tone={sys.err > 0.05 ? 'crit' : sys.err > 0.005 ? 'warn' : ''} style={{ ...STAT, minWidth: '40px' }}>{(sys.err * 100).toFixed(1) + '%'}</div></div>
        <div><div className="tg-label">{H.d}</div><div style={{ ...STAT, minWidth: '46px' }}><span data-t="drop" data-hud-tone={dropTone(p, dropped, sys)} title={p === 'dataflow' ? 'Σ node lag · instant' : 'offered − goodput · instant'}>{m ? fmt(dropped) : '—'}</span><span style={{ color: 'var(--text-faint)' }}>{p === 'workflow' || p === 'state' ? '' : H.rate}</span></div></div>
      </div>
      <div style={{ display: 'flex', gap: '4px', flex: 'none', paddingLeft: '10px', borderLeft: '1px solid var(--border-subtle)' }}>
        <button className={'tg-btn wb-ico ' + (s.running ? 'tg-btn--active' : '')} onClick={() => ctl.toggleRunning()} title="run / pause" aria-label="run or pause" aria-pressed={s.running}>{s.running ? '❙❙' : '▶'}</button>
        <button className="tg-btn wb-ico" onClick={() => ctl.stepOnce()} title="step one tick" aria-label="step">▷</button>
        <button className="tg-btn wb-ico" onClick={() => ctl.resetSim()} title="reset metrics" aria-label="reset metrics">↺</button>
        <button className={'tg-btn ' + (s.ui.trace ? 'tg-btn--active' : '')} onClick={() => ctl.setUi('trace')} aria-pressed={s.ui.trace} title={s.ui.trace ? 'hide the traced execution' : 'follow one execution through the diagram'}>trace</button>
      </div>
    </div>
  );
}

export function DraftingHud({ ctl, tierCount, unlinked }: { ctl: WorkbenchController; tierCount: number; unlinked: number }) {
  const s = ctl.state, T = ctl.T;
  const regionWord = s.paradigm === 'architecture' ? 'tiers' : s.paradigm === 'workflow' ? 'lanes' : s.paradigm === 'dataflow' ? 'stages' : 'phases';
  return (
    <div className="wb-hud" style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '8px 14px', minWidth: 0 }}>
      <div className="tg-label" style={{ flex: 'none' }}>drafting</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 'none' }}>
        {s.paradigm === 'architecture' ? <button className={'tg-btn ' + (s.ui.tiers ? 'tg-btn--active' : '')} onClick={() => ctl.setUi('tiers')} aria-pressed={s.ui.tiers} title="tier bands behind the topology">tiers</button> : null}
        <button className={'tg-btn ' + (s.ui.labels ? 'tg-btn--active' : '')} onClick={() => ctl.setUi('labels')} aria-pressed={s.ui.labels} title="labels on relationships">labels</button>
        <button className="tg-btn" onClick={() => { ctl.snap(); ctl.deoverlap(true); }} title="align to the 16px grid">tidy</button>
        <button className="tg-btn" onClick={() => ctl.autoLayout()} title={'auto layout · ' + T.layout}>auto layout</button>
      </div>
      <div className="wb-hud-spacer" style={{ flex: 1 }} />
      <div className="wb-hud-stats" style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flex: 'none' }}>
        <div><div className="tg-label">grid</div><div style={STAT}>16 px</div></div>
        <div><div className="tg-label">{regionWord}</div><div style={STAT}>{tierCount || '—'}</div></div>
        <div><div className="tg-label">unlinked</div><div data-hud-tone={unlinked ? 'warn' : ''} style={STAT}>{unlinked}</div></div>
      </div>
    </div>
  );
}
