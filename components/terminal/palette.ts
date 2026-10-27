/**
 * Site palettes. The active palette lives on `<html data-palette>` and, for
 * `custom`, `--palette-hue`; styles/globals.css turns those into the ink
 * colour (`--ascii-ink`, `--primary`, `--ring`, the selection) and tints
 * the neutrals. Shared by the switcher and the pre-paint script so both
 * read and write the same storage keys.
 */

export const PALETTES = [
  { hue: 148, id: "phosphor", label: "Phosphor", note: "P1 green" },
  { hue: 70, id: "amber", label: "Amber", note: "P3 amber" },
  { hue: 245, id: "cyanotype", label: "Cyanotype", note: "Iron blue" },
  { hue: 300, id: "custom", label: "Custom", note: "Any OKLCH hue" },
] as const satisfies readonly {
  hue: number;
  id: string;
  label: string;
  note: string;
}[];

export type PaletteId = (typeof PALETTES)[number]["id"];

export const DEFAULT_PALETTE: PaletteId = "phosphor";
export const DEFAULT_CUSTOM_HUE = 300;

export const PALETTE_STORAGE_KEY = "asciicn-palette";
export const PALETTE_HUE_STORAGE_KEY = "asciicn-palette-hue";

/** Fired on `window` after the palette changes, so readouts can follow it. */
export const PALETTE_EVENT = "asciicn:palette";

export const isPaletteId = (value: unknown): value is PaletteId =>
  PALETTES.some((palette) => palette.id === value);

/** Wraps any number into 0..359 so stored hues stay valid. */
export const normalizeHue = (hue: number): number =>
  Number.isFinite(hue)
    ? ((Math.round(hue) % 360) + 360) % 360
    : DEFAULT_CUSTOM_HUE;

export interface PaletteState {
  readonly palette: PaletteId;
  /** Hue for `custom`, kept even while another palette is active. */
  readonly hue: number;
}

/** Writes the palette to `<html>`. Runs on the client only. */
export const applyPalette = ({ palette, hue }: PaletteState): void => {
  const root = document.documentElement;
  root.dataset.palette = palette;
  root.style.setProperty("--palette-hue", String(normalizeHue(hue)));
  // Canvases recolour when <html style> changes (lib/ascii subscribeToTheme
  // watches class and style), so mirror the id there too.
  root.style.setProperty("--palette-id", palette);
};

/**
 * Runs before first paint (inlined by app/layout.tsx) so a stored palette
 * never flashes the default. Kept dependency-free and tolerant of blocked
 * storage.
 */
export const PALETTE_SCRIPT = `(function(){try{var d=document.documentElement,p=localStorage.getItem(${JSON.stringify(PALETTE_STORAGE_KEY)}),h=parseFloat(localStorage.getItem(${JSON.stringify(PALETTE_HUE_STORAGE_KEY)}));var ok=${JSON.stringify(PALETTES.map((palette) => palette.id))};d.dataset.palette=ok.indexOf(p)>-1?p:${JSON.stringify(DEFAULT_PALETTE)};if(isFinite(h)){d.style.setProperty("--palette-hue",String(((Math.round(h)%360)+360)%360))}}catch(e){document.documentElement.dataset.palette=${JSON.stringify(DEFAULT_PALETTE)}}})();`;
