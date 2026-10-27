import {
  CHARSET_NAMES,
  COLOR_MODES,
  PHOSPHOR_NAMES,
  RAMP_NAMES,
} from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the San Francisco main demo, shared by the page and the demo.

export const charset = select({
  default: "standard",
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

export const phosphor = select({
  default: "none",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: ["none", ...PHOSPHOR_NAMES],
});

export const ramp = select({
  default: "ember",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const intensity = slider({
  default: 1,
  id: "intensity",
  label: "Intensity",
  max: 1,
  min: 0,
  step: 0.05,
});

export const fog = slider({
  default: 0.6,
  id: "fog",
  label: "Fog",
  max: 1,
  min: 0,
  step: 0.05,
});

export const sails = slider({
  default: 0.6,
  id: "sails",
  label: "Sails",
  max: 1,
  min: 0,
  step: 0.05,
});

export const traffic = slider({
  default: 0.5,
  id: "traffic",
  label: "Traffic",
  max: 1,
  min: 0,
  step: 0.05,
});

export const interactive = toggle({
  default: true,
  id: "interactive",
  label: "Parallax",
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

export const interaction = segmented({
  default: "none",
  id: "interaction",
  label: "Pointer",
  options: ["none", "repel", "ripple", "trail"],
});

/** Display order of the tray. */
export const controls = [
  charset,
  colorMode,
  phosphor,
  ramp,
  intensity,
  fog,
  sails,
  traffic,
  interactive,
  interaction,
  cell,
  animate,
];
