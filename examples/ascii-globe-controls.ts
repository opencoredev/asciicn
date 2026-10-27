import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { COLOR_MODES } from "@/lib/ascii/palettes";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the ASCII globe's main demo, shared by the page and the demo.

export const charset = select({
  default: "braille",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = segmented({
  default: "truecolor",
  id: "colorMode",
  label: "Colour",
  options: COLOR_MODES,
});

export const speed = slider({
  default: 6,
  id: "speed",
  label: "Speed",
  max: 30,
  min: -30,
  step: 2,
  unit: "°/s",
});

export const light = slider({
  default: 300,
  id: "light",
  label: "Sun",
  max: 360,
  min: 0,
  step: 15,
  unit: "°",
});

export const cell = slider({
  default: 10,
  id: "cell",
  label: "Cell",
  max: 18,
  min: 6,
  step: 1,
  unit: "px",
});

export const arcs = toggle({ default: true, id: "arcs", label: "Arcs" });

export const graticule = toggle({
  default: false,
  id: "graticule",
  label: "Graticule",
});

/** Display order of the tray. */
export const controls = [
  charset,
  colorMode,
  speed,
  light,
  cell,
  arcs,
  graticule,
];
