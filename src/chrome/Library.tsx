// the adaptive component library: categories and types from the paradigm registry; non-node
// entries are commands; cross-paradigm hits appear below, dimmed (WB 255–299)
import type { CSSProperties } from 'react';
import type { WorkbenchController } from '../app/controller';
import { MSG_ICON, ORDER, PARADIGMS } from '../paradigms';
import { swatch } from './ParadigmSwitcher';

const ROW: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', width: '100%', textAlign: 'left', background: 'transparent', borderColor: 'transparent', paddingLeft: '6px' };
const Icon = ({ d }: { d: string }) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', opacity: 0.75 }}><path d={d} /></svg>;
const LBL: CSSProperties = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

export function Library({ ctl }: { ctl: WorkbenchController }) {
  const s = ctl.state, T = ctl.T, q = s.search.toLowerCase();
  // chips, swatches and tints all speak visual family — never the UML kind alias
  const famOf = (cid: string) => { if (cid === 'lane') return 'stone' as const; const first = Object.keys(T.TYPES).find(t => T.TYPES[t]!.cat === cid); return first ? T.TYPES[first]!.family : 'stone'; };
  const groups = Object.keys(T.CATS).map(cid => {
    const fam = famOf(cid), open = q ? true : !s.collapsed[cid];
    type Item = { key: string; label: string; icon: string; cls: string; title: string; onAdd: () => void };
    let items: Item[] = Object.keys(T.TYPES).filter(t => T.TYPES[t]!.cat === cid && (!q || T.TYPES[t]!.label.toLowerCase().includes(q)))
      .map(t => { const tt = T.TYPES[t]!, form = T.FORMS && tt.form ? T.FORMS[tt.form] : null; return { key: t, label: (form ? form.glyph + ' ' : '') + tt.label.toLowerCase(), icon: tt.icon, cls: '', title: form ? form.label + ' · ' + form.hint + ' · click to add' : 'click to add to canvas', onAdd: () => ctl.addNode(t) }; });
    const cmds = T.COMMANDS?.[cid];
    if (cmds) items = items.concat(cmds.filter(c => !q || c[1].includes(q)).map(c => c[0] === 'phase'
      ? { key: 'cmd-phase', label: '+ phase', icon: MSG_ICON['phase']!, cls: '', title: 'group the trailing messages into a phase', onAdd: () => ctl.addPhase() }
      : c[0] === 'lane'
        ? { key: 'cmd-lane', label: '+ lane', icon: MSG_ICON['phase']!, cls: '', title: 'add an owner lane below the last one', onAdd: () => ctl.addLane() }
        : { key: 'cmd-' + c[0], label: c[1] + ' message', icon: MSG_ICON[c[0]] || 'M2 8h10', cls: s.nextKind === c[0] ? 'tg-btn--active' : '', title: 'arm, then drag a port between two participants', onAdd: () => ctl.setState({ nextKind: s.nextKind === c[0] ? null : c[0] }) }));
    return { id: cid, label: T.CATS[cid]!.label, open, fam, items };
  }).filter(g => g.items.length);
  // global search reaches the other paradigms; a hit names its paradigm and switches to it
  const otherGroups = q ? ORDER.filter(pid => pid !== s.paradigm).map(pid => {
    const TT = PARADIGMS[pid];
    const items = Object.keys(TT.TYPES).filter(t => TT.TYPES[t]!.label.toLowerCase().includes(q)).slice(0, 4)
      .map(t => ({ key: t, label: TT.TYPES[t]!.label.toLowerCase(), icon: TT.TYPES[t]!.icon, title: 'switch to ' + TT.label + ' and add', onAdd: () => { ctl.switchParadigm(pid); setTimeout(() => ctl.addNode(t), 80); } }));
    return { id: pid, label: TT.label, tag: TT.label, fam: TT.family, items };
  }).filter(g => g.items.length) : [];
  return (
    <nav aria-label="component library" style={{ width: '228px', flex: 'none', display: 'flex', flexDirection: 'column', background: 'var(--surface-page)', borderRight: '1px solid var(--border-subtle)' }}>
      <div style={{ padding: '12px 12px 6px' }}>
        <input className="tg-input" type="search" value={s.search} onChange={e => ctl.setState({ search: e.target.value })} placeholder="search components" aria-label="search components" style={{ width: '100%' }} />
      </div>
      {T.FORMS ? <div className="wb-formkey"><span><b>≡ data</b> · at rest / in transit</span><span><b>ƒ process</b> · transformation / execution</span></div> : null}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 8px 14px' }}>
        {groups.map(g => (
          <div key={g.id} style={{ marginTop: '10px' }}>
            <button onClick={() => ctl.setState({ collapsed: { ...s.collapsed, [g.id]: !s.collapsed[g.id] } })} className="tg-label" aria-expanded={g.open} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', padding: '4px 4px 6px', cursor: 'pointer' }}>
              <span className="tg-chip-swatch" style={swatch(g.fam)} />{g.label}
              <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', letterSpacing: 0 }}>{g.open ? '−' : '+'}</span>
            </button>
            {g.open ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {g.items.map(it => (
                  <button key={it.key} className={'tg-btn ' + it.cls} data-tint={g.fam} onClick={it.onAdd} title={it.title} aria-label={it.label + ' · ' + it.title} aria-pressed={it.cls ? true : undefined} style={ROW}>
                    <Icon d={it.icon} /><span style={LBL}>{it.label}</span><span style={{ color: 'var(--text-faint)', flex: 'none' }}>+</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {otherGroups.map(g => (
          <div key={g.id} className="wb-lib-other" style={{ marginTop: '12px' }}>
            <div className="tg-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 4px 6px' }}><span className="tg-chip-swatch" style={swatch(g.fam)} />{g.label}<span style={{ marginLeft: 'auto', color: 'var(--text-faint)', letterSpacing: 0 }}>↗</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {g.items.map(it => (
                <button key={it.key} className="tg-btn" onClick={it.onAdd} title={it.title} style={ROW}>
                  <Icon d={it.icon} /><span style={LBL}>{it.label}</span><span className="tg-label" style={{ color: 'var(--text-faint)', flex: 'none', letterSpacing: '0.06em' }}>{g.tag}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
