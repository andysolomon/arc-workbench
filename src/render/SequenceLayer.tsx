// lifelines, phase rules, ticks, activations and the time cursor — one SVG layer, never per-message components
import type { Handlers, SeqVM } from './types';
export function SequenceLayer({ s, h }: { s: SeqVM; h: Handlers }) {
  return (
    <>
      {s.lines.map(l => <line key={l.id} className="tg-lifeline" x1={l.x} y1={l.y1} x2={l.x} y2={l.y2} />)}
      {s.ticks.map((t, i) => (
        <g key={i}>
          <line className="tg-seq-rule" x1={t.x1} y1={t.y} x2={t.x2} y2={t.y} />
          <text className="tg-seq-tick" x={t.x1} y={t.ty}>{t.label}</text>
        </g>
      ))}
      {s.acts.map((a, i) => <rect key={a.id + i} className="tg-activation" data-family={a.family} x={a.x} y={a.y} width={a.w} height={a.h} />)}
      {s.cursor ? <line className="tg-seq-cursor" ref={h.setCursorEl} x1={s.cursor.x1} x2={s.cursor.x2} y1={s.cursor.y} y2={s.cursor.y} /> : null}
    </>
  );
}
