import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/index.css';
import { Workbench } from './app/Workbench';
import { StaticCanvas } from './app/StaticCanvas';
import { WorkbenchController, loadStress } from './app/controller';
import type { ParadigmId } from './model';

// ?static=1 mounts the chrome-less canvas harness used for visual checks (StaticCanvas.tsx)
const q = new URLSearchParams(location.search);
const root = document.getElementById('root');
// ?zoomMode=smooth|crisp mirrors the DC prop for perf comparisons
const controller = new WorkbenchController(q.get('zoomMode') === 'smooth' || q.get('zoomMode') === 'crisp' ? { zoomMode: q.get('zoomMode') as 'smooth' | 'crisp' } : {});
// test hook: the controller and the stress loader for Playwright perf / interaction specs
declare global { interface Window { __workbench: { ctl: WorkbenchController; loadStress: (pid: ParadigmId, nodes: number, edges: number) => void } } }
window.__workbench = { ctl: controller, loadStress: (pid, n, e) => loadStress(controller, pid, n, e) };
if (root) createRoot(root).render(<StrictMode>{q.has('static') ? <StaticCanvas /> : <Workbench controller={controller} />}</StrictMode>);
