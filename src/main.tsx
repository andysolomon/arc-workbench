import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/index.css';
import { Workbench } from './app/Workbench';
import { StaticCanvas } from './app/StaticCanvas';

// ?static=1 mounts the chrome-less canvas harness used for visual checks (StaticCanvas.tsx)
const q = new URLSearchParams(location.search);
const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode>{q.has('static') ? <StaticCanvas /> : <Workbench />}</StrictMode>);
