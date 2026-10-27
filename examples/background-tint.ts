import { cssColor } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";

// Site-only helpers for the background demos' colour knob.

/** `color` mixed into the paper at `share` percent, for in-between tones. */
export const toward = (
  color: AsciiColor,
  share: number,
  base = "--ascii-paper"
) => `color-mix(in oklch, ${cssColor(color)} ${share}%, ${cssColor(base)})`;
