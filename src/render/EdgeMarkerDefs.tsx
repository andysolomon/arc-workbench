// One painted arrow per state: WebKit implements neither context-stroke nor context-fill, so the
// head cannot inherit its stroke. graph.css swaps marker-end per state. userSpaceOnUse keeps a
// data-weight="3" edge from inflating its own head.
const M = ({ id, fill }: { id: string; fill: string }) => (
  <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1 1L9 5L1 9Z" fill={fill} /></marker>
);
export function EdgeMarkerDefs() {
  return (
    <defs>
      <M id="tgm-arrow" fill="var(--edge-stroke)" />
      <M id="tgm-arrow-hover" fill="var(--edge-hover)" />
      <M id="tgm-arrow-selected" fill="var(--edge-selected)" />
      <M id="tgm-arrow-warn" fill="var(--edge-warn)" />
      <M id="tgm-arrow-critical" fill="var(--edge-critical)" />
    </defs>
  );
}
