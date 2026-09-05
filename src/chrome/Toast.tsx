// toast: a single confirmation line over the canvas (share · load failures). The polite live
// region is always mounted so assistive tech announces the text the moment it appears.
import type { WorkbenchController } from '../app/controller';
export function Toast({ ctl }: { ctl: WorkbenchController }) {
  const t = ctl.state.toast;
  return (
    <div className="wb-toast-live" role="status" aria-live="polite" data-chrome="1">
      {t ? <span key={t.text} className="wb-toast" data-tone={t.tone}>{t.text}</span> : null}
    </div>
  );
}
