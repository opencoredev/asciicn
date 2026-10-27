import { BarChart } from "@/components/asciicn/bar-chart";

const data = [
  { current: 412_000, previous: 356_000, quarter: "Q1" },
  { current: 468_000, previous: 391_000, quarter: "Q2" },
  { current: 529_000, previous: 447_000, quarter: "Q3" },
  { current: 581_000, previous: 502_000, quarter: "Q4" },
];

export default function BarChartGrouped() {
  return (
    <div className="border-border bg-background w-full max-w-md border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>net revenue · by quarter</span>
        <span className="text-foreground">▲ 16.6%</span>
      </div>
      <div className="p-4">
        <p className="mb-4 text-3xl font-semibold tracking-tight">$1.99M</p>
        <BarChart
          data={data}
          x="quarter"
          highlight="none"
          height={204}
          series={[
            { label: "2026", value: "current" },
            { color: "grey", label: "2025", value: "previous" },
          ]}
          format={{
            currency: "USD",
            maximumFractionDigits: 0,
            notation: "compact",
            style: "currency",
          }}
        />
      </div>
    </div>
  );
}
