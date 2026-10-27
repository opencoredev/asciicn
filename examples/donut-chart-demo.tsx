"use client";

import { DonutChart } from "@/components/asciicn/donut-chart";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/donut-chart-controls";

const REGIONS = [
  { label: "North America", value: 48_210 },
  { label: "Europe", value: 31_870 },
  { label: "Asia Pacific", value: 17_430 },
  { label: "South America", value: 6340 },
  { label: "Africa", value: 2150 },
] as const;

export default function DonutChartDemo() {
  const mode = usePreviewValue(knobs.mode);
  const glyphs = usePreviewValue(knobs.glyphs);
  const cell = usePreviewValue(knobs.cell);
  const first = usePreviewValue(knobs.firstColor);
  const gap = usePreviewValue(knobs.gap);
  const animate = usePreviewValue(knobs.animate);

  return (
    <DonutChart
      data={REGIONS}
      label="Requests today"
      mode={mode}
      glyphs={glyphs}
      cell={cell}
      colors={[first, "orange", "green", "pink", "grey"]}
      gap={gap}
      animate={animate}
      size={240}
    />
  );
}
