// Undo / redo: JSON snapshots of the graph, 60 deep (WB 1822–1828). Serialising is the cheapest
// correct deep copy for documents at preset scale, and it is what the prototype shipped.
import type { Graph } from '../model/document';

export class History {
  hist: string[] = [];
  future: string[] = [];
  snap(g: Graph): void { this.hist.push(JSON.stringify(g)); if (this.hist.length > 60) this.hist.shift(); this.future = []; }
  /** pop from `from`, push the current graph onto `to`; null when there is nothing to restore */
  restore(from: string[], to: string[], current: Graph): Graph | null {
    if (!from.length) return null;
    to.push(JSON.stringify(current));
    const g = JSON.parse(from.pop()!) as Partial<Graph>;
    return { nodes: g.nodes ?? [], edges: g.edges ?? [], regions: g.regions ?? current.regions };
  }
  undo(current: Graph): Graph | null { return this.restore(this.hist, this.future, current); }
  redo(current: Graph): Graph | null { return this.restore(this.future, this.hist, current); }
  reset(hist: string[] = [], future: string[] = []): void { this.hist = hist; this.future = future; }
  get canUndo(): boolean { return this.hist.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
}
