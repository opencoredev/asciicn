"use client";

import { AsciiCard } from "@/components/asciicn/ascii-card";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-card-controls";

export default function AsciiCardDemo() {
  const frame = usePreviewValue(knobs.frame);
  const glow = usePreviewValue(knobs.glow);
  const glowCharset = usePreviewValue(knobs.glowCharset);
  const color = usePreviewValue(knobs.tint);
  const interactive = usePreviewValue(knobs.interactive);

  return (
    <AsciiCard
      title="edge-runtime"
      footer="▲ 31 regions"
      frame={frame}
      glow={glow}
      glowCharset={glowCharset}
      color={color}
      interactive={interactive}
      className="max-w-md"
    >
      <p className="font-display text-lg font-semibold tracking-tight">
        Cold starts under 40 ms
      </p>
      <p className="mt-2 text-sm text-balance text-muted-foreground">
        Functions boot from a snapshot in the nearest region, so the first
        request feels like the hundredth.
      </p>
      {interactive ? (
        <a
          href="#top"
          className="mt-4 inline-block font-mono text-sm underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Read the benchmark →
        </a>
      ) : null}
    </AsciiCard>
  );
}
