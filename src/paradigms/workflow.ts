import { F, NAME } from './fields';
import { I } from './icons';
import type { Paradigm } from './types';

export const workflow: Paradigm = {
  id: 'workflow', label: 'workflow', title: 'Workflow', axis: 'process', family: 'amber',
  ask: 'What steps happen, who owns them, where do decisions happen, and how can execution branch?',
  blurb: 'lanes, steps, approvals, gates, retries, terminal outcomes',
  region: 'lane', layout: 'lanes',
  CATS: { act: { label: 'Actions' }, appr: { label: 'Approvals' }, dec: { label: 'Decisions' }, asy: { label: 'Async' }, rec: { label: 'Recovery' }, ev: { label: 'Evidence' }, lane: { label: 'Lanes' } },
  // lanes are owners, not nodes: the library entry is a command
  COMMANDS: { lane: [['lane', 'lane']] },
  TYPES: {
    action:   { label: 'Action',        cat: 'act',  family: 'indigo',  icon: I.box,     dur: 4,  pass: 1 },
    task:     { label: 'Manual task',   cat: 'act',  family: 'indigo',  icon: I.person,  dur: 30, pass: 1 },
    handoff:  { label: 'Handoff',       cat: 'act',  family: 'indigo',  icon: I.arrow,   dur: 10, pass: 1 },
    approval: { label: 'Approval',      cat: 'appr', family: 'amber',   icon: I.check,   dur: 240, pass: 0.85, human: true },
    auto:     { label: 'Auto approval', cat: 'appr', family: 'amber',   icon: I.shield,  dur: 1,  pass: 0.95 },
    gate:     { label: 'Gate',          cat: 'dec',  family: 'purple',  icon: I.gate,    dur: 6,  pass: 0.8 },
    decision: { label: 'Decision',      cat: 'dec',  family: 'purple',  icon: I.diamond, dur: 2,  pass: 0.7 },
    async:    { label: 'Async step',    cat: 'asy',  family: 'cyan',    icon: I.bolt,    dur: 15, pass: 1 },
    parallel: { label: 'Parallel fork', cat: 'asy',  family: 'cyan',    icon: I.split,   dur: 0,  pass: 1, fork: true },
    join:     { label: 'Join',          cat: 'asy',  family: 'cyan',    icon: I.merge,   dur: 0,  pass: 1 },
    wait:     { label: 'Wait',          cat: 'asy',  family: 'amber',   icon: I.clock,   dur: 60, pass: 1 },
    retry:    { label: 'Retry',         cat: 'rec',  family: 'orange',  icon: I.loop,    dur: 5,  pass: 0.6 },
    recovery: { label: 'Recovery',      cat: 'rec',  family: 'orange',  icon: I.shield,  dur: 20, pass: 0.9 },
    escalate: { label: 'Escalation',    cat: 'rec',  family: 'orange',  icon: I.bell,    dur: 45, pass: 1 },
    evidence: { label: 'Evidence',      cat: 'ev',   family: 'emerald', icon: I.doc,     dur: 1,  pass: 1, side: true },
    observe:  { label: 'Observability', cat: 'ev',   family: 'emerald', icon: I.eye,     dur: 0,  pass: 1, side: true },
    start:    { label: 'Start',         cat: 'act',  family: 'stone',   icon: I.play,    dur: 0,  pass: 1, source: true },
    end:      { label: 'Terminal',      cat: 'ev',   family: 'stone',   icon: I.stop,    dur: 0,  pass: 1, terminal: true },
    failed:   { label: 'Failed outcome', cat: 'rec', family: 'danger',  icon: I.x,       dur: 0,  pass: 1, terminal: true, bad: true },
  },
  EDGES: {
    next: { label: 'next', rel: 'flow', desc: 'normal progression' }, cond: { label: 'if', rel: 'flow', desc: 'conditional branch' },
    approve: { label: 'approved', rel: 'flow', desc: 'approval granted' }, deny: { label: 'denied', rel: 'dependency', desc: 'approval denied', alt: true },
    fail: { label: 'fail', rel: 'dependency', desc: 'failure path', alt: true }, retry: { label: 'retry', rel: 'dependency', desc: 'retry loop', alt: true },
    async: { label: 'async', rel: 'async', desc: 'asynchronous branch' }, recover: { label: 'recover', rel: 'flow', desc: 'recovery path' },
    observe: { label: 'evidence', rel: 'proposed', desc: 'observability / evidence', side: true },
  },
  defaultEdge: 'next',
  INSPECT: {
    node: [NAME, F('owner', 'owner', 'text', { ph: 'release owner · platform team' }), F('dur', 'duration (min)', 'number', { min: 0, half: true }), F('pass', 'pass rate 0–1', 'number', { min: 0, max: 1, step: 0.05, half: true }), F('input', 'input', 'text', { ph: 'signed commit' }), F('output', 'output', 'text', { ph: 'reviewed diff' })],
    edge: [F('kind', 'relationship', 'select'), F('label', 'event', 'text', { ph: 'tests_passed' }), F('guard', 'guard  [ condition ]', 'text', { ph: 'coverage >= 80' }), F('action', 'action  / effect', 'text', { ph: 'notify(reviewers)' })],
  },
  structured: true,
  HUD: { load: 'runs', unit: '/h', min: 1, max: 2000, a: 'cycle p99', b: 'completed', c: 'failed', d: 'in flight', rate: '/h' },
  sim: 'execution', unitNoun: 'steps', edgeNoun: 'transitions',
  METRICS: { arr: 'visits', lat: 'time in step', p99: 'p99', util: 'occupancy', q: 'waiting', err: 'fail share' },
  a11y: (a, e, b, T) => a + ' ' + (T.EDGES[e.kind]?.alt ? 'may fall to ' : 'is followed by ') + b + (e.label ? ' on ' + e.label : '') + (e.guard ? ' if ' + e.guard : '') + (e.action ? ', then ' + e.action : '') + '.',
};
