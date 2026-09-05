// The DC harness fed these as component props with defaults (WB data-props); same names, same defaults.
import type { Theme } from '../store/state';
export interface WorkbenchProps {
  theme?: Theme;
  motion?: boolean;
  grid?: boolean;
  pixelFill?: boolean;
  router?: 'channels' | 'independent';
  channelGap?: 'tight' | 'normal' | 'loose';
  zoomMode?: 'crisp' | 'smooth';
  zoomSnap?: 'free' | 'crisp';
}
export type ResolvedProps = Required<WorkbenchProps>;
export const resolveProps = (p: WorkbenchProps): ResolvedProps => ({ theme: p.theme ?? 'dark', motion: p.motion ?? true, grid: p.grid ?? true, pixelFill: p.pixelFill ?? true, router: p.router ?? 'channels', channelGap: p.channelGap ?? 'normal', zoomMode: p.zoomMode ?? 'crisp', zoomSnap: p.zoomSnap ?? 'free' });
