// Typegram design-system ZoomControl (components/controls/ZoomControl.jsx), typed. Identical DOM.
export interface ZoomControlProps { value?: number; onZoomIn?: () => void; onZoomOut?: () => void; onReset?: () => void; onFit?: () => void }
export function ZoomControl({ value = 100, onZoomIn, onZoomOut, onReset, onFit }: ZoomControlProps) {
  return (
    <div className="tg-zoom">
      <button className="tg-zoom-btn" title="Zoom out" onClick={onZoomOut}>−</button>
      <span className="tg-zoom-label" title="Reset to 100%" onClick={onReset}>{value}%</span>
      <button className="tg-zoom-btn" title="Zoom in" onClick={onZoomIn}>+</button>
      <button className="tg-zoom-btn tg-zoom-fit" title="Fit to pane" onClick={onFit}>fit</button>
    </div>
  );
}
