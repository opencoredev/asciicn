import { CHARSET_NAMES, PHOSPHOR_NAMES } from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the ocean waves main demo, shared by the page and the demo.
// The colour options repeat OCEAN_COLOR_MODES because this file runs on
// the server and can't import values from the component.

export const charset = select({
  default: "standard",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = segmented({
  default: "truecolor",
  id: "colorMode",
  label: "Colour",
  options: ["truecolor", "mono"],
});

export const phosphor = select({
  default: "none",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: ["none", ...PHOSPHOR_NAMES],
});

export const swell = slider({
  default: 0.6,
  id: "swell",
  label: "Swell",
  max: 1,
  min: 0,
  step: 0.05,
});

export const wind = slider({
  default: 0.4,
  id: "wind",
  label: "Wind",
  max: 1,
  min: 0,
  step: 0.05,
});

export const moon = toggle({
  default: true,
  id: "moon",
  label: "Moon",
});

export const intensity = slider({
  default: 1,
  id: "intensity",
  label: "Intensity",
  max: 1,
  min: 0,
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
export const controls = [
  charset,
  colorMode,
  phosphor,
  swell,
  wind,
  moon,
  intensity,
  cell,
  animate,
];
