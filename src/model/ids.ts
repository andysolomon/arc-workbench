// Identifier scheme — verbatim from the prototype: a prefix plus a millisecond clock.
// The clock is injectable so tests and goldens are deterministic.
export type Clock = () => number;
let clock: Clock = () => Date.now();
export function setIdClock(c: Clock): void { clock = c; }

export const nodeId = (type: string): string => type + '_' + clock();
export const edgeId = (): string => 'e' + clock();
export const laneId = (): string => 'l' + clock();
export const phaseId = (): string => 'ph' + clock();
export const docId = (): string => 'doc_' + clock();
/** preset/example edge id: `from>to`, with `#seq` when a sequence message carries an order */
export const authoredEdgeId = (from: string, to: string, seq?: number): string => from + '>' + to + (seq ? '#' + seq : '');
