// header: title · paradigm switcher · undo/redo · lens · HUD · presets · settings · theme · commands · share (WB 135–252)
import type { WorkbenchController } from '../app/controller';
import { EXAMPLES } from '../paradigms';
import { SHARED_PRESET } from '../app/share';
import { LogoMark } from './ds/LogoMark';
import { DraftingHud, Hud } from './Hud';
import { ParadigmSwitcher } from './ParadigmSwitcher';
import { Settings } from './Settings';

const SEP = { width: '1px', height: '22px', background: 'var(--border-subtle)', flex: 'none' } as const;

export function Header({ ctl, tierCount, unlinked }: { ctl: WorkbenchController; tierCount: number; unlinked: number }) {
  const s = ctl.state, simOn = s.mode !== 'design';
  const presets = EXAMPLES[s.paradigm].map(p => ({ id: p.id, name: p.name })).concat([{ id: 'blank', name: 'Blank' }]);
  if (s.presetId === SHARED_PRESET) presets.unshift({ id: SHARED_PRESET, name: 'Shared link' });
  return (
    <div style={{ flex: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 10px', padding: '7px 14px', background: 'var(--surface-page)', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 'none' }}>
        <LogoMark size={22} />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-body)' }}>Workbench</span>
        <ParadigmSwitcher ctl={ctl} />
        <input className="tg-input wb-title" value={s.title} onChange={e => ctl.setTitle(e.target.value)} aria-label="document title" title="document title" spellCheck={false} />
        <div style={{ display: 'flex', gap: '4px', paddingLeft: '2px' }}>
          <button className="tg-btn wb-ico" onClick={() => ctl.undo()} title="undo" aria-label="undo" style={{ opacity: ctl.history.canUndo ? 1 : 0.4, minWidth: '30px' }}>↩</button>
          <button className="tg-btn wb-ico" onClick={() => ctl.redo()} title="redo" aria-label="redo" style={{ opacity: ctl.history.canRedo ? 1 : 0.4, minWidth: '30px' }}>↪</button>
        </div>
      </div>
      <div style={SEP} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 'none' }}>
        <button className={'tg-btn ' + (s.mode === 'design' ? 'tg-btn--active' : '')} onClick={() => ctl.setMode('design')}>design</button>
        <button className={'tg-btn ' + (s.mode === 'simulate' ? 'tg-btn--active' : '')} onClick={() => ctl.setMode('simulate')}>simulate</button>
        <button className={'tg-btn ' + (s.mode === 'analyze' ? 'tg-btn--active' : '')} onClick={() => ctl.setMode('analyze')}>analyze</button>
      </div>
      <div className="wb-vsep-hud" style={SEP} />
      {simOn ? <Hud ctl={ctl} /> : <DraftingHud ctl={ctl} tierCount={tierCount} unlinked={unlinked} />}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', flex: 'none', marginLeft: 'auto' }}>
        <select className="tg-select wb-preset" value={s.presetId} onChange={e => ctl.loadPreset(e.target.value)} aria-label="example preset" title={(presets.find(p => p.id === s.presetId)?.name ?? '') + ' · example preset'} style={{ cursor: 'pointer' }}>
          {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className={'tg-btn ' + (s.settingsOpen ? 'tg-btn--active' : '')} onClick={() => ctl.setState({ settingsOpen: !s.settingsOpen })} title="display settings" aria-label="display settings">settings</button>
        {s.settingsOpen ? <Settings ctl={ctl} /> : null}
        <button className="tg-btn wb-ico" onClick={() => ctl.toggleTheme()} title="toggle dark mode" aria-label="toggle theme">{ctl.th() === 'dark' ? '☀' : '☾'}</button>
        <button className="tg-btn wb-cmd" onClick={() => ctl.openPalette()} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>commands <span style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', borderRadius: '3px', padding: '0 4px', fontSize: '10px' }}>/</span></button>
        <button className="tg-btn tg-btn--primary" onClick={() => { void ctl.share(); }} title="copy a link to this diagram">share</button>
      </div>
    </div>
  );
}
