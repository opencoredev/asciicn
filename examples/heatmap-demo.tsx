"use client";

import { Heatmap } from "@/components/asciicn/heatmap";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/heatmap-controls";

const END = Date.UTC(2026, 9, 12);
const DAY = 86_400_000;

/** A repeatable pseudo-random value in [0, 1) for day `n`. */
const noise = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43_758.5453;
  return x - Math.floor(x);
};

// Quieter weekends, a busy stretch before a launch, and a few gaps.
const data = Array.from({ length: 26 * 7 }, (_, index) => {
  const time = END - index * DAY;
  const weekday = new Date(time).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  const launch = index > 20 && index < 45 ? 6 : 0;
  const base = weekend ? 1.2 : 5 + launch;
  const value = Math.max(0, Math.round(base * noise(index) * 2 - 1.5));
  return { date: new Date(time).toISOString().slice(0, 10), value };
});

const total = data.reduce((sum, day) => sum + day.value, 0);

export default function HeatmapDemo() {
  const glyphs = usePreviewValue(knobs.glyphs);
  const color = usePreviewValue(knobs.tint);
  const steps = usePreviewValue(knobs.steps);
  const cell = usePreviewValue(knobs.cell);
  const weekStart = usePreviewValue(knobs.weekStart);
  const animate = usePreviewValue(knobs.animate);

  return (
    <div className="border-border bg-background w-full max-w-2xl border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>deploys · 26 weeks</span>
        <span>3.2/day</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="mb-4 text-3xl font-semibold tracking-tight tabular-nums">
          {total.toLocaleString("en")}
        </p>
        <Heatmap
          data={data}
          weeks={26}
          unit={{ one: "deploy", other: "deploys" }}
          color={color}
          steps={steps}
          glyphs={glyphs}
          cell={cell}
          weekStart={weekStart === "Mon" ? 1 : 0}
          animate={animate}
        />
      </div>
    </div>
  );
}
