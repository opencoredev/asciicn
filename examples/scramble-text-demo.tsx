"use client";

import { ScrambleText } from "@/components/asciicn/scramble-text";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/scramble-text-controls";

export default function ScrambleTextDemo() {
  const glyphs = usePreviewValue(knobs.glyphs);
  const trigger = usePreviewValue(knobs.trigger);
  const color = usePreviewValue(knobs.tint);
  const stagger = usePreviewValue(knobs.stagger);

  return (
    <div className="flex max-w-xl flex-col items-center gap-3 text-center">
      <ScrambleText
        as="h3"
        glyphs={glyphs}
        trigger={trigger}
        color={color}
        stagger={stagger / 1000}
        className="font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl"
      >
        Decrypting the signal
      </ScrambleText>
      <ScrambleText
        as="p"
        glyphs={glyphs}
        trigger={trigger}
        color={color}
        stagger={stagger / 2000}
        delay={0.2}
        className="font-mono text-sm text-muted-foreground"
      >
        handshake ok · 2048-bit · 14 ms
      </ScrambleText>
    </div>
  );
}
