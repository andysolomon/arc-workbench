import { F, NAME } from './fields';
import { I } from './icons';
import type { Paradigm } from './types';

export const state: Paradigm = {
  id: 'state', label: 'state machine', title: 'State Machine', axis: 'lifecycle', family: 'indigo',
  ask: 'What states can an object occupy, and what events move it between them?',
  blurb: 'states, transitions, guards, waits, retries, terminal outcomes',
  region: 'phase', layout: 'ranked',
  CATS: { st: { label: 'States' }, wait: { label: 'Wait' }, appr: { label: 'Approval' }, fail: { label: 'Failure' }, term: { label: 'Terminal' } },
  TYPES: {
    initial:   { label: 'Initial',   cat: 'st',   family: 'stone',   icon: I.play,    dwell: 1,   cap: 1e9, initial: true },
    active:    { label: 'Active',    cat: 'st',   family: 'indigo',  icon: I.box,     dwell: 20,  cap: 50 },
    review:    { label: 'Review',    cat: 'st',   family: 'indigo',  icon: I.eye,     dwell: 30,  cap: 20 },
    waiting:   { label: 'Waiting',   cat: 'wait', family: 'amber',   icon: I.clock,   dwell: 120, cap: 200 },
    paused:    { label: 'Paused',    cat: 'wait', family: 'amber',   icon: I.stop,    dwell: 240, cap: 200 },
    approval:  { label: 'Needs approval', cat: 'appr', family: 'amber', icon: I.check, dwell: 360, cap: 40, human: true },
    blocked:   { label: 'Blocked',   cat: 'fail', family: 'purple',  icon: I.gate,    dwell: 180, cap: 100 },
    retrying:  { label: 'Retrying',  cat: 'fail', family: 'orange',  icon: I.loop,    dwell: 5,   cap: 100 },
    rollback:  { label: 'Rolling back', cat: 'fail', family: 'orange', icon: I.merge, dwell: 10,  cap: 20 },
    completed: { label: 'Completed', cat: 'term', family: 'emerald', icon: I.check,   dwell: 0,   cap: 1e9, terminal: true },
    failed:    { label: 'Failed',    cat: 'term', family: 'danger',  icon: I.x,       dwell: 0,   cap: 1e9, terminal: true, bad: true },
    cancelled: { label: 'Cancelled', cat: 'term', family: 'danger',  icon: I.stop,    dwell: 0,   cap: 1e9, terminal: true, bad: true },
    expired:   { label: 'Expired',   cat: 'term', family: 'danger',  icon: I.clock,   dwell: 0,   cap: 1e9, terminal: true, bad: true },
  },
  EDGES: {
    event:   { label: 'event',   rel: 'flow', desc: 'named event' }, guard: { label: 'guard', rel: 'flow', desc: 'guarded transition' },
    timeout: { label: 'timeout', rel: 'dependency', desc: 'time-based exit', alt: true }, failure: { label: 'failure', rel: 'dependency', desc: 'error transition', alt: true, bad: true },
    retry:   { label: 'retry',   rel: 'dependency', desc: 'retry loop', alt: true }, cancel: { label: 'cancel', rel: 'dependency', desc: 'user cancellation', alt: true, bad: true },
    approve: { label: 'approved', rel: 'flow', desc: 'human approval' }, rollback: { label: 'rollback', rel: 'dependency', desc: 'revert to safe state', alt: true },
  },
  defaultEdge: 'event',
  INSPECT: {
    node: [NAME, F('dwell', 'mean time in state (min)', 'number', { min: 0, half: true }), F('cap', 'capacity', 'number', { min: 1, half: true }), F('entry', 'entry action', 'text', { ph: 'lock inputs' }), F('exit', 'exit action', 'text', { ph: 'emit deployment.ready' })],
    edge: [F('kind', 'transition', 'select'), F('label', 'event', 'text', { ph: 'payment_received' }), F('guard', 'guard  [ condition ]', 'text', { ph: 'amount > 0' }), F('action', 'action  / effect', 'text', { ph: 'capture()' }), F('p', 'relative weight', 'number', { min: 0, max: 1, step: 0.05, half: true }), F('timeout', 'timeout (min)', 'number', { min: 0, half: true })],
  },
  HUD: { load: 'objects', unit: '/h', min: 1, max: 5000, a: 'lifetime p99', b: 'completed', c: 'bad exits', d: 'in flight', rate: '/h' },
  structured: true,
  sim: 'markov', unitNoun: 'states', edgeNoun: 'transitions',
  METRICS: { arr: 'entries', lat: 'time in state', p99: 'p99', util: 'occupancy', q: 'objects', err: 'bad exits' },
  a11y: (a, e, b, T) => a + ' transitions to ' + b + ' on ' + (e.label || (T.EDGES[e.kind]?.label ?? '')) + (e.guard ? ' if ' + e.guard : '') + (e.action ? ', then ' + e.action : '') + '.',
};
