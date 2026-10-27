import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, select, slider } from "@/lib/preview-controls";

// Knobs for the loader's main demo, shared by the page and the demo.
// Spinner names are spelled out: SPINNERS lives in a module this
// server-read file shouldn't pull in for one list.

export const variant = segmented({
  default: "spinner",
  id: "variant",
  label: "Variant",
  options: ["spinner", "dots", "wave", "comet"],
});

export const spinner = select({
  default: "orbit",
  id: "spinner",
  label: "Spinner",
  options: ["orbit", "braille", "arc", "tick", "bar", "quadrant"],
});

export const size = segmented({
  default: "lg",
  id: "size",
  label: "Size",
  options: ["sm", "md", "lg"],
});

export const tint = color({
  default: "ink",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const speed = slider({
  default: 1,
  id: "speed",
  label: "Speed",
  max: 2,
  min: 0.25,
  step: 0.25,
  unit: "x",
});

/** Display order of the tray. */
export const controls = [variant, spinner, size, tint, speed];
