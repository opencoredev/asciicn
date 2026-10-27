import { GLOW_POSITIONS } from "@/components/asciicn/ascii-glow";
import { ASCII_COLOR_NAMES, CHARSET_NAMES } from "@/lib/ascii";
import { color, select, slider } from "@/lib/preview-controls";

// Knobs for the ASCII glow demo, shared by the page and the demo.

export const position = select({
  default: "top",
  id: "position",
  label: "Position",
  options: GLOW_POSITIONS,
});

export const charset = select({
  default: "standard",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const tint = color({
  default: "ink",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const radius = slider({
  default: 0.7,
  id: "radius",
  label: "Radius",
  max: 1.4,
  min: 0.2,
  step: 0.05,
});

export const intensity = slider({
  default: 0.85,
  id: "intensity",
  label: "Intensity",
  max: 1,
  min: 0.2,
  step: 0.05,
});

/** Display order of the tray. */
export const controls = [position, charset, tint, radius, intensity];
