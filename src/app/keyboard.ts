// Keyboard map (WB 2006–2043): / or ⌘K palette · ⌘Z / ⇧⌘Z undo · f fit · l layout · t trace ·
// n new · r run/pause · d theme · arrows step selection · Delete/Backspace deletes ·
// ? keyboard help · Enter inspects (or completes a connect) · c connect from the selection · ⇧arrows move it ·
// Escape unwinds drag → confirm → connect → help → palette → create → switcher → settings → card → selection.
import type { WorkbenchController } from './controller';

export function onKey(c: WorkbenchController, e: KeyboardEvent): void {
  const tag = ((e.target as HTMLElement | null)?.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  const onControl = tag === 'button' || tag === 'a' || tag === 'summary'; // Enter belongs to the control under focus
  const s = c.state;
  if (e.key === 'Escape') {
    if (c.gestures.cancelDrag()) return;
    if (s.confirm) c.setState({ confirm: null });
    else if (s.kbConnect) { c.setState({ kbConnect: null }); c.announce('connect cancelled'); }
    else if (s.helpOpen) c.setState({ helpOpen: false });
    else if (s.palette) c.setState({ palette: false });
    else if (s.createOpen) c.setState({ createOpen: false });
    else if (s.paraOpen) c.setState({ paraOpen: false });
    else if (s.settingsOpen) c.setState({ settingsOpen: false });
    else if (s.hoverEdge) c.closeCard();
    else c.setState({ sel: null, connect: null, rewire: null, focus: null });
    return;
  }
  if (s.palette) {
    const items = c.paletteItems();
    if (e.key === 'ArrowDown') { e.preventDefault(); c.setState(st => ({ pi: Math.min(items.length - 1, st.pi + 1) })); }
    if (e.key === 'ArrowUp') { e.preventDefault(); c.setState(st => ({ pi: Math.max(0, st.pi - 1) })); }
    if (e.key === 'Enter') { const it = items[s.pi]; if (it) it.run(); }
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) c.redo(); else c.undo(); return; }
  if (typing) return;
  if (e.key === '?') { e.preventDefault(); c.setState({ helpOpen: !s.helpOpen }); return; }
  if (s.helpOpen) return; // the help card is modal: only ? and Escape reach past it
  if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) { e.preventDefault(); c.openPalette(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && s.sel) c.deleteSel();
  if (e.key === 'Enter' && s.sel && !onControl) { e.preventDefault(); if (!c.finishConnect()) c.focusInspector(); return; }
  if (e.key === 'c' && s.sel?.kind === 'node') { c.startConnect(); return; }
  if (/^Arrow/.test(e.key) && e.shiftKey && s.sel?.kind === 'node') { e.preventDefault(); c.nudgeSel(e.key === 'ArrowLeft' ? -16 : e.key === 'ArrowRight' ? 16 : 0, e.key === 'ArrowUp' ? -16 : e.key === 'ArrowDown' ? 16 : 0); return; }
  if (e.key === 'f') c.userFit();
  if (e.key === 'l') c.autoLayout();
  if (e.key === 't') c.setUi('trace');
  if (e.key === 'n') c.setState({ createOpen: true, paraOpen: false });
  if (/^Arrow/.test(e.key)) { e.preventDefault(); c.moveSel(e.key); }
  if (e.key === 'r') c.toggleRunning();
  if (e.key === 'd') c.toggleTheme();
}
