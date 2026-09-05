// The prototype modules, imported as-is from the export so parity tests compare against the
// actual source of truth rather than a copy.
/* eslint-disable */
// @ts-nocheck — the prototype is untyped JS; tests coerce at the boundary.
const P = '../../Form submission process/';
export const protoParadigms = () => import(/* @vite-ignore */ P + 'paradigms.js') as Promise<any>;
export const protoPresets = () => import(/* @vite-ignore */ P + 'presets.js') as Promise<any>;
export const protoExamples = () => import(/* @vite-ignore */ P + 'examples.js') as Promise<any>;
export const protoLayout = () => import(/* @vite-ignore */ P + 'layout.js') as Promise<any>;
export const protoSim = () => import(/* @vite-ignore */ P + 'sim-engine.js') as Promise<any>;
export const protoSimParadigms = () => import(/* @vite-ignore */ P + 'sim-paradigms.js') as Promise<any>;
export const protoAnalyze = () => import(/* @vite-ignore */ P + 'analyze-paradigms.js') as Promise<any>;
