"use client";

import { GlyphTrail } from "@/components/asciicn/glyph-trail";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/glyph-trail-controls";

export default function GlyphTrailDemo() {
  return (
    <GlyphTrail
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ramp={usePreviewValue(knobs.ramp)}
      decay={usePreviewValue(knobs.decay)}
      spread={usePreviewValue(knobs.spread)}
      idle={usePreviewValue(knobs.idle)}
      cell={usePreviewValue(knobs.cell)}
      // The trail clears around the hint, so it stays readable mid-path.
      className="absolute inset-0 flex items-center justify-center"
    >
      <p className="text-muted-foreground font-mono text-[11px] select-none">
        Move your pointer to draw
      </p>
    </GlyphTrail>
  );
}
