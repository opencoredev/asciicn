"use client";

import { AreaChart } from "@/components/asciicn/area-chart";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/area-chart-controls";

// Thirty days of visitors: a steady climb with a weekly rhythm.
const data = Array.from({ length: 30 }, (_, index) => {
  const week = Math.sin((index / 7) * Math.PI * 2);
  return {
    day: `Sep ${String(index + 1)}`,
    direct: Math.round(190 + index * 6.8 + week * 14),
    search: Math.round(
      410 + index * 15.4 + week * 38 + Math.sin(index / 4) * 22
    ),
  };
});

export default function AreaChartDemo() {
  const glyphs = usePreviewValue(knobs.glyphs);
  const stack = usePreviewValue(knobs.stack);
  const fill = usePreviewValue(knobs.fill);
  const color = usePreviewValue(knobs.firstColor);
  const cell = usePreviewValue(knobs.cell);
  const glow = usePreviewValue(knobs.glow);
  const interactive = usePreviewValue(knobs.interactive);

  return (
    <div className="border-border bg-background w-full max-w-2xl border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>visitors · september</span>
        <span>30d</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            1,258
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              today
            </span>
          </span>
          <span className="text-muted-foreground text-xs">
            <span className="text-foreground">▲ 109%</span> since Sep 1
          </span>
        </div>
        <AreaChart
          data={data}
          x="day"
          series={[
            { color, label: "Search", value: "search" },
            { label: "Direct", value: "direct" },
          ]}
          glyphs={glyphs}
          stack={stack}
          fill={fill}
          cell={cell}
          glow={glow}
          interactive={interactive}
          height={264}
        />
      </div>
    </div>
  );
}
