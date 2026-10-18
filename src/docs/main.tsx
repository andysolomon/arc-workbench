import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// the design-system tokens and primitives, without the app chrome (workbench.css pins the viewport)
import '@typegram/graph/tokens/fonts.css';
import '@typegram/graph/tokens/colors.css';
import '@typegram/graph/tokens/typography.css';
import '@typegram/graph/tokens/spacing.css';
import '@typegram/graph/tokens/base.css';
import '@typegram/graph/tokens/graph.css';
import '@typegram/graph/tokens/motion.css';
import '@typegram/graph/components/components.css';
import '@typegram/graph/tokens/themes.css';
import '@typegram/graph/tokens/paradigms.css';
import './docs.css';
import { SystemDesigns } from './SystemDesigns';

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><SystemDesigns /></StrictMode>);
