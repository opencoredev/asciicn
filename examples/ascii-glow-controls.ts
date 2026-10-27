import type { GLOW_POSITIONS as GLOW_POSITIONS_SOURCE } from "@/components/asciicn/ascii-glow";
import { ASCII_COLOR_NAMES, CHARSET_NAMES } from "@/lib/ascii";
import { color, select, slider } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const GLOW_POSITIONS = [
  "top",
  "bottom",
  "left",
  "right",
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const satisfies typeof GLOW_POSITIONS_SOURCE;

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
