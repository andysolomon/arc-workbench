import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/index.css';
import { StaticCanvas } from './app/StaticCanvas';

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><StaticCanvas /></StrictMode>);
