import type { PointerEvent } from 'react';
import type { Side } from '../router/geometry';
import type { PortState } from './types';

const POS: Record<Side, { top?: string; left?: string }> = { left: { top: '50%' }, right: { top: '50%' }, top: { left: '50%' }, bottom: { left: '50%' } };
export function NodePort({ side, state, onDown }: { side: Side; state: PortState; onDown: (e: PointerEvent<HTMLSpanElement>) => void }) {
  return <span className="tg-port" data-side={side} data-state={state} style={POS[side]} onPointerDown={onDown} />;
}
