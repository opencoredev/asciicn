import { Gauge } from "@/components/asciicn/gauge";
import type { GaugeThreshold } from "@/components/asciicn/gauge";

const QUOTAS = [
  { label: "Build minutes", max: 6000, unit: " min", value: 4210 },
  { label: "Bandwidth", max: 1000, unit: " GB", value: 912 },
  { label: "Edge requests", max: 10, unit: "M", value: 2.4 },
] as const;

const ZONES = [
  { color: "orange", label: "Near limit", value: 0.8 },
  { color: "red", label: "Over 90%", value: 0.9 },
] as const satisfies readonly GaugeThreshold[];

export default function GaugeLinear() {
  return (
    <div className="bg-background border-border flex w-full max-w-md flex-col gap-5 rounded-2xl border p-5">
      <span className="font-medium">Usage this month</span>
      {QUOTAS.map(({ label, max, unit, value }) => (
        <Gauge
          key={label}
          variant="linear"
          label={label}
          value={value}
          max={max}
          unit={unit}
          size={420}
          thresholds={ZONES.map((zone) => ({
            ...zone,
            value: zone.value * max,
          }))}
        />
      ))}
    </div>
  );
}
