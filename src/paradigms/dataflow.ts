import { F, NAME } from './fields';
import { I } from './icons';
import type { Paradigm } from './types';

export const dataflow: Paradigm = {
  id: 'dataflow', label: 'data flow', title: 'Data Flow', axis: 'information', family: 'emerald',
  ask: 'Where does data originate, how is it transformed, where is it stored, and who consumes it?',
  blurb: 'sources, streams, transforms, stores, consumers, governance',
  region: 'stage', layout: 'stages',
  // two conceptual families, orthogonal to category and colour: `form` is 'data' (at rest or in
  // transit: sources, streams, stores, vault, dead letter) or 'process' (transformation or
  // execution: producers, connectors, transforms, consumers, gates). Rendered as data-form.
  FORMS: { data: { label: 'data', glyph: '≡', hint: 'at rest / in transit' }, process: { label: 'process', glyph: 'ƒ', hint: 'transformation / execution' } },
  CATS: { src: { label: 'Sources' }, str: { label: 'Streams' }, tr: { label: 'Transforms' }, sto: { label: 'Stores' }, con: { label: 'Consumers' }, gov: { label: 'Governance' } },
  TYPES: {
    source:    { label: 'Source',        cat: 'src', family: 'orange',  form: 'data', icon: I.person, role: 'source', cap: 1e9, ms: 0, inst: 1 },
    producer:  { label: 'Producer API',  cat: 'src', family: 'orange',  form: 'process', icon: I.arrow,  role: 'work', cap: 300, ms: 3, inst: 2 },
    stream:    { label: 'Event stream',  cat: 'str', family: 'amber',   form: 'data', icon: I.wave,   role: 'buffer', cap: 1e9, ms: 0, inst: 3, parts: 12, retention: 7 },
    topic:     { label: 'Topic',         cat: 'str', family: 'amber',   form: 'data', icon: I.lines,  role: 'buffer', cap: 1e9, ms: 0, inst: 1, parts: 6, retention: 7 },
    cdc:       { label: 'CDC connector', cat: 'str', family: 'amber',   form: 'process', icon: I.link,   role: 'work', cap: 200, ms: 2, inst: 1 },
    transform: { label: 'Transform',     cat: 'tr',  family: 'cyan',    form: 'process', icon: I.funnel, role: 'work', cap: 64, ms: 12, inst: 2 },
    batch:     { label: 'Batch job',     cat: 'tr',  family: 'cyan',    form: 'process', icon: I.clock,  role: 'work', cap: 8, ms: 400, inst: 1 },
    enrich:    { label: 'Enrichment',    cat: 'tr',  family: 'cyan',    form: 'process', icon: I.stack,  role: 'work', cap: 32, ms: 20, inst: 2 },
    warehouse: { label: 'Warehouse',     cat: 'sto', family: 'emerald', form: 'data', icon: I.table,  role: 'work', cap: 400, ms: 6, inst: 1, retention: 730 },
    lake:      { label: 'Data lake',     cat: 'sto', family: 'emerald', form: 'data', icon: I.db,     role: 'work', cap: 800, ms: 15, inst: 1, retention: 0 },
    database:  { label: 'Database',      cat: 'sto', family: 'emerald', form: 'data', icon: I.db,     role: 'work', cap: 60, ms: 5, inst: 1, retention: 0 },
    feature:   { label: 'Feature store', cat: 'sto', family: 'emerald', form: 'data', icon: I.cube,   role: 'work', cap: 200, ms: 4, inst: 2, retention: 90 },
    dashboard: { label: 'Dashboard',     cat: 'con', family: 'indigo',  form: 'process', icon: I.chart,  role: 'work', cap: 40, ms: 30, inst: 1 },
    model:     { label: 'ML model',      cat: 'con', family: 'indigo',  form: 'process', icon: I.diamond, role: 'work', cap: 16, ms: 80, inst: 2 },
    consumer:  { label: 'Consumer',      cat: 'con', family: 'indigo',  form: 'process', icon: I.box,    role: 'work', cap: 32, ms: 15, inst: 2 },
    gate:      { label: 'Consent gate',  cat: 'gov', family: 'purple',  form: 'process', icon: I.gate,   role: 'work', cap: 300, ms: 2, inst: 2, gov: true },
    vault:     { label: 'PII vault',     cat: 'gov', family: 'purple',  form: 'data', icon: I.shield, role: 'work', cap: 100, ms: 8, inst: 1, gov: true, retention: 365 },
    dlq:       { label: 'Dead letter',   cat: 'gov', family: 'stone',   form: 'data', icon: I.x,      role: 'buffer', cap: 1e9, ms: 0, inst: 1 },
  },
  EDGES: {
    event: { label: 'event', rel: 'async', desc: 'emitted events' }, stream: { label: 'stream', rel: 'async', desc: 'continuous stream' },
    batch: { label: 'batch', rel: 'async', desc: 'scheduled batch' }, transform: { label: 'transform', rel: 'flow', desc: 'in-line transform' },
    replication: { label: 'repl', rel: 'dependency', desc: 'replication' }, lineage: { label: 'lineage', rel: 'proposed', desc: 'derived-from' },
    governed: { label: 'governed', rel: 'dependency', desc: 'passes a governance boundary', gov: true }, replay: { label: 'replay', rel: 'dependency', desc: 'controlled replay', alt: true },
    deadletter: { label: 'dead-letter', rel: 'dependency', desc: 'poison messages', alt: true }, query: { label: 'query', rel: 'flow', desc: 'read query' },
  },
  defaultEdge: 'stream',
  INSPECT: {
    node: [NAME, F('schema', 'schema', 'text', { ph: 'orders.v1 · avro' }), F('inst', 'instances', 'number', { min: 1, half: true }), F('cap', 'concurrency', 'number', { min: 1, half: true }), F('ms', 'per-event ms', 'number', { min: 0, half: true }), F('retention', 'retention (days)', 'number', { min: 0, half: true }), F('pii', 'contains PII', 'check'), F('owner', 'owner', 'text', { ph: 'data platform' })],
    edge: [F('kind', 'movement', 'select'), F('label', 'label', 'text', { ph: 'OrderPlaced · normalized facts' }), F('w', 'fan share (× upstream)', 'number', { min: 0.01, max: 5, step: 0.05 })],
  },
  HUD: { load: 'events', unit: '/s', min: 10, max: 200000, a: 'end-to-end p99', b: 'delivered', c: 'errors', d: 'lagging', rate: '/s' },
  sim: 'queueing', unitNoun: 'datasets', edgeNoun: 'movements',
  METRICS: { arr: 'events in', lat: 'latency', p99: 'p99', util: 'util', q: 'lag', err: 'errors' },
  a11y: (a, e, b, T) => a + ' sends ' + (e.label || (T.EDGES[e.kind]?.label ?? '')) + ' to ' + b + (T.EDGES[e.kind]?.gov ? ' across a governance boundary' : '') + '.',
};
