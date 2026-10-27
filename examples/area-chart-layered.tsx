import { AreaChart } from "@/components/asciicn/area-chart";

const HOURS = [
  [212, 58],
  [188, 61],
  [164, 49],
  [151, 44],
  [149, 47],
  [176, 52],
  [248, 71],
  [341, 96],
  [422, 118],
  [468, 131],
  [489, 127],
  [502, 140],
  [497, 138],
  [511, 151],
  [488, 133],
  [463, 129],
  [452, 121],
  [431, 117],
  [398, 109],
  [366, 97],
  [344, 92],
  [318, 84],
  [276, 73],
  [241, 66],
] as const;

const data = HOURS.map(([cached, origin], hour) => ({
  cached,
  hour: `${String(hour).padStart(2, "0")}:00`,
  origin,
}));

export default function AreaChartLayered() {
  return (
    <div className="border-border bg-background w-full max-w-2xl border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>edge · requests/s</span>
        <span>24h</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="mb-4 text-sm">
          <span className="text-2xl font-semibold tracking-tight">78%</span>{" "}
          <span className="text-muted-foreground">served from cache</span>
        </p>
        <AreaChart
          data={data}
          x="hour"
          stack="stacked"
          fill="pattern"
          series={[
            { label: "Cached", value: "cached" },
            { color: "orange", label: "Origin", value: "origin" },
          ]}
          height={228}
        />
      </div>
    </div>
  );
}
