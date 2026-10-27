import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import { COLOR_MODES } from "@/lib/ascii/palettes";
import { segmented, select, slider } from "@/lib/preview-controls";

// Knobs for the ASCII orb's main demo, shared by the page and the demo.

export const state = segmented({
  default: "speaking",
  id: "state",
  label: "State",
  options: ["idle", "listening", "speaking"],
});

export const audio = segmented({
  default: "none",
  id: "audio",
  label: "Audio",
  options: ["none", "synth", "mic"],
});

export const charset = select({
  default: "dots",
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

export const morph = slider({
  default: 1,
  id: "morph",
  label: "Morph",
  max: 2,
  min: 0,
  step: 0.1,
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

/** Display order of the tray. */
export const controls = [state, audio, charset, colorMode, morph, cell];
