import type { ASCII_COUNTDOWN_ACCENTS as ASCII_COUNTDOWN_ACCENTS_SOURCE } from "@/components/asciicn/ascii-countdown";
import { CHARSET_NAMES } from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const ASCII_COUNTDOWN_ACCENTS = [
  "seconds",
  "colons",
  "both",
  "none",
] as const satisfies typeof ASCII_COUNTDOWN_ACCENTS_SOURCE;

// Knobs for the countdown demo, shared by the page and the demo.

export const charset = select({
  default: "blocks",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const accentOn = segmented({
  default: "seconds",
  id: "accent-on",
  label: "Accent",
  options: ASCII_COUNTDOWN_ACCENTS,
});

export const scramble = slider({
  default: 0.45,
  id: "scramble",
  label: "Scramble",
  max: 1,
  min: 0,
  step: 0.05,
  unit: "s",
});

export const colorMode = segmented({
  default: "mono",
  id: "color-mode",
  label: "Colour",
  options: ["mono", "duotone"],
});

export const ghost = toggle({
  default: true,
  id: "ghost",
  label: "Ghost pixels",
});

/** Display order of the tray. */
export const controls = [charset, accentOn, colorMode, scramble, ghost];
