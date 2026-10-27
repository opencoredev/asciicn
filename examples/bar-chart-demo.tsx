"use client";

import { BarChart } from "@/components/asciicn/bar-chart";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/bar-chart-controls";

const data = [
  { deploys: 38, week: "W27" },
  { deploys: 44, week: "W28" },
  { deploys: 41, week: "W29" },
  { deploys: 52, week: "W30" },
  { deploys: 47, week: "W31" },
  { deploys: 58, week: "W32" },
  { deploys: 55, week: "W33" },
  { deploys: 63, week: "W34" },
  { deploys: 49, week: "W35" },
  { deploys: 61, week: "W36" },
  { deploys: 68, week: "W37" },
  { deploys: 74, week: "W38" },
];

export default function BarChartDemo() {
  const glyphs = usePreviewValue(knobs.glyphs);
  const orientation = usePreviewValue(knobs.orientation);
  const fill = usePreviewValue(knobs.fill);
  const color = usePreviewValue(knobs.tint);
  const highlight = usePreviewValue(knobs.highlight);
  const cell = usePreviewValue(knobs.cell);
  const interactive = usePreviewValue(knobs.interactive);

  return (
    <div className="border-border bg-background w-full max-w-2xl border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>deploys · production</span>
        <span className="text-foreground">▲ 8.8%</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="mb-4 text-3xl font-semibold tracking-tight tabular-nums">
          74
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            this week
          </span>
        </p>
        <BarChart
          data={data}
          x="week"
          series={[{ color, label: "Deploys", value: "deploys" }]}
          glyphs={glyphs}
          orientation={orientation}
          fill={fill}
          highlight={highlight}
          cell={cell}
          interactive={interactive}
          height={252}
        />
      </div>
    </div>
  );
}
