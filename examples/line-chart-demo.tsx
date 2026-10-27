"use client";

import { LineChart } from "@/components/asciicn/line-chart";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/line-chart-controls";

const P50 = [
  188, 184, 191, 186, 179, 182, 196, 214, 205, 193, 187, 181, 178, 183, 190,
  186, 181, 177, 180, 184, 182,
];
const SPREAD = [
  31, 29, 34, 30, 27, 28, 41, 63, 52, 38, 32, 29, 27, 30, 33, 31, 28, 26, 27,
  30, 28,
];

const data = P50.map((p50, index) => {
  const spread = SPREAD[index] ?? 30;
  return {
    p10: p50 - spread * 0.7,
    p50,
    p90: p50 + spread * 1.6,
    time: `${String(12 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "00" : "30"}`,
  };
});

export default function LineChartDemo() {
  const glyphs = usePreviewValue(knobs.glyphs);
  const color = usePreviewValue(knobs.tint);
  const markers = usePreviewValue(knobs.markers);
  const curve = usePreviewValue(knobs.curve);
  const cell = usePreviewValue(knobs.cell);
  const glow = usePreviewValue(knobs.glow);
  const interactive = usePreviewValue(knobs.interactive);

  return (
    <div className="border-border bg-background w-full max-w-2xl border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>api · latency p50</span>
        <span>band p10–p90</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="mb-4 text-3xl font-semibold tracking-tight tabular-nums">
          182
          <span className="text-muted-foreground ml-1 text-sm font-normal">
            ms
          </span>
        </p>
        <LineChart
          data={data}
          x="time"
          series={[
            {
              color,
              label: "p50",
              range: { high: "p90", low: "p10" },
              value: "p50",
            },
          ]}
          glyphs={glyphs}
          markers={markers}
          curve={curve}
          cell={cell}
          glow={glow}
          interactive={interactive}
          height={252}
          format={{
            maximumFractionDigits: 0,
            style: "unit",
            unit: "millisecond",
            unitDisplay: "narrow",
          }}
        />
      </div>
    </div>
  );
}
