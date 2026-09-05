// The persistence seam: a tiny key/value contract the workspace writes documents through. The
// graph model never sees it; providers are swapped at the controller boundary (localStorage in
// the browser, memory in tests, anything else later). Writes throw on failure — the caller owns
// the failed-save state.
export interface KeyValueStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  readonly map = new Map<string, string>();
  /** set to make the next writes fail, the way a full or blocked storage does */
  failWrites: Error | null = null;
  read(key: string): string | null { return this.map.get(key) ?? null; }
  write(key: string, value: string): void { if (this.failWrites) throw this.failWrites; this.map.set(key, value); }
  remove(key: string): void { this.map.delete(key); }
}

export class LocalStorageStore implements KeyValueStore {
  private get ls(): Storage { if (typeof localStorage === 'undefined') throw new Error('localStorage unavailable'); return localStorage; }
  read(key: string): string | null { try { return this.ls.getItem(key); } catch { return null; } }
  write(key: string, value: string): void { this.ls.setItem(key, value); }
  remove(key: string): void { try { this.ls.removeItem(key); } catch { /* nothing to remove */ } }
}
