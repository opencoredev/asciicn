import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the 404's main demo, shared by the page and the demo.

export const code = select({
  default: "404",
  id: "code",
  label: "Code",
  options: ["404", "410", "500", "503"],
});

export const glyph = segmented({
  default: "█",
  id: "glyph",
  label: "Glyph",
  options: ["█", "▓", "#", "@", "⣿"],
});

export const depth = slider({
  default: 2,
  id: "depth",
  label: "Depth",
  max: 3,
  min: 0,
  step: 1,
});

export const tint = color({
  default: "ink",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const animate = toggle({
  default: true,
  id: "animate",
  label: "Animate",
});

/** Display order of the tray. */
export const controls = [code, glyph, depth, tint, animate];
