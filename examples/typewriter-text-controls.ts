import type { TYPEWRITER_CURSOR_NAMES as TYPEWRITER_CURSOR_NAMES_SOURCE } from "@/components/asciicn/typewriter-text";
import { segmented, slider, toggle } from "@/lib/preview-controls";

// Option lists are copied, not imported: this file runs on the server (the
// MDX page passes `controls` to the preview frame), where a "use client"
// module's exports are client references. `satisfies` keeps them in step.
const TYPEWRITER_CURSOR_NAMES = [
  "block",
  "underscore",
  "bar",
] as const satisfies typeof TYPEWRITER_CURSOR_NAMES_SOURCE;

// Knobs for the typewriter text demo, shared by the page and the demo.

export const cursor = segmented({
  default: "block",
  id: "cursor",
  label: "Cursor",
  options: TYPEWRITER_CURSOR_NAMES,
});

export const speed = slider({
  default: 16,
  id: "speed",
  label: "Speed",
  max: 40,
  min: 4,
  step: 2,
  unit: " cps",
});

export const jitter = slider({
  default: 60,
  id: "jitter",
  label: "Jitter",
  max: 100,
  min: 0,
  step: 10,
  unit: "%",
});

export const prompt = toggle({ default: true, id: "prompt", label: "Prompt" });

export const backspace = toggle({
  default: true,
  id: "backspace",
  label: "Backspace",
});

/** Display order of the tray. */
export const controls = [cursor, speed, jitter, prompt, backspace];
