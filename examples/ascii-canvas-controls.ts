import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the glyph pad's main demo, shared by the page and the demo.

/** Ink sets by knob value: the theme ink, or the named series colours. */
export const INKS = {
  ink: ["--ascii-ink"],
  series: ["blue", "purple", "pink", "orange"],
} as const;

export const charset = select({
  default: "standard",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const inks = segmented({
  default: "ink",
  id: "inks",
  label: "Ink",
  options: ["ink", "series"],
});

export const brushSize = slider({
  default: 1.25,
  id: "brushSize",
  label: "Brush",
  max: 4,
  min: 0.5,
  step: 0.25,
  unit: "cells",
});

export const decay = slider({
  default: 1.8,
  id: "decay",
  label: "Decay",
  max: 6,
  min: 0.4,
  step: 0.1,
  unit: "s",
});

export const cell = slider({
  default: 12,
  id: "cell",
  label: "Cell",
  max: 20,
  min: 8,
  step: 1,
  unit: "px",
});

export const ripples = toggle({
  default: true,
  id: "ripples",
  label: "Ripples",
});

export const idle = toggle({
  default: true,
  id: "idle",
  label: "Idle brush",
});

/** Display order of the tray. */
export const controls = [charset, inks, brushSize, decay, cell, ripples, idle];
