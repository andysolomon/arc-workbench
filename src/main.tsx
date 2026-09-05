import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/index.css';
import { Workbench } from './app/Workbench';
import { StaticCanvas } from './app/StaticCanvas';
import { WorkbenchController, loadStress } from './app/controller';
import { runScenario, scenarioById } from './app/bench';
import type { BenchResult } from './app/budgets';
import type { ParadigmId } from './model';

// ?static=1 mounts the chrome-less canvas harness used for visual checks (StaticCanvas.tsx)
const q = new URLSearchParams(location.search);
const root = document.getElementById('root');
// ?zoomMode=smooth|crisp mirrors the DC prop for perf comparisons
const controller = new WorkbenchController(q.get('zoomMode') === 'smooth' || q.get('zoomMode') === 'crisp' ? { zoomMode: q.get('zoomMode') as 'smooth' | 'crisp' } : {});
// test hook: the controller and the stress loader for Playwright perf / interaction specs
declare global { interface Window { __workbench: { ctl: WorkbenchController; loadStress: (pid: ParadigmId, nodes: number, edges: number) => void; bench: (id: string) => Promise<BenchResult> } } }
window.__workbench = { ctl: controller, loadStress: (pid, n, e) => loadStress(controller, pid, n, e), bench: id => { const sc = scenarioById(id); if (!sc) throw new Error('unknown scenario ' + id); return runScenario(controller, sc); } };
// ?stress=1 opens the Stress Lab once the workspace is up (a development / benchmarking entry)
if (q.has('stress')) setTimeout(() => controller.setState({ stressOpen: true }), 300);
if (root) createRoot(root).render(<StrictMode>{q.has('static') ? <StaticCanvas /> : <Workbench controller={controller} />}</StrictMode>);
