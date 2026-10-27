import { Gauge } from "@/components/asciicn/gauge";
import type { GaugeThreshold } from "@/components/asciicn/gauge";

const HOSTS = [
  { label: "CPU", value: 42 },
  { label: "Memory", value: 77 },
  { label: "Disk", value: 93 },
] as const;

const ZONES = [
  { color: "orange", label: "High", value: 75 },
  { color: "red", label: "Full", value: 90 },
] as const satisfies readonly GaugeThreshold[];

export default function GaugeDial() {
  return (
    <div className="bg-background border-border w-full max-w-xl rounded-2xl border p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-medium">db-primary-01</span>
        <span className="text-muted-foreground font-mono text-xs">
          eu-west-1
        </span>
      </div>
      <div className="mt-6 flex flex-wrap justify-around gap-6">
        {HOSTS.map(({ label, value }) => (
          <Gauge
            key={label}
            variant="dial"
            indicator="needle"
            value={value}
            label={label}
            unit="%"
            size={150}
            cell={10}
            color="blue"
            thresholds={ZONES}
          />
        ))}
      </div>
    </div>
  );
}
