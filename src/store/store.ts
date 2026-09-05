// A hand-written external store. `set` merges a patch (or applies an updater) and notifies
// subscribers synchronously; React reads it through useSyncExternalStore. Callbacks passed to
// `set` run after the next React commit (the prototype's setState(patch, cb) contract) — the
// root component drains them from its layout effect.
import { useSyncExternalStore } from 'react';

export type Patch<S> = Partial<S> | ((s: S) => Partial<S>);
export interface Store<S> {
  get(): S;
  set(patch: Patch<S>, afterCommit?: () => void): void;
  subscribe(fn: () => void): () => void;
  /** callbacks queued by `set`, drained by the host after commit */
  drainAfterCommit(): void;
  version(): number;
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial, ver = 0;
  const subs = new Set<() => void>();
  let queue: Array<() => void> = [];
  return {
    get: () => state,
    set(patch, afterCommit) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p }; ver++;
      if (afterCommit) queue.push(afterCommit);
      subs.forEach(fn => fn());
    },
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
    drainAfterCommit() { if (!queue.length) return; const q = queue; queue = []; q.forEach(fn => fn()); },
    version: () => ver,
  };
}

export function useStore<S extends object>(store: Store<S>): S { return useSyncExternalStore(store.subscribe, store.get, store.get); }
