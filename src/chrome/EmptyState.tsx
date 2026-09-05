// empty document: the first action is never a guess. Copy comes from the paradigm registry, so
// a blank sequence asks for participants and a blank workflow for steps. Floats over the canvas;
// the canvas underneath still pans, zooms and accepts library drops.
import type { WorkbenchController } from '../app/controller';
import { EXAMPLES } from '../paradigms';

export function EmptyState({ ctl }: { ctl: WorkbenchController }) {
  const s = ctl.state, T = ctl.T, first = Object.keys(T.TYPES)[0], ex = EXAMPLES[s.paradigm][0];
  const firstLabel = first ? T.TYPES[first]!.label.toLowerCase() : T.unitNoun;
  return (
    <div className="wb-empty" data-chrome="1" role="region" aria-labelledby="wb-empty-title">
      <div className="wb-empty-card">
        <div className="tg-label">empty {T.label}</div>
        <div id="wb-empty-title" className="wb-empty-title">{T.ask}</div>
        <div className="wb-empty-blurb">{T.blurb} · pick from the library on the left, or start here</div>
        <div className="wb-empty-actions">
          {first ? <button className="tg-btn tg-btn--primary" onClick={() => ctl.addNode(first)}>+ add {firstLabel}</button> : null}
          {ex ? <button className="tg-btn" onClick={() => ctl.loadPreset(ex.id)}>load example · {ex.name.toLowerCase()}</button> : null}
          <button className="tg-btn" onClick={() => ctl.importDoc()}>import json</button>
          <button className="tg-btn" onClick={() => ctl.setState({ helpOpen: true })}>keyboard help <span className="wb-key">?</span></button>
        </div>
      </div>
    </div>
  );
}
