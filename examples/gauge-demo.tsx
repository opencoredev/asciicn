"use client";

import { Gauge } from "@/components/asciicn/gauge";
import type { GaugeThreshold } from "@/components/asciicn/gauge";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/gauge-controls";

const ZONES = [
  { color: "orange", label: "High", value: 70 },
  { color: "red", label: "Critical", value: 90 },
] as const satisfies readonly GaugeThreshold[];

export default function GaugeDemo() {
  const value = usePreviewValue(knobs.value);
  const variant = usePreviewValue(knobs.variant);
  const indicator = usePreviewValue(knobs.indicator);
  const color = usePreviewValue(knobs.tint);
  const thresholds = usePreviewValue(knobs.thresholds);

  return (
    <Gauge
      value={value}
      label="CPU load"
      unit="%"
      size={variant === "linear" ? 320 : 260}
      variant={variant}
      indicator={indicator}
      color={color}
      thresholds={thresholds ? ZONES : []}
    />
  );
}
