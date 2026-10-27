import { LineChart } from "@/components/asciicn/line-chart";

// The benchmark band is the middle half of companies in the same sector.
const data = [
  { high: 41, low: 28, month: "Apr", score: 31 },
  { high: 41, low: 28, month: "May", score: 34 },
  { high: 42, low: 29, month: "Jun", score: 33 },
  { high: 42, low: 29, month: "Jul", score: 39 },
  { high: 43, low: 30, month: "Aug", score: 42 },
  { high: 43, low: 30, month: "Sep", score: 47 },
];

export default function LineChartPoints() {
  return (
    <div className="border-border bg-background w-full max-w-md border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>net promoter score</span>
        <span>6 mo</span>
      </div>
      <div className="p-4">
        <p className="mb-1 text-3xl font-semibold tracking-tight">47</p>
        <p className="text-muted-foreground mb-4 text-xs">
          <span className="text-foreground">+16</span> since April, now above
          the sector band
        </p>
        <LineChart
          data={data}
          x="month"
          glyphs="ascii"
          markers="all"
          curve="linear"
          height={168}
          zero
          series={[
            {
              label: "NPS",
              range: { high: "high", low: "low" },
              value: "score",
            },
          ]}
        />
      </div>
    </div>
  );
}
