"use client";

import { GlitchText } from "@/components/asciicn/glitch-text";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/glitch-text-controls";

export default function GlitchTextDemo() {
  const glyphs = usePreviewValue(knobs.glyphs);
  const trigger = usePreviewValue(knobs.trigger);
  const intensity = usePreviewValue(knobs.intensity);
  const interval = usePreviewValue(knobs.interval);

  return (
    <div className="flex max-w-2xl flex-col items-center gap-3 text-center">
      <GlitchText
        as="h3"
        glyphs={glyphs}
        trigger={trigger}
        intensity={intensity / 100}
        interval={interval}
        className="font-display text-4xl font-bold tracking-tight text-balance sm:text-6xl"
      >
        Signal lost
      </GlitchText>
      <GlitchText
        as="p"
        glyphs={glyphs}
        trigger={trigger}
        intensity={intensity / 100}
        interval={interval * 1.4}
        className="font-mono text-sm text-muted-foreground"
      >
        carrier dropped at 03:14:07 · retrying on channel 9
      </GlitchText>
    </div>
  );
}
