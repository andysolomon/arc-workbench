// Undo / redo: JSON snapshots of the graph, 60 deep (WB 1822–1828). Serialising is the cheapest
// correct deep copy for documents at preset scale, and it is what the prototype shipped.
import type { Graph } from '../model/document';

/**
 * An edit snapshot is the graph alone. A document-level transaction (preset replacement, new
 * document) also carries the preset id, the load slider and the clean-document mark, so one undo
 * restores the whole document state — and one redo re-applies it.
 */
export interface Snapshot extends Graph { presetId?: string; rps?: number; clean?: string | null; docId?: string; title?: string }
const isDocLevel = (g: Partial<Snapshot>): boolean => g.presetId !== undefined;

export class History {
  hist: string[] = [];
  future: string[] = [];
  snap(g: Snapshot): void { this.hist.push(JSON.stringify(g)); if (this.hist.length > 60) this.hist.shift(); this.future = []; }
  /** pop from `from`, push the current state onto `to`; null when there is nothing to restore */
  restore(from: string[], to: string[], current: Snapshot): Snapshot | null {
    if (!from.length) return null;
    const g = JSON.parse(from.pop()!) as Partial<Snapshot>;
    // the mirror entry matches the popped one's level, so document transactions round-trip both ways
    const cur: Snapshot = isDocLevel(g) ? current : { nodes: current.nodes, edges: current.edges, regions: current.regions };
    to.push(JSON.stringify(cur));
    const out: Snapshot = { nodes: g.nodes ?? [], edges: g.edges ?? [], regions: g.regions ?? current.regions };
    if (g.presetId !== undefined) out.presetId = g.presetId;
    if (g.rps !== undefined) out.rps = g.rps;
    if (g.clean !== undefined) out.clean = g.clean;
    if (g.docId !== undefined) out.docId = g.docId;
    if (g.title !== undefined) out.title = g.title;
    return out;
  }
  undo(current: Snapshot): Snapshot | null { return this.restore(this.hist, this.future, current); }
  redo(current: Snapshot): Snapshot | null { return this.restore(this.future, this.hist, current); }
  reset(hist: string[] = [], future: string[] = []): void { this.hist = hist; this.future = future; }
  get canUndo(): boolean { return this.hist.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
}
