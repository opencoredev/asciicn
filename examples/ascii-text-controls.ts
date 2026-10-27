import type { ASCII_TEXT_REVEALS as ASCII_TEXT_REVEALS_SOURCE } from "@/components/asciicn/ascii-text";
import { CHARSET_NAMES } from "@/lib/ascii";
import { segmented, select, slider } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const ASCII_TEXT_REVEALS = [
  "none",
  "decode",
  "scan",
  "wipe",
] as const satisfies typeof ASCII_TEXT_REVEALS_SOURCE;

// Knobs for the ASCII text demo, shared by the page and the demo.

export const charset = select({
  default: "braille",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const reveal = segmented({
  default: "decode",
  id: "reveal",
  label: "Reveal",
  options: ASCII_TEXT_REVEALS,
});

export const cell = slider({
  default: 8,
  id: "cell",
  label: "Cell",
  max: 14,
  min: 5,
  step: 1,
  unit: "px",
});

export const size = slider({
  default: 120,
  id: "size",
  label: "Type size",
  max: 200,
  min: 48,
  step: 4,
  unit: "px",
});

/** Display order of the tray. */
export const controls = [charset, reveal, cell, size];
