"use client";

import { CartesianChart } from "@/components/asciicn/cartesian-chart";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/cartesian-chart-controls";

// Monthly revenue against plan, with the running margin as a line.
const data = [
  { margin: 18, month: "Jan", plan: 42_000, revenue: 38_400 },
  { margin: 21, month: "Feb", plan: 44_000, revenue: 41_900 },
  { margin: 19, month: "Mar", plan: 46_000, revenue: 47_300 },
  { margin: 24, month: "Apr", plan: 48_000, revenue: 45_800 },
  { margin: 27, month: "May", plan: 50_000, revenue: 52_600 },
  { margin: 26, month: "Jun", plan: 52_000, revenue: 55_100 },
  { margin: 29, month: "Jul", plan: 54_000, revenue: 51_700 },
  { margin: 31, month: "Aug", plan: 56_000, revenue: 58_900 },
  { margin: 33, month: "Sep", plan: 58_000, revenue: 63_400 },
  { margin: 32, month: "Oct", plan: 60_000, revenue: 61_200 },
  { margin: 35, month: "Nov", plan: 62_000, revenue: 67_800 },
  { margin: 37, month: "Dec", plan: 64_000, revenue: 72_500 },
];

export default function CartesianChartDemo() {
  const glyphs = usePreviewValue(knobs.glyphs);
  const fill = usePreviewValue(knobs.fill);
  const curve = usePreviewValue(knobs.curve);
  const cell = usePreviewValue(knobs.cell);
  const grid = usePreviewValue(knobs.grid);
  const interactive = usePreviewValue(knobs.interactive);

  return (
    <div className="border-border bg-background w-full max-w-2xl border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>revenue vs plan · 2026</span>
        <span className="text-foreground">$656.6K</span>
      </div>
      <div className="p-4 sm:p-5">
        <CartesianChart
          data={data}
          x="month"
          series={[
            { label: "Revenue", type: "bar", value: "revenue" },
            {
              color: "orange",
              dashed: true,
              label: "Plan",
              type: "line",
              value: "plan",
            },
          ]}
          glyphs={glyphs}
          fill={fill}
          curve={curve}
          cell={cell}
          grid={grid}
          interactive={interactive}
          height={264}
          format={{
            currency: "USD",
            maximumFractionDigits: 1,
            notation: "compact",
            style: "currency",
          }}
        />
      </div>
    </div>
  );
}
