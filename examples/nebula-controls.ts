import { CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import { select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the nebula main demo, shared by the page and the demo.

export const seed = select({
  default: "nebula",
  id: "seed",
  label: "Seed",
  options: ["nebula", "orion-4", "tidepool", "0xC0FFEE", "lantern", "ashfall"],
});

export const charset = select({
  default: "quadrants",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = select({
  default: "truecolor",
  id: "colorMode",
  label: "Colour mode",
  options: COLOR_MODES,
});

export const intensity = slider({
  default: 1,
  id: "intensity",
  label: "Intensity",
  max: 1.5,
  min: 0.3,
  step: 0.05,
});

export const cell = slider({
  default: 12,
  id: "cell",
  label: "Cell",
  max: 20,
  min: 8,
  step: 1,
  unit: "px",
});

export const animate = toggle({
  default: true,
  id: "animate",
  label: "Animate",
});

/** Display order of the tray. */
export const controls = [seed, charset, colorMode, intensity, cell, animate];
