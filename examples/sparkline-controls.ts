import { SPARKLINE_GLYPHS } from "@/components/asciicn/sparkline";
import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the sparkline's main demo, shared by the page and the demo.

export const glyphs = segmented({
  default: "eighths",
  id: "glyphs",
  label: "Glyphs",
  options: SPARKLINE_GLYPHS,
});

export const rows = slider({
  default: 1,
  id: "rows",
  label: "Rows",
  max: 3,
  min: 1,
  step: 1,
});

export const tint = color({
  default: "green",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const fill = toggle({
  default: false,
  id: "fill",
  label: "Braille fill",
});

export const interactive = toggle({
  default: true,
  id: "interactive",
  label: "Interactive",
});

/** Display order of the tray. */
export const controls = [glyphs, rows, tint, fill, interactive];
