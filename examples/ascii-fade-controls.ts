import { FADE_SIDES } from "@/components/asciicn/ascii-fade";
import { select, segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the ASCII fade demo, shared by the page and the demo.

export const side = segmented({
  default: "bottom",
  id: "side",
  label: "Side",
  options: FADE_SIDES,
});

export const charset = select({
  default: "blocks",
  id: "charset",
  label: "Charset",
  options: [
    "blocks",
    "quadrants",
    "braille",
    "standard",
    "dense",
    "dots",
    "petscii",
  ],
});

export const size = slider({
  default: 10,
  id: "size",
  label: "Depth",
  max: 24,
  min: 3,
  step: 1,
  unit: "cells",
});

export const drift = toggle({
  default: true,
  id: "drift",
  label: "Drift",
});

/** Display order of the tray. */
export const controls = [side, charset, size, drift];
