// One adaptive inspector shell: node · edge · lane. Schema-driven fields, section titles and
// metric nouns from the paradigm; live metrics patched by the telemetry pass (WB 463–612)
import type { CSSProperties } from 'react';
import type { InspectorField, WorkbenchController } from '../app/controller';
import type { GraphEdge, GraphNode, GraphRegion, OwnerKind } from '../model/document';
import { familyOf } from '../paradigms';
import { fL, fmt } from '../sim';

const ICO: CSSProperties = { background: 'transparent', borderColor: 'transparent', color: 'var(--text-muted)' };
const SEC_HD: CSSProperties = { padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' };
const SEC: CSSProperties = { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' };
const KV: CSSProperties = { display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' };
const TITLE: CSSProperties = { fontSize: '12.5px', fontWeight: 500, color: 'var(--text-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 };

function Fields({ fields }: { fields: InspectorField[] }) {
  return (
    <div className="tg-fields">
      {fields.map(f => {
        if (f.isCheck) return <label key={f.key} className="tg-field-check"><input type="checkbox" checked={f.checked} onChange={e => f.onChange(e.target.checked)} />{f.label}</label>;
        if (f.isSel) return <label key={f.key} className="tg-field">{f.label}<select className="tg-select" value={String(f.value)} onChange={e => f.onChange(e.target.value)} style={{ cursor: 'pointer', width: '100%' }}>{f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></label>;
        if (f.isNum) return <label key={f.key} className="tg-field" data-half={f.half ?? undefined}>{f.label}<input className="tg-input" type="number" min={f.min} max={f.max} step={f.step} value={f.value} onChange={e => f.onChange(e.target.value)} style={{ width: '100%' }} /></label>;
        return <label key={f.key} className="tg-field" data-half={f.half ?? undefined}>{f.label}<input className="tg-input" value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.ph} style={{ width: '100%' }} /></label>;
      })}
    </div>
  );
}
function HeadButtons({ ctl }: { ctl: WorkbenchController }) {
  const dense = ctl.state.ui.dense, title = dense ? 'full inspector' : 'compact inspector';
  return (<>
    <button className="tg-btn wb-ico" onClick={() => ctl.setUi('dense')} title={title} aria-label={title} style={ICO}>{dense ? '⇱' : '⇲'}</button>
    <button className="tg-btn wb-ico" onClick={() => ctl.select(null)} title="close" aria-label="close inspector" style={ICO}>✕</button>
  </>);
}

function NodeInspector({ ctl, n }: { ctl: WorkbenchController; n: GraphNode }) {
  const s = ctl.state, T = ctl.T, p = s.paradigm, t = T.TYPES[n.type], m = ctl.metrics, st = m ? m.nodes[n.id] : undefined, simOn = s.mode !== 'design';
  const fam = familyOf(p, n), by = ctl.nById;
  const thr = (n.ms ?? 0) > 0 ? ((n.inst ?? 1) * (n.cap ?? 1) * 1000) / (n.ms ?? 1) : 0;
  const hc = st ? 'var(--health-' + (st.health === 'crit' ? 'critical' : st.health) + ')' : 'var(--text-faint)';
  const wires = s.edges.filter(e => e.from === n.id || e.to === n.id);
  const cfgLabel = p === 'architecture' ? 'configuration' : p === 'sequence' ? 'participant' : p === 'workflow' ? 'step' : p === 'state' ? 'state' : (t?.form === 'process' ? 'ƒ processor' : '≡ dataset');
  const ML = T.METRICS, HW = { ok: 'healthy', warn: 'degrading', crit: 'saturated' } as const;
  const delLbl = 'delete ' + (p === 'sequence' ? 'participant' : p === 'workflow' ? 'step' : p === 'state' ? 'state' : p === 'dataflow' ? (t?.form === 'process' ? 'processor' : 'dataset') : 'node');
  return (<>
    <div data-sec="" data-hd="" style={{ ...SEC_HD, gap: '10px', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}><div style={TITLE}>{n.name}</div><HeadButtons ctl={ctl} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span className="tg-badge" style={{ background: 'var(--family-' + fam + '-bg)', borderColor: 'var(--family-' + fam + '-border)', color: 'var(--family-' + fam + '-text)', flex: 'none', maxWidth: '150px' }}>«{(t?.label ?? n.type).toLowerCase()}»</span>
        {st && simOn ? <span className="tg-chip"><span className="tg-chip-swatch" style={{ background: hc, borderColor: hc }} />{HW[st.health]}</span> : null}
      </div>
    </div>
    <div data-sec="" style={SEC}>
      <div className="tg-label">{cfgLabel}</div>
      <Fields fields={ctl.fieldsFor(T.INSPECT.node, n)} />
      {p === 'architecture' || p === 'dataflow' ? <div data-opt="" style={{ color: 'var(--text-faint)' }}>{'capacity ≈ ' + (thr ? fmt(thr) + T.HUD.rate + ' max' : 'unbounded')}</div> : null}
    </div>
    <div data-sec="" style={{ ...SEC, borderTop: '1px solid var(--border-subtle)', gap: '8px' }}>
      <div className="tg-label">endpoints</div>
      {!wires.length ? <div style={{ color: 'var(--text-faint)' }}>no connections yet · drag a port</div> : null}
      {wires.map(e => { const out = e.from === n.id, peer = by[out ? e.to : e.from]; return (
        <div key={e.id} onPointerEnter={() => ctl.setState({ hoverEdge: e.id })} onPointerLeave={() => ctl.setState({ hoverEdge: null })} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ color: 'var(--text-muted)', flex: 'none' }}>{out ? '→' : '←'}</span>
          <button onClick={() => ctl.select({ kind: 'edge', id: e.id })} className="tg-btn" style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', borderColor: 'transparent', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{peer ? peer.name : '(missing)'}</button>
          <span style={{ color: 'var(--text-faint)', flex: 'none', fontSize: '10px' }}>{ctl.protoOf(e)}</span>
          <button onClick={() => ctl.delEdge(e.id)} className="tg-btn wb-ico" title="detach" aria-label="detach" style={{ flex: 'none', ...ICO }}>✕</button>
        </div>
      ); })}
    </div>
    {st && simOn ? (
      <div data-sec="" style={{ ...SEC, borderTop: '1px solid var(--border-subtle)', gap: '9px' }}>
        <div className="tg-label">live metrics</div>
        <div data-mgrid="" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '7px 14px' }}>
          <div style={KV}>{ML.arr} <span style={{ color: 'var(--text-body)' }} data-t="mArr">{fmt(st.arr) + T.HUD.rate}</span></div>
          <div style={KV}>{ML.lat} <span style={{ color: 'var(--text-body)' }} data-t="mLat">{fL(p, st.lat)}</span></div>
          <div style={KV}>{ML.p99} <span style={{ color: 'var(--text-body)' }} data-t="mP99">{fL(p, st.lat * 2.2)}</span></div>
          <div style={KV}>{ML.util} <span style={{ color: 'var(--text-body)' }} data-t="mUtil">{Math.round(st.util * 100) + '%'}</span></div>
          <div style={KV}>{ML.q} <span style={{ color: 'var(--text-body)' }} data-t="mQ">{fmt(st.q)}</span></div>
          <div style={KV}>{ML.err} <span style={{ color: 'var(--text-body)' }} data-t="mErr">{(st.err * 100).toFixed(1) + '%'}</span></div>
        </div>
      </div>
    ) : null}
    <div data-sec="" style={{ padding: '12px 16px', marginTop: 'auto' }}><button className="tg-btn tg-btn--danger" onClick={() => ctl.deleteSel()} style={{ width: '100%' }}>{delLbl}</button></div>
  </>);
}

function EdgeInspector({ ctl, e }: { ctl: WorkbenchController; e: GraphEdge }) {
  const s = ctl.state, T = ctl.T, p = s.paradigm, by = ctl.nById, m = ctl.metrics, simOn = s.mode !== 'design';
  const rate = m ? m.edges[e.id] || 0 : 0, tx = T.structured ? ctl.transitionText(e) : '';
  const cfgLabel = p === 'architecture' ? 'contract' : p === 'sequence' ? 'message' : p === 'state' ? 'transition' : p === 'dataflow' ? 'movement' : 'relationship';
  const delLbl = 'delete ' + (p === 'sequence' ? 'message' : p === 'state' || p === 'workflow' ? 'transition' : p === 'dataflow' ? 'movement' : 'relationship');
  return (<>
    <div data-sec="" data-hd="" style={SEC_HD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ fontSize: '12.5px', fontWeight: 500, lineHeight: 1.5, color: 'var(--text-body)', flex: 1 }}>{(by[e.from]?.name ?? '') + ' → ' + (by[e.to]?.name ?? '')}</div><HeadButtons ctl={ctl} /></div>
      <div style={{ color: 'var(--text-muted)' }}>{ctl.protoOf(e) + ' · ' + (T.EDGES[e.kind]?.desc || T.edgeNoun)}</div>
    </div>
    <div data-sec="" style={{ ...SEC, borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="tg-label">endpoints</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: '7px 10px', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>from</span>
        <select className="tg-select" value={e.from} onChange={ev => ctl.setEnd(e.id, 'from', ev.target.value)} style={{ cursor: 'pointer', width: '100%' }}>{s.nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
        <span style={{ color: 'var(--text-muted)' }}>to</span>
        <select className="tg-select" value={e.to} onChange={ev => ctl.setEnd(e.id, 'to', ev.target.value)} style={{ cursor: 'pointer', width: '100%' }}>{s.nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
      </div>
      <button className="tg-btn" onClick={() => ctl.flipEdge(e.id)} style={{ width: '100%' }}>⇄ reverse direction</button>
    </div>
    <div data-sec="" style={SEC}>
      <div className="tg-label">{cfgLabel}</div>
      <Fields fields={ctl.fieldsFor(T.INSPECT.edge, e)} />
      {tx ? <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}><div className="tg-label">reads as</div><div style={{ color: 'var(--text-body)', wordBreak: 'break-word', lineHeight: 1.6 }}>{tx}</div></div> : null}
      {rate > 0 && simOn ? <div style={{ ...KV, borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>{p === 'sequence' ? 'per request' : 'current rate'} <span style={{ color: 'var(--text-body)' }} data-t="mRate">{fmt(rate) + T.HUD.rate}</span></div> : null}
    </div>
    <div data-sec="" style={{ padding: '12px 16px', marginTop: 'auto' }}><button className="tg-btn tg-btn--danger" onClick={() => ctl.deleteSel()} style={{ width: '100%' }}>{delLbl}</button></div>
  </>);
}

function LaneInspector({ ctl, r }: { ctl: WorkbenchController; r: GraphRegion }) {
  const T = ctl.T, members = ctl.laneMembers(r.id).sort((a, b) => a.x - b.x);
  const kindRow = ctl.OWNER_KINDS.find(k => k[0] === (r.ownerKind || 'team')) || ctl.OWNER_KINDS[0]!;
  const H = ctl.handoffs(), hin = H.filter(h => h.to.id === r.id).length, hout = H.filter(h => h.from.id === r.id).length;
  const focus = ctl.takeLaneFocus(), lanes = ctl.lanes(), idx = lanes.findIndex(l => l.id === r.id);
  return (<>
    <div data-sec="" data-hd="" style={SEC_HD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ ...TITLE, lineHeight: 1.5 }}>{r.label}</div><HeadButtons ctl={ctl} /></div>
      <div style={{ color: 'var(--text-muted)' }}>{'lane ' + (idx + 1) + ' of ' + lanes.length + ' · ' + (r.owner ? kindRow[1] + ' · ' + r.owner : 'no owner yet')}</div>
    </div>
    <div data-sec="" style={{ ...SEC, borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="tg-label">lane</div>
      <div className="tg-fields">
        <label className="tg-field">name<input className="tg-input" value={r.label} onChange={e => ctl.updLane(r.id, { label: e.target.value })} placeholder="release governance" autoFocus={focus === 'name'} style={{ width: '100%' }} /></label>
        <label className="tg-field">owner<input className="tg-input" value={r.owner || ''} onChange={e => ctl.updLane(r.id, { owner: e.target.value })} placeholder="release owner · platform team" autoFocus={focus === 'owner'} style={{ width: '100%' }} /></label>
        <label className="tg-field">owner kind<select className="tg-select" value={r.ownerKind || 'team'} onChange={e => ctl.updLane(r.id, { ownerKind: e.target.value as OwnerKind })} style={{ cursor: 'pointer', width: '100%' }}>{ctl.OWNER_KINDS.map(k => <option key={k[0]} value={k[0]}>{k[1]}</option>)}</select></label>
      </div>
      <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{kindRow[2]}</div>
      {!r.owner ? <div style={{ color: 'var(--kind-interface-text)', lineHeight: 1.5 }}>name the owner · every step in this lane inherits it</div> : null}
    </div>
    <div data-sec="" style={{ ...SEC, gap: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="tg-label">steps</span><span style={{ color: 'var(--text-muted)' }}>{members.length + (members.length === 1 ? ' step' : ' steps')}</span></div>
      {members.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{members.map(n => <button key={n.id} className="tg-btn" onClick={() => ctl.select({ kind: 'node', id: n.id })} style={{ justifyContent: 'space-between', width: '100%', textAlign: 'left' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span><span style={{ color: 'var(--text-muted)' }}>{(T.TYPES[n.type]?.label ?? '').toLowerCase()}</span></button>)}</div> : null}
      {hin + hout > 0 ? <div style={{ ...KV, borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>handoffs in / out <span style={{ color: 'var(--text-body)' }}>{hin} / {hout}</span></div> : null}
    </div>
    <div data-sec="" style={{ padding: '12px 16px', display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)' }}>
      <button className="tg-btn" onClick={() => ctl.moveLane(r.id, -1)} style={{ flex: 1 }} title="move lane up">↑ move up</button>
      <button className="tg-btn" onClick={() => ctl.moveLane(r.id, 1)} style={{ flex: 1 }} title="move lane down">↓ move down</button>
    </div>
    <div data-sec="" style={{ padding: '12px 16px', marginTop: 'auto' }}><button className="tg-btn tg-btn--danger" onClick={() => ctl.deleteSel()} style={{ width: '100%' }}>delete lane · steps stay</button></div>
  </>);
}

export function Inspector({ ctl }: { ctl: WorkbenchController }) {
  const s = ctl.state, sel = s.sel; if (!sel) return null;
  let body: JSX.Element | null = null;
  if (sel.kind === 'node') { const n = ctl.nById[sel.id]; if (n) body = <NodeInspector ctl={ctl} n={n} />; }
  else if (sel.kind === 'edge') { const e = s.edges.find(x => x.id === sel.id); if (e) body = <EdgeInspector ctl={ctl} e={e} />; }
  else { const r = s.regions.find(x => x.id === sel.id); if (r) body = <LaneInspector ctl={ctl} r={r} />; }
  if (!body) return null;
  return (
    <div ref={el => { ctl.refs.insp = el; }} className="wb-insp" data-chrome="1" data-dense={s.ui.dense ? 'on' : 'off'} style={{ position: 'absolute', right: '14px', top: '12px', bottom: '12px', zIndex: 7, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', boxShadow: 'var(--shadow-panel)', overflowY: 'auto', display: 'flex', flexDirection: 'column', animation: 'wb-fade var(--motion-fast) ease-out' }}>
      {body}
    </div>
  );
}
