import {
  CHART_FILLS,
  CHART_GLYPHS,
} from "@/components/asciicn/cartesian-chart";
import { segmented, slider, toggle } from "@/lib/preview-controls";

// Knobs for the cartesian chart's main demo, shared by the page and the demo.

export const glyphs = segmented({
  default: "blocks",
  id: "glyphs",
  label: "Glyphs",
  options: CHART_GLYPHS,
});

export const fill = segmented({
  default: "gradient",
  id: "fill",
  label: "Fill",
  options: CHART_FILLS,
});

export const curve = segmented({
  default: "smooth",
  id: "curve",
  label: "Curve",
  options: ["smooth", "linear"],
});

export const cell = slider({
  default: 12,
  id: "cell",
  label: "Cell",
  max: 18,
  min: 8,
  step: 1,
  unit: "px",
});

export const grid = toggle({
  default: true,
  id: "grid",
  label: "Gridlines",
});

export const interactive = toggle({
  default: true,
  id: "interactive",
  label: "Interactive",
});

/** Display order of the tray. */
export const controls = [glyphs, fill, curve, cell, grid, interactive];
