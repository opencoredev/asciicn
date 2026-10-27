import { COLOR_MODES, PHOSPHOR_NAMES, RAMP_NAMES } from "@/lib/ascii";
import { segmented, select } from "@/lib/preview-controls";

// Knobs for the colour modes demo, shared by the page and the demo.

export const colorMode = segmented({
  default: "mono",
  id: "colorMode",
  label: "Mode",
  options: COLOR_MODES,
});

export const phosphor = segmented({
  default: "p1",
  id: "phosphor",
  label: "Phosphor (mono)",
  options: PHOSPHOR_NAMES,
});

export const ramp = select({
  default: "infrared",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const ansi = segmented({
  default: "vga",
  id: "ansi",
  label: "Table (ansi16)",
  options: ["vga", "xterm"],
});

/** Display order of the tray. */
export const controls = [colorMode, phosphor, ramp, ansi];
