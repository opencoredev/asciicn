import { CHARSET_NAMES, RAMP_NAMES } from "@/lib/ascii";
import { segmented, select, slider, toggle } from "@/lib/preview-controls";

// Knobs for the glyph trail's main demo, shared by the page and the demo.
// The colour options repeat GlyphTrailColorMode because this file runs on
// the server and can't import values from the component.

export const charset = select({
  default: "standard",
  id: "charset",
  label: "Charset",
  options: CHARSET_NAMES,
});

export const colorMode = segmented({
  default: "truecolor",
  id: "colorMode",
  label: "Colour",
  options: ["truecolor", "duotone", "mono"],
});

export const ramp = select({
  default: "ember",
  id: "ramp",
  label: "Ramp (duotone)",
  options: RAMP_NAMES,
});

export const decay = slider({
  default: 4.8,
  id: "decay",
  label: "Decay",
  max: 6,
  min: 0.6,
  step: 0.1,
  unit: "s",
});

export const spread = slider({
  default: 1.8,
  id: "spread",
  label: "Spread",
  max: 3,
  min: 0.4,
  step: 0.1,
});

export const idle = toggle({
  default: true,
  id: "idle",
  label: "Idle wanderer",
});

export const cell = slider({
  default: 14,
  id: "cell",
  label: "Cell",
  max: 20,
  min: 10,
  step: 1,
  unit: "px",
});

/** Display order of the tray. */
export const controls = [charset, colorMode, ramp, decay, spread, idle, cell];
