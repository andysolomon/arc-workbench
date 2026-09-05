// Form factors. Desktop is the default shell; tablets get an intentional layout instead of a
// squeezed one: landscape keeps side panels (narrower), portrait turns them into bottom sheets,
// and the library becomes an overlay drawer on both. Thresholds are documented in README § Tablet.
export type Form = 'desktop' | 'tablet-landscape' | 'tablet-portrait';
export const TABLET_MAX = 1180;
export const PORTRAIT_MAX = 900;
export const formOf = (width: number): Form => width <= PORTRAIT_MAX ? 'tablet-portrait' : width <= TABLET_MAX ? 'tablet-landscape' : 'desktop';
/** the shell keeps ≥ this share of the viewport for the canvas with every panel open */
export const CANVAS_SHARE = 0.5;
export const SHEET_MAX_VH = 45;
