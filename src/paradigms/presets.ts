// Architecture component registry + the pre-existing presets. Ported from presets.js with
// logic unchanged; `family` per type is the paradigm-declared visual triad (compute → indigo,
// network → cyan, data → emerald, messaging → amber, reliability → purple). The unused
// `CATS.color` hex literals were dropped (PORT-NOTES D/§4.3).
import type { GraphEdge, GraphNode, VisualFamily } from '../model/document';
import type { Category, NodeTypeDef } from './types';

export type ArchCat = 'compute' | 'net' | 'data' | 'msg' | 'rel';
export const CATS: Record<ArchCat, Category> = {
  compute: { label: 'Compute' },
  net: { label: 'Networking' },
  data: { label: 'Data' },
  msg: { label: 'Messaging' },
  rel: { label: 'Reliability' },
};
export const ARCH_CAT_FAMILY: Record<ArchCat, VisualFamily> = { compute: 'indigo', net: 'cyan', data: 'emerald', msg: 'amber', rel: 'purple' };

type Raw = { label: string; cat: ArchCat; icon: string; cap: number; ms: number; inst: number };
const RAW: Record<string, Raw> = {
  client:   { label: 'Client',            cat: 'net',  icon: 'M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12', cap: 1e9, ms: 0,   inst: 1 },
  cdn:      { label: 'CDN',               cat: 'net',  icon: 'M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12M2 8h12M8 2c-2.4 2-2.4 10 0 12c2.4-2 2.4-10 0-12', cap: 800, ms: 4, inst: 1 },
  gateway:  { label: 'API Gateway',       cat: 'net',  icon: 'M4 3l5 5-5 5M9 3l5 5-5 5',            cap: 300, ms: 3,  inst: 2 },
  lb:       { label: 'Load Balancer',     cat: 'net',  icon: 'M8 3v3M8 6L4 13M8 6v7M8 6l4 7',       cap: 600, ms: 1,  inst: 1 },
  ws:       { label: 'WebSocket Gateway', cat: 'net',  icon: 'M2 6c2 3 4 3 6 0s4-3 6 0M2 11c2 3 4 3 6 0s4-3 6 0', cap: 400, ms: 2, inst: 2 },
  service:  { label: 'Service',           cat: 'compute', icon: 'M4 4h8v8H4Z',                      cap: 64,  ms: 24, inst: 2 },
  worker:   { label: 'Worker',            cat: 'compute', icon: 'M8 3l5 5-5 5-5-5Z',                cap: 16,  ms: 120, inst: 2 },
  fn:       { label: 'Serverless Fn',     cat: 'compute', icon: 'M8 3l5 10H3Z',                     cap: 200, ms: 35, inst: 1 },
  cron:     { label: 'Cron Job',          cat: 'compute', icon: 'M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12M8 5v3l2 2', cap: 4, ms: 500, inst: 1 },
  sql:      { label: 'SQL Database',      cat: 'data', icon: 'M4 4c0-1.1 1.8-2 4-2s4 .9 4 2v8c0 1.1-1.8 2-4 2s-4-.9-4-2V4M4 4c0 1.1 1.8 2 4 2s4-.9 4-2', cap: 40, ms: 8, inst: 1 },
  nosql:    { label: 'NoSQL Database',    cat: 'data', icon: 'M8 2l5 3v6l-5 3-5-3V5Z',              cap: 120, ms: 5,  inst: 3 },
  cache:    { label: 'Cache',             cat: 'data', icon: 'M9 2L4 9h4l-1 5 5-7H8Z',              cap: 400, ms: 1,  inst: 1 },
  search:   { label: 'Search Index',      cat: 'data', icon: 'M7 3a4 4 0 1 1 0 8a4 4 0 0 1 0-8M10 10l4 4', cap: 60, ms: 12, inst: 2 },
  storage:  { label: 'Object Storage',    cat: 'data', icon: 'M3 4h10v3H3ZM3 9h10v3H3Z',            cap: 500, ms: 18, inst: 1 },
  replica:  { label: 'Read Replica',      cat: 'data', icon: 'M3 3h7v7H3ZM6 6h7v7H6Z',              cap: 40,  ms: 8,  inst: 1 },
  queue:    { label: 'Queue',             cat: 'msg',  icon: 'M3 5h10M3 8h10M3 11h7',               cap: 1e9, ms: 0,  inst: 1 },
  broker:   { label: 'Kafka / Broker',    cat: 'msg',  icon: 'M3 4h10M3 8h6M11 8h2M3 12h10',        cap: 1e9, ms: 0,  inst: 3 },
  pubsub:   { label: 'Pub/Sub',           cat: 'msg',  icon: 'M8 3a2 2 0 1 1 0 4a2 2 0 1 1 0-4M3 13l3-4M13 13l-3-4', cap: 1e9, ms: 0, inst: 1 },
  dlq:      { label: 'Dead Letter Queue', cat: 'msg',  icon: 'M3 5h10M3 8h10M3 11h4M11 10l3 3M14 10l-3 3', cap: 1e9, ms: 0, inst: 1 },
  limiter:  { label: 'Rate Limiter',      cat: 'rel',  icon: 'M3 12a5 5 0 0 1 10 0M8 12l3-4',       cap: 1200, ms: 1, inst: 1 },
  breaker:  { label: 'Circuit Breaker',   cat: 'rel',  icon: 'M2 8h4M10 8h4M6 8l3-5',               cap: 1200, ms: 0, inst: 1 },
  scaler:   { label: 'Autoscaler',        cat: 'rel',  icon: 'M8 13V5M5 8l3-3 3 3M3 13h10',         cap: 1e9, ms: 0, inst: 1 },
};
export const TYPES: Record<string, NodeTypeDef> = Object.fromEntries(
  Object.entries(RAW).map(([k, t]) => [k, { label: t.label, cat: t.cat, family: ARCH_CAT_FAMILY[t.cat], icon: t.icon, cap: t.cap, ms: t.ms, inst: t.inst } satisfies NodeTypeDef]),
);

const typeOf = (type: string): Raw => {
  const t = RAW[type];
  if (!t) throw new Error('unknown architecture type ' + type);
  return t;
};
const N = (id: string, type: string, name: string, x: number, y: number, o?: Partial<GraphNode>): GraphNode => {
  const t = typeOf(type);
  return Object.assign({ id, type, name, x, y, inst: t.inst, cap: t.cap, ms: t.ms }, o ?? {});
};
const E = (from: string, to: string, kind: string, label?: string, w?: number): GraphEdge => ({ id: from + '>' + to, from, to, kind, label: label ?? '', w: w == null ? 1 : w });

export interface Preset { id: string; name: string; rps: number; nodes: GraphNode[]; edges: GraphEdge[] }

export const PRESETS: Preset[] = [
  { id: 'video', name: 'Video Platform', rps: 2400,
    nodes: [
      N('cl', 'client', 'Viewers', 40, 240),
      N('cdn', 'cdn', 'Edge CDN', 260, 150),
      N('gw', 'gateway', 'API Gateway', 260, 360),
      N('play', 'service', 'Playback API', 500, 150, { inst: 4, ms: 18 }),
      N('up', 'service', 'Upload Service', 500, 360, { inst: 2, ms: 45 }),
      N('redis', 'cache', 'Redis · manifests', 740, 60),
      N('meta', 'sql', 'Metadata DB', 740, 220, { cap: 60 }),
      N('s3', 'storage', 'Object Storage', 740, 470),
      N('tq', 'queue', 'Transcode Queue', 500, 560),
      N('tw', 'worker', 'Transcode Workers', 740, 610, { inst: 6, ms: 900, cap: 4 }),
      N('kafka', 'broker', 'video.events', 990, 220),
      N('an', 'worker', 'Analytics Pipeline', 1230, 120, { ms: 60, inst: 2 }),
      N('si', 'search', 'Search Indexer', 1230, 260),
      N('notif', 'service', 'Notification Svc', 1230, 400, { ms: 15 }),
    ],
    edges: [
      E('cl', 'cdn', 'http', 'GET /stream', 0.85),
      E('cl', 'gw', 'http', 'POST /upload', 0.15),
      E('cdn', 'play', 'http', 'cache miss', 0.25),
      E('gw', 'up', 'grpc', 'UploadVideo'),
      E('play', 'redis', 'query', 'GET manifest'),
      E('play', 'meta', 'query', 'SELECT video', 0.18),
      E('up', 's3', 'http', 'PUT object'),
      E('up', 'meta', 'query', 'INSERT video'),
      E('up', 'tq', 'queue', 'transcode.job'),
      E('tq', 'tw', 'queue', 'consume'),
      E('tw', 's3', 'http', 'PUT renditions', 3),
      E('meta', 'kafka', 'cdc', 'video.changed'),
      E('kafka', 'an', 'event', 'video.events'),
      E('kafka', 'si', 'event', 'index update'),
      E('kafka', 'notif', 'event', 'notify'),
    ] },
  { id: 'single', name: 'Single Server', rps: 300,
    nodes: [N('cl', 'client', 'Client', 80, 220), N('api', 'service', 'API Server', 380, 220, { inst: 1 }), N('db', 'sql', 'Postgres', 680, 220)],
    edges: [E('cl', 'api', 'http', 'GET /api'), E('api', 'db', 'query', 'SELECT')] },
  { id: 'lb', name: 'Load Balanced', rps: 900,
    nodes: [N('cl', 'client', 'Client', 60, 260), N('lb', 'lb', 'Load Balancer', 320, 260),
      N('s1', 'service', 'API · a', 580, 100, { inst: 1 }), N('s2', 'service', 'API · b', 580, 260, { inst: 1 }), N('s3', 'service', 'API · c', 580, 420, { inst: 1 }),
      N('db', 'sql', 'Postgres', 860, 260)],
    edges: [E('cl', 'lb', 'http', 'HTTPS'), E('lb', 's1', 'http', '', 0.34), E('lb', 's2', 'http', '', 0.33), E('lb', 's3', 'http', '', 0.33),
      E('s1', 'db', 'query', ''), E('s2', 'db', 'query', 'SELECT'), E('s3', 'db', 'query', '')] },
  { id: 'cache', name: 'Cache Aside', rps: 1500,
    nodes: [N('cl', 'client', 'Client', 70, 240), N('api', 'service', 'API Server', 350, 240, { inst: 2 }),
      N('c', 'cache', 'Redis', 650, 120), N('db', 'sql', 'Postgres', 650, 360)],
    edges: [E('cl', 'api', 'http', 'GET /item'), E('api', 'c', 'query', 'GET key'), E('api', 'db', 'query', '20% miss', 0.2)] },
  { id: 'workers', name: 'Async Workers', rps: 600,
    nodes: [N('cl', 'client', 'Client', 60, 220), N('api', 'service', 'Ingest API', 320, 220), N('q', 'queue', 'Job Queue', 600, 220),
      N('w', 'worker', 'Workers', 860, 220, { inst: 3 }), N('db', 'sql', 'Postgres', 1120, 220)],
    edges: [E('cl', 'api', 'http', 'POST /jobs'), E('api', 'q', 'queue', 'job.created'), E('q', 'w', 'queue', 'consume'), E('w', 'db', 'query', 'INSERT')] },
  { id: 'replicas', name: 'Read Replicas', rps: 1800,
    nodes: [N('cl', 'client', 'Client', 60, 260), N('api', 'service', 'API Server', 330, 260, { inst: 3 }),
      N('pri', 'sql', 'Primary', 640, 120), N('r1', 'replica', 'Replica · 1', 640, 300), N('r2', 'replica', 'Replica · 2', 640, 450)],
    edges: [E('cl', 'api', 'http', 'GET / POST'), E('api', 'pri', 'query', 'writes 20%', 0.2),
      E('api', 'r1', 'query', 'reads', 0.4), E('api', 'r2', 'query', 'reads', 0.4),
      E('pri', 'r1', 'repl', 'WAL'), E('pri', 'r2', 'repl', 'WAL')] },
  { id: 'ratelimit', name: 'Rate Limited API', rps: 2000,
    nodes: [N('cl', 'client', 'Client', 60, 220), N('rl', 'limiter', 'Rate Limiter', 320, 220, { cap: 900 }),
      N('api', 'service', 'API Server', 600, 220, { inst: 2 }), N('db', 'sql', 'Postgres', 880, 220)],
    edges: [E('cl', 'rl', 'http', '900 rps limit'), E('rl', 'api', 'http', 'allowed'), E('api', 'db', 'query', 'SELECT')] },
];
