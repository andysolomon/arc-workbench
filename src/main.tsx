import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/index.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><div data-screen-label="Workbench" /></StrictMode>);
