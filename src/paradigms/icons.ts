// 16×16 stroke icon paths — the library's glyph set (Unicode glyphs are the icon set elsewhere).
export const I = {
  box: 'M4 4h8v8H4Z', diamond: 'M8 3l5 5-5 5-5-5Z', tri: 'M8 3l5 10H3Z', circle: 'M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12',
  check: 'M3 8l3 3 7-7', clock: 'M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12M8 5v3l2 2', bolt: 'M9 2L4 9h4l-1 5 5-7H8Z',
  loop: 'M3 8a5 5 0 0 1 9-3M13 8a5 5 0 0 1-9 3M12 2v3h-3M4 14v-3h3', x: 'M4 4l8 8M12 4l-8 8', stop: 'M4 4h8v8H4ZM6 6h4v4H6Z',
  doc: 'M4 2h6l3 3v9H4ZM10 2v3h3', person: 'M8 2a3 3 0 1 1 0 6a3 3 0 1 1 0-6M2 14c1-3 3-4 6-4s5 1 6 4',
  lines: 'M3 5h10M3 8h10M3 11h7', db: 'M4 4c0-1.1 1.8-2 4-2s4 .9 4 2v8c0 1.1-1.8 2-4 2s-4-.9-4-2V4M4 4c0 1.1 1.8 2 4 2s4-.9 4-2',
  shield: 'M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4Z', funnel: 'M2 3h12L9 9v4l-2 1V9Z', stack: 'M3 4h10v3H3ZM3 9h10v3H3Z',
  arrow: 'M2 8h10M9 5l3 3-3 3', wave: 'M2 6c2 3 4 3 6 0s4-3 6 0M2 11c2 3 4 3 6 0s4-3 6 0', gate: 'M4 3v10M12 3v10M4 8h8',
  play: 'M5 3l8 5-8 5Z', flag: 'M4 14V2h8l-2 3 2 3H4', split: 'M3 8h4l3-4h3M7 8l3 4h3', merge: 'M3 4h3l3 4 3 0M6 12h0l3-4',
  table: 'M3 3h10v10H3ZM3 7h10M7 3v10', chart: 'M3 13V9M7 13V5M11 13V7M15 13H2', cube: 'M8 2l5 3v6l-5 3-5-3V5ZM3 5l5 3 5-3M8 8v6',
  eye: 'M2 8c2-4 10-4 12 0-2 4-10 4-12 0M8 8a1.5 1.5 0 1 0 0 .1', bell: 'M5 11V7a3 3 0 0 1 6 0v4l1 2H4ZM7 14h2', link: 'M6 10l4-4M5 7L3 9a2.5 2.5 0 0 0 4 4l1-1M11 9l2-2a2.5 2.5 0 0 0-4-4L8 4',
} as const;

/** library icons for sequence message commands and the lane / phase commands */
export const MSG_ICON: Record<string, string> = {
  request: 'M2 8h10M9 5l3 3-3 3', response: 'M14 8H4M7 5L4 8l3 3', event: 'M3 8h4l2-4 2 8 2-4', async: 'M2 8h2M6 8h2M10 8h2M11 5l3 3-3 3',
  callback: 'M13 8a5 5 0 1 1-2-4M13 2v3h-3', retry: 'M3 8a5 5 0 0 1 9-3M13 8a5 5 0 0 1-9 3M12 2v3h-3M4 14v-3h3',
  timeout: 'M8 2a6 6 0 1 1 0 12a6 6 0 1 1 0-12M8 5v3l2 2', error: 'M4 4l8 8M12 4l-8 8', phase: 'M2 5h12M2 11h12',
};
