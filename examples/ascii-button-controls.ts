import type {
  ASCII_BUTTON_FRAMES as ASCII_BUTTON_FRAMES_SOURCE,
  ASCII_BUTTON_VARIANTS as ASCII_BUTTON_VARIANTS_SOURCE,
} from "@/components/asciicn/ascii-button";
import { ASCII_COLOR_NAMES } from "@/lib/ascii";
import { color, segmented, select, toggle } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const ASCII_BUTTON_FRAMES = [
  "rounded",
  "light",
  "heavy",
  "double",
  "ascii",
  "brackets",
] as const satisfies typeof ASCII_BUTTON_FRAMES_SOURCE;
const ASCII_BUTTON_VARIANTS = [
  "filled",
  "outline",
  "ghost",
] as const satisfies typeof ASCII_BUTTON_VARIANTS_SOURCE;

// Knobs for the button's main demo, shared by the page and the demo.

export const variant = segmented({
  default: "filled",
  id: "variant",
  label: "Variant",
  options: ASCII_BUTTON_VARIANTS,
});

export const frame = select({
  default: "rounded",
  id: "frame",
  label: "Frame",
  options: ASCII_BUTTON_FRAMES,
});

export const tint = color({
  default: "ink",
  id: "color",
  label: "Colour",
  options: ASCII_COLOR_NAMES,
});

export const size = segmented({
  default: "lg",
  id: "size",
  label: "Size",
  options: ["sm", "md", "lg"],
});

export const loading = toggle({
  default: false,
  id: "loading",
  label: "Loading",
});

/** Display order of the tray. */
export const controls = [variant, frame, tint, size, loading];
