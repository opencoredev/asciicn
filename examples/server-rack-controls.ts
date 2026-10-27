import { PHOSPHOR_NAMES } from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the server rack's main demo, shared by the page and the demo.
// The option lists repeat RACK_CHARSETS and RACK_COLOR_MODES because this
// file runs on the server and can't import values from the component.

export const charset = segmented({
  default: "cp437",
  id: "charset",
  label: "Charset",
  options: ["cp437", "standard"],
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

export const units = slider({
  default: 18,
  id: "units",
  label: "Units",
  max: 42,
  min: 4,
  step: 1,
  unit: "U",
});

export const activity = slider({
  default: 0.6,
  id: "activity",
  label: "Activity",
  max: 1,
  min: 0,
  step: 0.05,
});

export const alert = toggle({
  default: false,
  id: "alert",
  label: "Alert",
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
  max: 18,
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
  units,
  activity,
  alert,
  intensity,
  cell,
  animate,
];
