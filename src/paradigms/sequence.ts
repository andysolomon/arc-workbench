import { F, NAME } from './fields';
import { I } from './icons';
import type { Paradigm } from './types';

export const sequence: Paradigm = {
  id: 'sequence', label: 'sequence', title: 'Sequence', axis: 'time', family: 'cyan',
  ask: 'Who calls whom, in what order, and what returns?',
  blurb: 'participants, lifelines, messages, activations, phases',
  region: 'phase', layout: 'timeline',
  CATS: { part: { label: 'Participants' }, msg: { label: 'Messages' }, grp: { label: 'Groups' }, asy: { label: 'Async' }, fail: { label: 'Failure' } },
  TYPES: {
    client:   { label: 'Client',   cat: 'part', family: 'stone',   icon: I.person, conc: 1e9 },
    service:  { label: 'Service',  cat: 'part', family: 'indigo',  icon: I.box,    conc: 64 },
    api:      { label: 'API',      cat: 'part', family: 'cyan',    icon: I.arrow,  conc: 128 },
    auth:     { label: 'Auth',     cat: 'part', family: 'purple',  icon: I.shield, conc: 200 },
    cache:    { label: 'Cache',    cat: 'part', family: 'emerald', icon: I.bolt,   conc: 1000 },
    db:       { label: 'Database', cat: 'part', family: 'emerald', icon: I.db,     conc: 40 },
    queue:    { label: 'Queue',    cat: 'part', family: 'amber',   icon: I.lines,  conc: 1e9 },
    external: { label: 'External', cat: 'part', family: 'stone',   icon: I.cube,   conc: 1e9 },
  },
  // library groups for non-participant entries are commands, not nodes
  COMMANDS: {
    msg: [['request', 'request'], ['response', 'response'], ['event', 'event']], grp: [['phase', 'phase']],
    asy: [['async', 'async'], ['callback', 'callback']], fail: [['retry', 'retry'], ['timeout', 'timeout'], ['error', 'error']],
  },
  EDGES: {
    request:  { label: 'request',  rel: 'flow', desc: 'synchronous call' },
    response: { label: 'response', rel: 'dependency', desc: 'return value', back: true },
    async:    { label: 'async',    rel: 'async', desc: 'fire and forget', nowait: true },
    callback: { label: 'callback', rel: 'async', desc: 'webhook / callback', nowait: true },
    event:    { label: 'event',    rel: 'async', desc: 'published event', nowait: true },
    retry:    { label: 'retry',    rel: 'dependency', desc: 'repeated call', alt: true },
    timeout:  { label: 'timeout',  rel: 'dependency', desc: 'no answer in time', alt: true, bad: true },
    error:    { label: 'error',    rel: 'dependency', desc: 'error return', alt: true, bad: true, back: true },
  },
  defaultEdge: 'request',
  INSPECT: {
    node: [NAME, F('role', 'role', 'text', { ph: 'browser session · request edge' }), F('conc', 'concurrency', 'number', { min: 1 })],
    edge: [F('kind', 'message type', 'select'), F('label', 'message', 'text', { ph: 'GET /dashboard' }), F('lat', 'latency (ms)', 'number', { min: 0, half: true }), F('seq', 'order', 'number', { min: 1, half: true }), F('payload', 'payload', 'text', { ph: 'jwt · user id' })],
  },
  HUD: { load: 'load', unit: 'req/s', min: 1, max: 20000, a: 'roundtrip p99', b: 'served', c: 'errors', d: 'timeouts', rate: '/s' },
  sim: 'timeline', unitNoun: 'participants', edgeNoun: 'messages',
  METRICS: { arr: 'calls', lat: 'busy per req', p99: 'p99', util: 'util', q: 'inbound msgs', err: 'errors' },
  a11y: (a, e, b, T) => a + ' sends ' + (e.label || (T.EDGES[e.kind]?.label ?? '')) + ' to ' + b + (e.lat ? ' (' + e.lat + ' ms)' : '') + '.',
};
