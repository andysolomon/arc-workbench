// The workspace: one named document per paradigm plus a session record, persisted through a
// KeyValueStore. Records are versioned (`schema`) and wrap a GraphDocument, which is itself
// versioned and migrated on read — a v1 document stored by an older build opens as v3.
//
// Save protocol (interrupted-save safe, one key at a time):
//   1. pending ← new record        2. prev ← current (last good)        3. current ← new
//   4. remove pending
// A crash between steps leaves either a complete `pending` (newer than current → recovered) or an
// intact `prev`. A record that fails to parse or validate is never loaded silently: it is kept
// under `.broken` for export and reported as invalid.
import { PARADIGM_IDS, isParadigmId, migrate, type GraphDocument, type MigrationHooks, type ParadigmId } from '../model';
import type { KeyValueStore } from './store';

export const SCHEMA = 1;
export const newDocumentId = (): string => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export interface StoredDocument { schema: typeof SCHEMA; id: string; title: string; paradigm: ParadigmId; presetId: string; updatedAt: number; doc: GraphDocument }
export interface StoredSession { schema: typeof SCHEMA; active: ParadigmId; updatedAt: number }
export type Recovered = 'interrupted' | 'previous';
export type LoadResult =
  | { kind: 'none' }
  | { kind: 'ok'; record: StoredDocument; recovered: Recovered | null; /** the older save an interrupted-save recovery displaced, if one exists */ alternative?: StoredDocument; /** why the newest record was skipped (recovered = 'previous') */ reason?: string }
  | { kind: 'invalid'; reason: string; raw: string };

const PREFIX = 'wb.doc.';
export const docKey = (pid: ParadigmId): string => PREFIX + pid;
export const SESSION_KEY = 'wb.session';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export class Workspace {
  constructor(readonly store: KeyValueStore, readonly hooks: MigrationHooks) {}

  /** parse + validate + migrate one raw record; throws with a reason on garbage */
  parseRecord(raw: string): StoredDocument {
    const v: unknown = JSON.parse(raw);
    if (!isObj(v) || v['schema'] !== SCHEMA) throw new Error('unknown record schema');
    if (typeof v['id'] !== 'string' || typeof v['title'] !== 'string' || !isParadigmId(v['paradigm'])) throw new Error('record header is incomplete');
    const doc = migrate(v['doc'], this.hooks);
    if (doc.paradigm !== v['paradigm']) throw new Error('record paradigm does not match its document');
    return { schema: SCHEMA, id: v['id'], title: v['title'], paradigm: v['paradigm'], presetId: typeof v['presetId'] === 'string' ? v['presetId'] : 'blank', updatedAt: typeof v['updatedAt'] === 'number' ? v['updatedAt'] : 0, doc };
  }
  private tryParse(raw: string | null): StoredDocument | null { if (raw == null) return null; try { return this.parseRecord(raw); } catch { return null; } }

  load(pid: ParadigmId): LoadResult {
    const k = docKey(pid), raw = this.store.read(k), pendingRaw = this.store.read(k + '.pending');
    const current = this.tryParse(raw), pending = this.tryParse(pendingRaw);
    // a complete pending write that never became current is the newest state the user had
    if (pending && (!current || pending.updatedAt > current.updatedAt)) { this.commit(k, pendingRaw!, raw); return current ? { kind: 'ok', record: pending, recovered: 'interrupted', alternative: current } : { kind: 'ok', record: pending, recovered: 'interrupted' }; }
    if (pendingRaw != null) this.store.remove(k + '.pending');
    if (current) return { kind: 'ok', record: current, recovered: null };
    if (raw == null) return { kind: 'none' };
    // current is unreadable: keep it for export, fall back to the last good version if there is one
    let reason = 'unreadable record';
    try { this.parseRecord(raw); } catch (e) { reason = e instanceof Error ? e.message : String(e); }
    try { this.store.write(k + '.broken', raw); } catch { /* best effort */ }
    const prev = this.tryParse(this.store.read(k + '.prev'));
    if (prev) { this.store.remove(k); return { kind: 'ok', record: prev, recovered: 'previous', reason }; }
    return { kind: 'invalid', reason, raw };
  }
  private commit(k: string, next: string, prevRaw: string | null): void {
    if (prevRaw != null) this.store.write(k + '.prev', prevRaw);
    this.store.write(k, next);
    this.store.remove(k + '.pending');
  }
  /** throws when the provider refuses the write; nothing is half-applied in that case */
  save(record: StoredDocument): void {
    const k = docKey(record.paradigm), next = JSON.stringify(record);
    this.store.write(k + '.pending', next);
    this.commit(k, next, this.store.read(k));
  }
  remove(pid: ParadigmId): void { const k = docKey(pid); for (const sfx of ['', '.pending', '.prev', '.broken']) this.store.remove(k + sfx); }
  /** the unreadable copy kept by a failed load, if any */
  broken(pid: ParadigmId): string | null { return this.store.read(docKey(pid) + '.broken'); }
  clearBroken(pid: ParadigmId): void { this.store.remove(docKey(pid) + '.broken'); }

  loadSession(): StoredSession | null {
    try { const v: unknown = JSON.parse(this.store.read(SESSION_KEY) ?? 'null'); return isObj(v) && v['schema'] === SCHEMA && isParadigmId(v['active']) ? { schema: SCHEMA, active: v['active'], updatedAt: typeof v['updatedAt'] === 'number' ? v['updatedAt'] : 0 } : null; } catch { return null; }
  }
  saveSession(active: ParadigmId): void { this.store.write(SESSION_KEY, JSON.stringify({ schema: SCHEMA, active, updatedAt: Date.now() } satisfies StoredSession)); }
  /** every paradigm with a stored record, readable or not */
  stored(): ParadigmId[] { return PARADIGM_IDS.filter(pid => this.store.read(docKey(pid)) != null || this.store.read(docKey(pid) + '.pending') != null); }
}
