// @vitest-environment jsdom
// Share links carry the whole document in the fragment; decoding is guarded, so junk never loads.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchController } from '../../src/app/controller';
import { SHARED_PRESET, decodeDocument, docOf, encodeDocument, sharePayload, shareUrl } from '../../src/app/share';
import { EXAMPLES } from '../../src/paradigms';

let ctl: WorkbenchController;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
  ctl = new WorkbenchController(); ctl.loadPreset(EXAMPLES.workflow[0]!.id); ctl.switchParadigm('workflow'); ctl.store.drainAfterCommit(); ctl.store.drainAfterCommit();
  ctl.setState({ mode: 'design', ready: true });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); history.replaceState(null, '', location.pathname); });

describe('share codec', () => {
  it('round-trips the live document through the fragment, unicode labels included', () => {
    ctl.setState({ rps: 321, view: { x: 1, y: 2, k: 0.75 } });
    ctl.setState(s => ({ nodes: s.nodes.map((n, i) => i ? n : { ...n, name: 'déploiement · ✓' }) }));
    const doc = docOf(ctl.state), back = decodeDocument(encodeDocument(doc));
    expect(back).toEqual(doc);
    expect(back!.metadata.load).toBe(321); expect(back!.paradigm).toBe('workflow');
    const url = shareUrl(ctl.state, { origin: 'https://wb.test', pathname: '/', search: '?zoomMode=crisp' });
    expect(url.startsWith('https://wb.test/?zoomMode=crisp#d=')).toBe(true);
    expect(/^[A-Za-z0-9_-]+$/.test(sharePayload(new URL(url).hash)!)).toBe(true);
  });
  it('rejects junk: not base64, not json, not a document', () => {
    expect(decodeDocument('%%%')).toBeNull();
    expect(decodeDocument(btoa('not json'))).toBeNull();
    expect(decodeDocument(btoa(JSON.stringify({ version: 3, nodes: [] })))).toBeNull();
    expect(sharePayload('')).toBeNull(); expect(sharePayload('#x=1')).toBeNull();
  });
});

describe('controller share', () => {
  it('share() writes the fragment, copies the link and raises a toast that retires', async () => {
    const writeText = vi.fn((_: string) => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText }, maxTouchPoints: 0 });
    expect(await ctl.share()).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    const url = writeText.mock.calls[0]![0];
    expect(url).toBe(location.href); expect(sharePayload(location.hash)).not.toBeNull();
    expect(ctl.state.toast).toEqual({ text: 'link copied · ' + ctl.state.nodes.length + ' steps · ' + ctl.state.edges.length + ' transitions', tone: 'ok' });
    vi.advanceTimersByTime(3000); expect(ctl.state.toast).toBeNull();
  });
  it('share() without a clipboard still updates the URL and says so', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined, maxTouchPoints: 0 });
    expect(await ctl.share()).toBe(false);
    expect(sharePayload(location.hash)).not.toBeNull();
    expect(ctl.state.toast?.tone).toBe('warn'); expect(ctl.state.toast?.text).toContain('address bar');
  });
  it('openLocation() loads a shared document into its paradigm, or falls back with a warning', () => {
    ctl.setState({ rps: 555 });
    const url = shareUrl(ctl.state, location); const nodes = ctl.state.nodes.length;
    const fresh = new WorkbenchController(); fresh.loadPreset(EXAMPLES.dataflow[0]!.id);
    history.replaceState(null, '', url);
    fresh.openLocation();
    expect(fresh.state.paradigm).toBe('workflow'); expect(fresh.state.presetId).toBe(SHARED_PRESET);
    expect(fresh.state.nodes.length).toBe(nodes); expect(fresh.state.rps).toBe(555); expect(fresh.state.toast).toBeNull();
    expect(fresh.docs.dataflow?.nodes.length).toBe(EXAMPLES.dataflow[0]!.nodes.length);
    // a link pasted into a mounted tab opens on hashchange; the fragment share() wrote itself does not re-open
    const live = new WorkbenchController(); history.replaceState(null, '', location.pathname); live.mount(); live.store.drainAfterCommit();
    expect(live.state.paradigm).toBe('dataflow');
    history.replaceState(null, '', url); window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(live.state.paradigm).toBe('workflow'); expect(live.state.presetId).toBe(SHARED_PRESET);
    live.unmount();
    history.replaceState(null, '', location.pathname + '#d=garbage');
    const other = new WorkbenchController(); other.openPreset(EXAMPLES.dataflow[0]!.id); const kept = other.state.nodes; other.openLocation();
    expect(other.state.nodes).toBe(kept); expect(other.state.toast?.tone).toBe('warn');
  });
});
