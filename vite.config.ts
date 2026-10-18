import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // the app at /, the System designs page at /docs/ (figures are static pages in public/figures/)
  server: { port: 5173, strictPort: true, allowedHosts: ['.ts.net'] },
  preview: { allowedHosts: ['.ts.net'] },
  build: { target: 'es2022', sourcemap: true, rollupOptions: { input: { main: resolve(__dirname, 'index.html'), docs: resolve(__dirname, 'docs/index.html') } } },
});
