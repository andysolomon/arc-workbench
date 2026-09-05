// Example documents, one polished system per paradigm (plus the pre-existing architecture presets).
// Flat workbench shape: nodes {id,type,name,x,y,...ext}, edges {id,kind,from,to,...ext}, regions.
// Regions are authored by visual family — the legacy alias never enters a document (PORT-NOTES D4).
import type { GraphEdge, GraphNode, GraphRegion, ParadigmId, RegionVariant, VisualFamily } from '../model/document';
import { PRESETS as ARCH_PRESETS } from './presets';
import { nodeDefaults } from './registry';

export interface Example { id: string; name: string; rps: number; nodes: GraphNode[]; edges: GraphEdge[]; regions: GraphRegion[] }

const mk = (pid: ParadigmId) => (id: string, type: string, name: string, x: number, y: number, o?: Partial<GraphNode>): GraphNode =>
  Object.assign({ id, type, name, x, y }, nodeDefaults(pid, type), o ?? {});
const E = (from: string, to: string, kind: string, label?: string, o?: Partial<GraphEdge>): GraphEdge =>
  Object.assign({ id: from + '>' + to + (o && o.seq ? '#' + o.seq : ''), from, to, kind, label: label ?? '', w: 1 }, o ?? {});
const R = (id: string, variant: RegionVariant, label: string, family: VisualFamily, x: number, y: number, w: number, h: number, o?: Partial<GraphRegion>): GraphRegion =>
  Object.assign({ id, variant, label, family, x, y, w, h }, o ?? {});

// ---------- architecture ----------
const A = mk('architecture');
const prod: Example = {
  id: 'prod', name: 'Production Deployment', rps: 4200,
  nodes: [
    A('cust', 'client', 'Customers', 48, 304), A('edge', 'cdn', 'Global Edge', 304, 304), A('gw', 'gateway', 'API Gateway', 560, 304),
    A('apia', 'service', 'API Pods · AZ-a', 816, 160, { inst: 3, ms: 22 }), A('apib', 'service', 'API Pods · AZ-b', 816, 448, { inst: 3, ms: 22 }),
    A('redis', 'cache', 'Redis · multi-AZ', 1072, 160, { inst: 2 }), A('pg', 'sql', 'PostgreSQL', 1072, 448, { cap: 60 }),
    A('bus', 'broker', 'Event Bus', 1328, 304), A('wrk', 'worker', 'Workers', 1584, 304, { inst: 4, ms: 140 }),
    A('obs', 'service', 'Observability', 1584, 64, { inst: 2, ms: 4 }), A('audit', 'storage', 'Audit Archive', 1584, 544),
    A('dr', 'replica', 'DR Replica', 1072, 720),
  ],
  edges: [
    E('cust', 'edge', 'http', 'HTTPS'), E('edge', 'gw', 'http', 'origin', { w: 0.4 }), E('gw', 'apia', 'grpc', 'route', { w: 0.5 }), E('gw', 'apib', 'grpc', 'route', { w: 0.5 }),
    E('apia', 'redis', 'query', 'cache'), E('apib', 'redis', 'query', 'cache'), E('apia', 'pg', 'query', 'SQL', { w: 0.3 }), E('apib', 'pg', 'query', 'SQL', { w: 0.3 }),
    E('apia', 'bus', 'event', 'publish', { w: 0.4 }), E('apib', 'bus', 'event', 'publish', { w: 0.4 }), E('bus', 'wrk', 'queue', 'orders.v1'),
    E('wrk', 'obs', 'http', 'otlp', { w: 0.2 }), E('wrk', 'audit', 'http', 'evidence', { w: 0.5 }), E('pg', 'dr', 'repl', 'cross-region WAL'),
  ],
  regions: [
    R('r1', 'boundary', 'region · us-east-1 · production', 'stone', 528, 24, 1280, 640),
    R('r2', 'boundary', 'vpc · private application network', 'indigo', 784, 112, 528, 472),
    R('r3', 'boundary', 'region · us-west-2 · disaster recovery', 'stone', 1040, 680, 272, 150, { dashed: 1 }),
  ],
};
export const ARCHITECTURE: Example[] = [prod, ...ARCH_PRESETS.map(p => ({ ...p, regions: [] as GraphRegion[] }))];

// ---------- workflow ----------
const W = mk('workflow');
const LANE_H = 176, LX = 16, LW = 2064;
export const WORKFLOW: Example[] = [{
  id: 'release', name: 'Release Delivery Workflow', rps: 40,
  nodes: [
    W('commit', 'action', 'Commit', 48, 104, { owner: 'developer', dur: 2, output: 'signed change' }),
    W('pr', 'task', 'Pull Request', 304, 104, { owner: 'reviewers', dur: 90, output: 'reviewed diff' }),
    W('build', 'action', 'Build', 560, 280, { owner: 'ci', dur: 9, output: 'immutable image' }),
    W('qg', 'gate', 'Quality Gates', 816, 280, { owner: 'ci', dur: 14, pass: 0.82, input: 'test + scan' }),
    W('approve', 'approval', 'Approve', 1072, 456, { owner: 'release owner', dur: 180, pass: 0.9 }),
    W('canary', 'gate', 'Canary', 1328, 456, { owner: 'sre', dur: 30, pass: 0.92, input: 'slo window' }),
    W('notes', 'evidence', 'Release notes', 1584, 456, { owner: 'release owner', dur: 1 }),
    W('rollback', 'recovery', 'Rollback', 1328, 632, { owner: 'sre', dur: 6 }),
    W('rolled', 'failed', 'Rolled back', 1072, 632, { owner: 'sre' }),
    W('release', 'action', 'Release', 1584, 632, { owner: 'sre', dur: 12 }),
    W('done', 'end', 'Released', 1840, 632, {}),
  ],
  edges: [
    E('commit', 'pr', 'next', 'pushed', { action: 'open_pr()' }), E('pr', 'build', 'next', 'merged', { guard: 'approvals >= 2', action: 'trigger_build()' }), E('build', 'qg', 'next', 'built', { action: 'run_tests()' }),
    E('qg', 'approve', 'next', 'tests_passed', { guard: 'coverage >= 80' }), E('qg', 'pr', 'fail', 'tests_failed', { action: 'notify(author)' }),
    E('approve', 'canary', 'approve', 'approved', { action: 'deploy(canary)' }), E('approve', 'pr', 'deny', 'changes_requested'),
    E('canary', 'release', 'next', 'healthy', { guard: 'slo.ok for 30m', action: 'promote()' }), E('canary', 'rollback', 'fail', 'slo_breach', { action: 'page(oncall)' }),
    E('rollback', 'rolled', 'next', 'reverted'), E('release', 'done', 'next', 'released', { action: 'announce()' }), E('release', 'notes', 'observe', 'evidence'),
  ],
  regions: [
    R('l1', 'lane', '01 / developer', 'indigo', LX, 48, LW, LANE_H, { owner: 'developer', ownerKind: 'team' }),
    R('l2', 'lane', '02 / continuous integration', 'cyan', LX, 48 + LANE_H, LW, LANE_H, { owner: 'ci', ownerKind: 'system' }),
    R('l3', 'lane', '03 / release governance', 'amber', LX, 48 + LANE_H * 2, LW, LANE_H, { owner: 'release owner', ownerKind: 'boundary' }),
    R('l4', 'lane', '04 / production', 'purple', LX, 48 + LANE_H * 3, LW, LANE_H, { owner: 'sre', ownerKind: 'team' }),
  ],
}];

// ---------- sequence ----------
const S = mk('sequence');
const PX = (i: number) => 48 + i * 240;
export const SEQUENCE: Example[] = [{
  id: 'cachemiss', name: 'Cache-miss Request', rps: 900,
  nodes: [
    S('user', 'client', 'User', PX(0), 48, { role: 'browser session' }), S('web', 'service', 'Web App', PX(1), 48, { role: 'react ui', conc: 200 }),
    S('api', 'api', 'API', PX(2), 48, { role: 'request handler', conc: 96 }), S('auth', 'auth', 'Auth', PX(3), 48, { role: 'jwt verify', conc: 300 }),
    S('redis', 'cache', 'Redis', PX(4), 48, { role: 'cache', conc: 2000 }), S('pg', 'db', 'Postgres', PX(5), 48, { role: 'source of truth', conc: 40 }),
    S('trace', 'external', 'Trace', PX(6), 48, { role: 'async event' }),
  ],
  edges: [
    E('user', 'web', 'request', 'open page', { seq: 1, lat: 5 }), E('web', 'api', 'request', 'GET /dashboard', { seq: 2, lat: 8 }),
    E('api', 'auth', 'request', 'verify JWT', { seq: 3, lat: 6 }), E('auth', 'api', 'response', 'claims ok', { seq: 4, lat: 1 }),
    E('api', 'redis', 'request', 'read cache', { seq: 5, lat: 2 }), E('redis', 'api', 'response', 'miss', { seq: 6, lat: 1 }),
    E('api', 'pg', 'request', 'query profile + metrics', { seq: 7, lat: 38 }), E('pg', 'api', 'response', 'rows', { seq: 8, lat: 2 }),
    E('api', 'redis', 'async', 'write-through', { seq: 9, lat: 1 }), E('api', 'web', 'response', '200 · dashboard', { seq: 10, lat: 3 }),
    E('web', 'user', 'response', 'render', { seq: 11, lat: 12 }), E('api', 'trace', 'event', 'span', { seq: 12, lat: 0 }),
  ],
  regions: [
    R('p1', 'phase', 'request', 'indigo', 0, 0, 0, 0, { from: 1, to: 4 }),
    R('p2', 'phase', 'fallback', 'emerald', 0, 0, 0, 0, { from: 5, to: 9 }),
    R('p3', 'phase', 'response', 'stone', 0, 0, 0, 0, { from: 10, to: 12 }),
  ],
}];

// ---------- data flow ----------
const D = mk('dataflow');
const SX = (i: number) => 16 + i * 288, NX = (i: number) => SX(i) + 36;
export const DATAFLOW: Example[] = [{
  id: 'analytics', name: 'Product Analytics', rps: 3500,
  nodes: [
    D('web', 'source', 'Web App', NX(0), 160, { schema: 'clickstream.v3', pii: 1, owner: 'web' }), D('mobile', 'source', 'Mobile', NX(0), 448, { schema: 'app_events.v2', pii: 1, owner: 'mobile' }),
    D('edge', 'producer', 'Edge API', NX(1), 304, { schema: 'raw events', inst: 3, owner: 'data platform' }),
    D('gate', 'gate', 'Consent Gate', NX(2), 96, { schema: 'identity + consent', pii: 1, owner: 'privacy' }),
    D('stream', 'stream', 'Event Stream', NX(2), 448, { schema: 'events.v1 · avro', parts: 24, retention: 7, owner: 'data platform' }),
    D('dlq', 'dlq', 'events.dlq', NX(2), 656, { retention: 14, owner: 'data platform' }),
    D('vault', 'vault', 'PII Vault', NX(3), 96, { schema: 'identity map', pii: 1, retention: 365, owner: 'privacy' }),
    D('wh', 'warehouse', 'Warehouse', NX(3), 448, { schema: 'analytical tables', retention: 730, owner: 'analytics eng' }),
    D('feat', 'feature', 'Feature Store', NX(3), 656, { schema: 'features.v4', retention: 90, owner: 'ml platform' }),
    D('dash', 'dashboard', 'Dashboards', NX(4), 304, { schema: 'product metrics', owner: 'product' }),
    D('ml', 'model', 'ML Model', NX(4), 656, { schema: 'feature vectors', owner: 'ml platform' }),
  ],
  edges: [
    E('web', 'edge', 'event', 'clickstream', { w: 0.6 }), E('mobile', 'edge', 'event', 'app events', { w: 0.4 }),
    E('edge', 'gate', 'governed', 'identity + consent', { w: 0.3 }), E('gate', 'vault', 'governed', 'identity map'),
    E('edge', 'stream', 'stream', 'accepted events'), E('stream', 'wh', 'stream', 'normalized facts'), E('stream', 'dlq', 'deadletter', 'poison', { w: 0.01 }),
    E('wh', 'dash', 'query', 'metrics SQL', { w: 0.05 }), E('wh', 'feat', 'batch', 'daily aggregates', { w: 0.5 }), E('feat', 'ml', 'batch', 'feature vectors'),
    E('vault', 'dash', 'governed', 'restricted join', { w: 0.1 }),
  ],
  regions: [
    R('s1', 'stage', '01 / sources', 'orange', SX(0), 16, 272, 800), R('s2', 'stage', '02 / ingest', 'orange', SX(1), 16, 272, 800),
    R('s3', 'stage', '03 / process', 'cyan', SX(2), 16, 272, 800), R('s4', 'stage', '04 / store', 'emerald', SX(3), 16, 272, 800),
    R('s5', 'stage', '05 / consume', 'indigo', SX(4), 16, 272, 800),
    R('z1', 'zone', 'pii · governed', 'danger', SX(2) + 16, 56, 528, 176, { dashed: 1 }),
  ],
}];

// ---------- state machine ----------
const T = mk('state');
const ROW = 184, RX = 16, RW = 1312;
export const STATE: Example[] = [{
  id: 'agentrun', name: 'Agent Run Lifecycle', rps: 120,
  nodes: [
    T('queued', 'initial', 'Queued', 48, 112, { entry: 'accept request' }), T('planning', 'active', 'Planning', 304, 112, { dwell: 6, entry: 'build task graph' }),
    T('executing', 'active', 'Executing', 560, 112, { dwell: 18, entry: 'tool calls', cap: 40 }), T('reviewing', 'review', 'Reviewing', 816, 112, { dwell: 12, entry: 'quality gate' }),
    T('completed', 'completed', 'Completed', 1072, 112, { exit: 'final response' }),
    T('approval', 'approval', 'Needs Approval', 560, 296, { dwell: 240, entry: 'human gate' }), T('blocked', 'blocked', 'Blocked', 816, 296, { dwell: 90, entry: 'missing input' }),
    T('retrying', 'retrying', 'Retrying', 304, 296, { dwell: 4, entry: 'recoverable error' }),
    T('failed', 'failed', 'Failed', 304, 480), T('cancelled', 'cancelled', 'Cancelled', 560, 480), T('expired', 'expired', 'Expired', 816, 480),
  ],
  edges: [
    E('queued', 'planning', 'event', 'request_accepted', { p: 1, action: 'build_plan()' }), E('planning', 'executing', 'event', 'plan_ready', { p: 0.95, guard: 'steps > 0', action: 'dispatch()' }), E('planning', 'cancelled', 'cancel', 'user_stopped', { p: 0.05, action: 'release()' }),
    E('executing', 'reviewing', 'event', 'tools_done', { p: 0.55, guard: 'errors == 0', action: 'draft_response()' }), E('executing', 'approval', 'event', 'needs_human', { p: 0.2, guard: 'risk >= high' }),
    E('executing', 'retrying', 'failure', 'tool_error', { p: 0.15, guard: 'attempt < 3', action: 'backoff()' }), E('executing', 'blocked', 'event', 'input_missing', { p: 0.1, action: 'ask_user()' }),
    E('approval', 'executing', 'approve', 'approved', { p: 0.8, action: 'resume()' }), E('approval', 'cancelled', 'cancel', 'denied', { p: 0.1 }), E('approval', 'expired', 'timeout', 'timeout', { p: 0.1, timeout: 2880, guard: 'waited > 48h' }),
    E('blocked', 'executing', 'event', 'input_received', { p: 0.8, action: 'resume()' }), E('blocked', 'expired', 'timeout', 'timeout', { p: 0.2, timeout: 1440, guard: 'waited > 24h' }),
    E('retrying', 'planning', 'retry', 'retry', { p: 0.7, action: 'replan()' }), E('retrying', 'failed', 'failure', 'retries_exhausted', { p: 0.3, guard: 'attempt == 3', action: 'notify()' }),
    E('reviewing', 'completed', 'event', 'accepted', { p: 0.85, action: 'respond()' }), E('reviewing', 'planning', 'event', 'revise', { p: 0.15, guard: 'score < 0.7' }),
  ],
  regions: [
    R('f1', 'phase', '01 / lifecycle phases', 'indigo', RX, 48, RW, ROW), R('f2', 'phase', '02 / interruptions + recovery', 'amber', RX, 48 + ROW, RW, ROW),
    R('f3', 'phase', '03 / terminal exits', 'danger', RX, 48 + ROW * 2, RW, ROW),
  ],
}];

export const EXAMPLES: Record<ParadigmId, Example[]> = { architecture: ARCHITECTURE, workflow: WORKFLOW, sequence: SEQUENCE, dataflow: DATAFLOW, state: STATE };
export const BLANK = (pid: ParadigmId): Example => ({ id: 'blank', name: 'Untitled ' + pid, rps: pid === 'architecture' ? 1000 : pid === 'dataflow' ? 1000 : pid === 'sequence' ? 200 : 60, nodes: [], edges: [], regions: [] });
