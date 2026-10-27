"use client";

import { Sparkline } from "@/components/asciicn/sparkline";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/sparkline-controls";

// Thirty days of signups with a mid-month launch spike.
const SIGNUPS = [
  212, 224, 219, 231, 228, 240, 236, 251, 247, 262, 258, 271, 266, 412, 538,
  471, 402, 371, 352, 344, 338, 351, 347, 362, 358, 371, 366, 384, 379, 396,
];

export default function SparklineDemo() {
  const glyphs = usePreviewValue(knobs.glyphs);
  const rows = usePreviewValue(knobs.rows);
  const color = usePreviewValue(knobs.tint);
  const fill = usePreviewValue(knobs.fill);
  const interactive = usePreviewValue(knobs.interactive);

  return (
    <div className="border-border bg-background w-full max-w-sm border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>signups · 30d</span>
        <span className="text-foreground">▲ 87%</span>
      </div>
      <div className="flex items-end justify-between gap-4 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            396
          </span>
          <span className="text-muted-foreground text-xs">today</span>
        </div>
        <Sparkline
          data={SIGNUPS}
          label="Daily signups, last 30 days"
          glyphs={glyphs}
          rows={rows}
          color={color}
          fill={fill}
          interactive={interactive}
          className="text-base"
        />
      </div>
    </div>
  );
}
