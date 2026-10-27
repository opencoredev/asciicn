import { ASCII_COLOR_NAMES, CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import {
  color,
  segmented,
  select,
  slider,
  toggle,
} from "@/lib/preview-controls";

// Knobs for the halftone main demo, shared by the page and the demo.

export const charset = select({
  default: "braille",
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

export const ink = color({
  default: "ink",
  id: "ink",
  label: "Ink",
  options: ASCII_COLOR_NAMES,
});

export const source = segmented({
  default: "noise",
  id: "source",
  label: "Source",
  options: ["noise", "radial", "linear"],
});

export const pitch = slider({
  default: 3,
  id: "pitch",
  label: "Pitch",
  max: 6,
  min: 1,
  step: 0.5,
});

export const angle = slider({
  default: 45,
  id: "angle",
  label: "Angle",
  max: 90,
  min: 0,
  step: 5,
  unit: "\u00B0",
});

export const intensity = slider({
  default: 0.95,
  id: "intensity",
  label: "Dot size",
  max: 1,
  min: 0.3,
  step: 0.05,
});

export const drift = slider({
  default: 1,
  id: "drift",
  label: "Drift",
  max: 3,
  min: 0,
  step: 0.25,
});

export const interaction = segmented({
  default: "none",
  id: "interaction",
  label: "Pointer",
  options: ["none", "repel", "ripple", "trail"],
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
  ink,
  source,
  pitch,
  angle,
  intensity,
  drift,
  interaction,
  cell,
  animate,
];
