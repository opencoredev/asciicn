import type {
  ASCII_MARQUEE_DIRECTIONS as ASCII_MARQUEE_DIRECTIONS_SOURCE,
  ASCII_MARQUEE_FRAMES as ASCII_MARQUEE_FRAMES_SOURCE,
  ASCII_MARQUEE_MOTIONS as ASCII_MARQUEE_MOTIONS_SOURCE,
} from "@/components/asciicn/ascii-marquee";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const ASCII_MARQUEE_FRAMES = [
  "light",
  "heavy",
  "double",
  "rounded",
  "ascii",
  "none",
] as const satisfies typeof ASCII_MARQUEE_FRAMES_SOURCE;
const ASCII_MARQUEE_MOTIONS = [
  "step",
  "smooth",
] as const satisfies typeof ASCII_MARQUEE_MOTIONS_SOURCE;
const ASCII_MARQUEE_DIRECTIONS = [
  "left",
  "right",
] as const satisfies typeof ASCII_MARQUEE_DIRECTIONS_SOURCE;

// Knobs for the marquee demo, shared by the page and the demo.

export const frame = select({
  default: "light",
  id: "frame",
  label: "Frame",
  options: ASCII_MARQUEE_FRAMES,
});

export const separator = select({
  default: "◆",
  id: "separator",
  label: "Bullet",
  options: ["◆", "■", "●", "▲", "»", "·", "│", "※"],
});

export const motion = segmented({
  default: "step",
  id: "motion",
  label: "Motion",
  options: ASCII_MARQUEE_MOTIONS,
});

export const direction = segmented({
  default: "left",
  id: "direction",
  label: "Direction",
  options: ASCII_MARQUEE_DIRECTIONS,
});

export const speed = slider({
  default: 8,
  id: "speed",
  label: "Speed",
  max: 30,
  min: 2,
  step: 1,
  unit: " cps",
});

export const secondRow = toggle({
  default: true,
  id: "second-row",
  label: "Second row",
});

/** Display order of the tray. */
export const controls = [frame, separator, motion, direction, speed, secondRow];
