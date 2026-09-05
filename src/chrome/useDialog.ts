// Dialog focus contract: focus moves in on open (the first control, or the one the caller
// names), Tab cycles inside, and focus returns to where it was on close.
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDialog(initial?: RefObject<HTMLElement>): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null, root = ref.current;
    const first = initial?.current ?? root?.querySelector<HTMLElement>(FOCUSABLE) ?? root;
    first?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab' || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const a = items[0]!, z = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    root?.addEventListener('keydown', onKey);
    return () => { root?.removeEventListener('keydown', onKey); if (prev && document.contains(prev)) prev.focus(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- runs once per dialog mount
  return ref;
}
