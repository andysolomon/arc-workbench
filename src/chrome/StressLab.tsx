// Stress Lab: the benchmark matrix as a dialog. Load a fixture to feel it, run a scenario to
// measure it against the documented budgets, copy the JSON to compare with another run.
import { useEffect, useRef, useState } from 'react';
import type { WorkbenchController } from '../app/controller';
import { loadStress } from '../app/controller';
import { describeEnv, probeEnv, runScenario } from '../app/bench';
import { SCENARIOS, failed, judge, skipped, type BenchEnv, type BenchResult, type Verdict } from '../app/budgets';
import { useDialog } from './useDialog';

const fmt = (v: number | null, unit: string): string => v == null ? 'n/a' : (Number.isInteger(v) ? String(v) : v.toFixed(1)) + (unit ? ' ' + unit : '');

export function StressLab({ ctl }: { ctl: WorkbenchController }) {
  const closeRef = useRef<HTMLButtonElement>(null), ref = useDialog(closeRef);
  const [results, setResultsState] = useState<Record<string, BenchResult>>(ctl.benchResults);
  const setResults = (next: Record<string, BenchResult>): void => { ctl.benchResults = next; setResultsState(next); };
  const [running, setRunning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // the environment is probed on open (~10 idle frames) so the lab says up front what it can assert
  const [env, setEnv] = useState<BenchEnv | null>(null);
  useEffect(() => { let live = true; void probeEnv().then(e => { if (live) setEnv(e); }); return () => { live = false; }; }, []);
  const close = (): void => ctl.setState({ stressOpen: false });
  const run = async (ids: string[]): Promise<void> => {
    for (const id of ids) {
      const sc = SCENARIOS.find(s => s.id === id)!; setRunning(id);
      ctl.setState({ stressOpen: false }); // measure the canvas, not the dialog
      const r = await runScenario(ctl, sc);
      setResults({ ...ctl.benchResults, [id]: r });
    }
    setRunning(null); ctl.setState({ stressOpen: true });
  };
  const copy = async (): Promise<void> => { try { await navigator.clipboard.writeText(JSON.stringify({ at: new Date().toISOString(), results, verdicts: Object.fromEntries(Object.values(results).map(r => [r.scenario, judge(r)])) }, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } };
  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '60px', zIndex: 55 }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="wb-stress-title" onClick={e => e.stopPropagation()} style={{ width: '760px', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 90px)', display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', boxShadow: 'var(--shadow-panel)', overflow: 'hidden', animation: 'wb-fade var(--motion-fast) ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 id="wb-stress-title" style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em' }}>Stress Lab</h2>
          <span style={{ color: 'var(--text-muted)' }}>deterministic fixtures · budgets from README § Performance contract</span>
          <button ref={closeRef} className="tg-btn wb-ico" onClick={close} aria-label="close" style={{ marginLeft: 'auto', background: 'transparent', borderColor: 'transparent', color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 18px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }} tabIndex={0} aria-label="scenarios">
          <div className="wb-bench-env" data-supported={env ? (env.supported ? '1' : '0') : undefined} role="status">
            {env ? <><b>environment</b> · {describeEnv(env)}{env.supported ? null : <> — timing budgets need a visible tab with an unthrottled frame clock; structural budgets (DOM · re-renders · culling · heap) are still asserted</>}</> : 'probing the environment…'}
          </div>
          <table className="wb-bench">
            <thead><tr><th>scenario</th><th>fixture</th><th></th><th></th><th>verdict</th></tr></thead>
            <tbody>
              {SCENARIOS.map(sc => { const r = results[sc.id], vs = r ? judge(r) : null, bad = vs ? failed(vs) : []; return (
                <tr key={sc.id} data-pass={vs ? (bad.length ? '0' : '1') : undefined}>
                  <td>{sc.label}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{sc.heapCycles ? sc.heapCycles + ' cycles' : sc.nodes + ' n · ' + sc.edges + ' e'}</td>
                  <td>{sc.heapCycles ? null : <button className="tg-btn" onClick={() => { loadStress(ctl, sc.paradigm, sc.nodes, sc.edges); close(); }}>load</button>}</td>
                  <td><button className="tg-btn" disabled={!!running} onClick={() => { void run([sc.id]); }}>{running === sc.id ? 'running…' : 'run'}</button></td>
                  <td>{vs ? <VerdictCell vs={vs} /> : <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                </tr>
              ); })}
            </tbody>
          </table>
          {Object.values(results).map(r => <Report key={r.scenario} r={r} />)}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 18px', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>a loaded fixture is one undo away from your document and is never autosaved</span>
          <button className="tg-btn" style={{ marginLeft: 'auto' }} disabled={!!running} onClick={() => { void run(SCENARIOS.map(s => s.id)); }}>run all</button>
          <button className="tg-btn tg-btn--primary" disabled={!Object.keys(results).length} onClick={() => { void copy(); }}>{copied ? 'copied' : 'copy json'}</button>
        </div>
      </div>
    </div>
  );
}
function VerdictCell({ vs }: { vs: Verdict[] }) {
  const bad = failed(vs), skip = skipped(vs).length;
  return <span style={{ color: bad.length ? 'var(--health-critical)' : 'var(--health-ok)' }}>{bad.length ? bad.length + ' over budget' : 'within budget'}{skip ? <span style={{ color: 'var(--text-faint)' }}> · {skip} skipped</span> : null}</span>;
}
function Report({ r }: { r: BenchResult }) {
  const vs = judge(r);
  return (
    <details className="wb-bench-report" open={failed(vs).length > 0}>
      <summary>{r.scenario} · {r.nodes} nodes · {r.edges} edges · DOM {r.dom.elements} · svg {r.dom.svgs} · paths {r.dom.paths} · {r.env.software ? 'software renderer' : 'hardware renderer'}{r.env.supported ? '' : ' · unsupported environment'}</summary>
      <table className="wb-bench">
        <thead><tr><th>budget</th><th>measured</th><th>limit</th><th></th></tr></thead>
        <tbody>{vs.map(v => <tr key={v.key} data-pass={v.pass === null ? undefined : v.pass ? '1' : '0'}><td>{v.label}</td><td>{fmt(v.value, v.unit)}</td><td>{fmt(v.limit, v.unit)}</td><td>{v.pass === null ? <span style={{ color: 'var(--text-faint)' }}>skipped · {v.reason}</span> : v.pass ? 'pass' : 'FAIL'}</td></tr>)}</tbody>
      </table>
      <div style={{ color: 'var(--text-faint)', fontSize: '10px', marginTop: '4px' }}>{describeEnv(r.env)} · pan {r.pan.frames} frames{r.pan.frames ? ' after ' + r.pan.warmup + ' warm-up (cold start ' + r.pan.coldMs.toFixed(0) + ' ms)' : ''} · telemetry {r.telemetry.passes} passes (renders node {r.telemetry.nodeRenders} · edge {r.telemetry.edgeRenders}) · findings {r.analyze.findings} · long tasks {r.longTasks.n}{r.heap ? ' · heap ' + r.heap.beforeMB + ' → ' + r.heap.afterMB + ' MB' : ''}</div>
    </details>
  );
}
