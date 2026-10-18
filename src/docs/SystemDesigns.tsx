// The System designs page (/docs/): every example document explained, with the numbers the
// Workbench's own engines derive from it and, where it is built, an Anatomy figure that shows
// the design as a machine you can operate. Figures are standalone pages in public/figures/
// (built by figures/build.mjs); they report their height so the frame fits them.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ParadigmId } from '../model/document';
import { ORDER, PARADIGMS } from '../paradigms';
import { fmt } from '../sim';
import { LogoMark } from '../chrome/ds/LogoMark';
import { DESIGNS, type Design } from './designs';
import { exampleOf, factsOf, workbenchHref, type Facts } from './facts';

type Theme = 'dark' | 'light';
const THEME_KEY = 'wb.docs.theme';
const pct = (v: number): string => Math.round(v * 100) + '%';
const rps = (v: number): string => fmt(v) + ' rps';
const healthOf = (u: number): 'ok' | 'warn' | 'crit' => (u >= 1 ? 'crit' : u > 0.72 ? 'warn' : 'ok');

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* storage unavailable: fall back to the Workbench default */ }
  return 'dark';
}
function applyTheme(t: Theme): void {
  const h = document.documentElement;
  if (t === 'dark') h.setAttribute('data-theme', 'dark'); else h.removeAttribute('data-theme');
  h.style.colorScheme = t;
}

function Figure({ design, theme }: { design: Design; theme: Theme }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(560);
  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (event.source !== frame.current?.contentWindow || typeof data !== 'object' || data === null) return;
      const h = (data as { type?: unknown; height?: unknown }).height;
      if ((data as { type?: unknown }).type === 'anatomy-figure-height' && typeof h === 'number' && h > 0) setHeight(Math.ceil(h));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  const f = design.figure;
  if (f.status === 'live' && f.file) {
    const src = '../figures/' + f.file + (theme === 'light' ? '-light' : '') + '.html?embed';
    return (
      <figure className="wb-doc-figure" data-status="live">
        <iframe ref={frame} src={src} title={design.title + ' — interactive figure'} loading="lazy" style={{ height }} />
        <figcaption>{f.object}</figcaption>
      </figure>
    );
  }
  return (
    <figure className="wb-doc-figure" data-status="planned">
      <div className="wb-doc-planned">
        <span className="wb-doc-planned-tag">figure planned</span>
        <p>{f.object}</p>
      </div>
    </figure>
  );
}

function FactsPanel({ facts }: { facts: Facts }) {
  if (facts.kind === 'queueing') {
    return (
      <div className="wb-doc-facts">
        <p className="wb-doc-facts-line">
          Offered load <b>{rps(facts.rps)}</b>
          {facts.first ? <> · first to saturate <b>{facts.first.name}</b> at <b>{rps(facts.first.at)}</b></> : null}
        </p>
        <table>
          <thead><tr><th scope="col">node</th><th scope="col">capacity</th><th scope="col">at the preset load</th></tr></thead>
          <tbody>
            {facts.rows.map((r) => (
              <tr key={r.id} data-health={healthOf(r.util)}>
                <th scope="row">{r.name}<span>{r.type} · {r.inst} × {fmt(r.cap)} in flight · {r.ms} ms</span></th>
                <td>{rps(r.max)}</td>
                <td>
                  <span className="wb-doc-bar" aria-hidden="true"><i style={{ width: Math.min(100, (r.util / 1.4) * 100) + '%' }} /></span>
                  {r.util >= 1 ? 'saturated' : pct(r.util)}{r.err > 0.005 ? ' · ' + pct(r.err) + ' errors' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (facts.kind === 'execution') {
    return (
      <div className="wb-doc-facts">
        <ol className="wb-doc-path" aria-label="happy path">{facts.path.map((step) => <li key={step}>{step}</li>)}</ol>
        <dl>
          <div><dt>happy path</dt><dd>{fmt(facts.minutes)} min · {(facts.minutes / 60).toFixed(1)} h</dd></div>
          <div><dt>through first time</dt><dd>{pct(facts.yieldShare)}</dd></div>
          <div><dt>rework and failure edges</dt><dd>{facts.rework}</dd></div>
          <div><dt>owners</dt><dd>{facts.owners}</dd></div>
        </dl>
      </div>
    );
  }
  if (facts.kind === 'timeline') {
    return (
      <div className="wb-doc-facts">
        <dl>
          <div><dt>round trip</dt><dd>{facts.total} ms</dd></div>
          <div><dt>messages</dt><dd>{facts.messages} · {facts.async} fire-and-forget</dd></div>
          {facts.slowest ? <div><dt>slowest hop</dt><dd>{facts.slowest.label} · {facts.slowest.lat} ms · {pct(facts.slowest.share)} of the trip</dd></div> : null}
        </dl>
      </div>
    );
  }
  return (
    <div className="wb-doc-facts">
      <p className="wb-doc-facts-line">Where runs end up, from the transition weights{facts.humanGates ? <> · {facts.humanGates} human gate{facts.humanGates > 1 ? 's' : ''}</> : null}</p>
      <table>
        <tbody>
          {facts.outcomes.map((o) => (
            <tr key={o.name} data-health={o.bad ? 'crit' : 'ok'}>
              <th scope="row">{o.name}</th>
              <td><span className="wb-doc-bar" aria-hidden="true"><i style={{ width: o.share * 100 + '%' }} /></span>{pct(o.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ design, theme }: { design: Design; theme: Theme }) {
  const ex = exampleOf(design.paradigm, design.id);
  const facts = useMemo(() => factsOf(design.paradigm, ex), [design.paradigm, ex]);
  const href = useMemo(() => workbenchHref(design.paradigm, ex), [design.paradigm, ex]);
  const P = PARADIGMS[design.paradigm];
  return (
    <section id={design.id} className="wb-doc-section" data-family={P.family} aria-labelledby={design.id + '-title'}>
      <p className="wb-doc-eyebrow">{P.title} · {ex.nodes.length} {P.unitNoun} · {ex.edges.length} {P.edgeNoun}</p>
      <h2 id={design.id + '-title'}>{design.title}</h2>
      <p className="wb-doc-lede">{design.lede}</p>
      <Figure design={design} theme={theme} />
      <div className="wb-doc-body">
        <div>
          <h3>How it works</h3>
          {design.how.map((p) => <p key={p}>{p}</p>)}
          <aside className="wb-doc-watch"><h3>What to watch</h3><p>{design.watch}</p></aside>
        </div>
        <div>
          <h3>Measured</h3>
          <FactsPanel facts={facts} />
          <a className="tg-btn wb-doc-open" href={href}>open in Workbench →</a>
        </div>
      </div>
    </section>
  );
}

export function SystemDesigns() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable: the choice lasts this visit */ }
  }, [theme]);
  // sections mount after the browser has tried the #fragment, so land on it once they exist
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  const groups = ORDER.map((pid: ParadigmId) => ({ pid, designs: DESIGNS.filter((d) => d.paradigm === pid) })).filter((g) => g.designs.length);
  const live = DESIGNS.filter((d) => d.figure.status === 'live').length;
  return (
    <div className="wb-doc">
      <header className="wb-doc-header">
        <a className="wb-doc-brand" href="../"><LogoMark size={26} /><span>Workbench</span></a>
        <span className="wb-doc-crumb">System designs</span>
        <span className="wb-doc-spacer" />
        <button type="button" className="tg-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}>{theme === 'dark' ? 'light' : 'dark'}</button>
        <a className="tg-btn tg-btn--primary" href="../">open Workbench</a>
      </header>
      <div className="wb-doc-layout">
        <nav className="wb-doc-toc" aria-label="System designs">
          {groups.map((g) => (
            <div key={g.pid}>
              <p>{PARADIGMS[g.pid].title}</p>
              <ul>{g.designs.map((d) => <li key={d.id}><a href={'#' + d.id} data-status={d.figure.status}>{d.title}</a></li>)}</ul>
            </div>
          ))}
        </nav>
        <main className="wb-doc-main">
          <div className="wb-doc-intro">
            <h1>System designs</h1>
            <p>The Workbench ships {DESIGNS.length} example documents across its five paradigms. Each one is explained here: what it is, how it works, and what to watch when you put load through it. The numbers aren't written by hand. They come from the same queueing, execution, timeline and Markov engines the Workbench uses to simulate the document, so they change when a preset does.</p>
            <p>Each design also gets an Anatomy figure, which draws it as a physical machine you can operate. So far {live} of the {DESIGNS.length} {live === 1 ? 'is' : 'are'} built; the others say which machine they will be.</p>
          </div>
          {DESIGNS.map((d) => <Section key={d.id} design={d} theme={theme} />)}
        </main>
      </div>
    </div>
  );
}
