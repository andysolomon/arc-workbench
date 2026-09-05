import { F, NAME } from './fields';
import { CATS as ARCH_CATS, TYPES as ARCH_TYPES } from './presets';
import type { HudSpec, Paradigm } from './types';

export const HEALTH_SIM: HudSpec = { load: 'load', unit: 'req/s', min: 100, max: 100000, a: 'p99', b: 'goodput', c: 'errors', d: 'dropped', rate: '/s' };

export const architecture: Paradigm = {
  id: 'architecture', label: 'architecture', title: 'Architecture', axis: 'structure', family: 'indigo',
  ask: 'What exists, where does it live, and what is connected to what?',
  blurb: 'services, data, queues, edges, network boundaries',
  region: 'boundary', layout: 'layered',
  CATS: ARCH_CATS, TYPES: ARCH_TYPES,
  EDGES: {
    http: { label: 'http', rel: 'flow', desc: 'synchronous request' }, grpc: { label: 'grpc', rel: 'flow', desc: 'internal rpc' },
    query: { label: 'sql', rel: 'flow', desc: 'database' }, queue: { label: 'queue', rel: 'async', desc: 'buffered async' },
    event: { label: 'event', rel: 'async', desc: 'pub/sub fanout' }, cdc: { label: 'cdc', rel: 'dependency', desc: 'change data capture' },
    repl: { label: 'repl', rel: 'dependency', desc: 'replication' },
  },
  defaultEdge: 'http',
  INSPECT: {
    node: [NAME, F('inst', 'instances', 'number', { min: 1, half: true }), F('cap', 'concurrency', 'number', { min: 1, half: true }), F('ms', 'service time (ms)', 'number', { min: 0 })],
    edge: [F('kind', 'protocol', 'select'), F('label', 'label', 'text', { ph: 'POST /checkout · orders.created' }), F('w', 'traffic weight (× upstream rate)', 'number', { min: 0.01, max: 5, step: 0.05 })],
  },
  HUD: HEALTH_SIM, sim: 'queueing', unitNoun: 'components', edgeNoun: 'connections',
  METRICS: { arr: 'arrivals', lat: 'latency', p99: 'p99', util: 'util', q: 'queued', err: 'errors' },
  a11y: (a, e, b, T) => a + ' connects to ' + b + ' over ' + (T.EDGES[e.kind]?.label ?? '') + (e.label ? ' (' + e.label + ')' : '') + '.',
};
