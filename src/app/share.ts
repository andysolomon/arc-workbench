// Share links: the whole GraphDocument rides in the URL fragment (`#d=<base64url json>`), so a
// link is a self-contained snapshot — no server, nothing to expire. The fragment never reaches
// the network. Decoding runs the document through the model guards + migrations, so a tampered
// or truncated link yields `null` rather than a half-loaded graph.
import { migrate, type GraphDocument } from '../model';
import { familyOfGk } from '../paradigms';
import type { WorkbenchState } from '../store';

export const SHARE_KEY = 'd';
export const SHARED_PRESET = 'shared';

type ShareSource = Pick<WorkbenchState, 'paradigm' | 'nodes' | 'edges' | 'regions' | 'rps' | 'view' | 'presetId' | 'docId' | 'title'>;

/** The exchange document for the live state; `rps` travels as `metadata.load`. */
export function docOf(s: ShareSource, title?: string): GraphDocument {
  return {
    version: 3, id: s.docId || 'wb-' + s.paradigm, title: title ?? (s.title || s.presetId), paradigm: s.paradigm,
    nodes: s.nodes.map(n => ({ ...n })), edges: s.edges.map(e => ({ ...e })), regions: s.regions.map(r => ({ ...r })),
    metadata: { load: s.rps, presetId: s.presetId }, view: { ...s.view },
  };
}

const toB64Url = (bytes: Uint8Array): string => {
  let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const encodeDocument = (doc: GraphDocument): string => toB64Url(new TextEncoder().encode(JSON.stringify(doc)));
/** untrusted input: every failure (bad base64, bad json, bad document) is a null, never a throw */
export function decodeDocument(s: string): GraphDocument | null {
  try { return migrate(JSON.parse(new TextDecoder().decode(fromB64Url(s))), { familyOfAlias: familyOfGk }); }
  catch { return null; }
}

/** `#d=…` → the encoded payload, or null when the fragment carries no document */
export function sharePayload(hash: string): string | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  return q.get(SHARE_KEY);
}
export const shareHash = (s: ShareSource): string => '#' + SHARE_KEY + '=' + encodeDocument(docOf(s));
export const shareUrl = (s: ShareSource, loc: { origin: string; pathname: string; search: string }): string => loc.origin + loc.pathname + loc.search + shareHash(s);
