import { CartesianChart } from "@/components/asciicn/cartesian-chart";

// Twelve weeks of actual storage use, then a forecast with its interval.
const data = [
  { actual: 412, week: "W1" },
  { actual: 428, week: "W2" },
  { actual: 437, week: "W3" },
  { actual: 455, week: "W4" },
  { actual: 471, week: "W5" },
  { actual: 480, week: "W6" },
  { actual: 503, week: "W7" },
  { actual: 516, week: "W8" },
  { actual: 534, forecast: 534, high: 534, low: 534, week: "W9" },
  { forecast: 552, high: 566, low: 539, week: "W10" },
  { forecast: 571, high: 598, low: 547, week: "W11" },
  { forecast: 590, high: 631, low: 553, week: "W12" },
  { forecast: 611, high: 667, low: 560, week: "W13" },
  { forecast: 632, high: 704, low: 566, week: "W14" },
].map((row) => ({
  actual: row.actual ?? Number.NaN,
  forecast: row.forecast ?? Number.NaN,
  high: row.high ?? Number.NaN,
  low: row.low ?? Number.NaN,
  week: row.week,
}));

export default function CartesianChartForecast() {
  return (
    <div className="border-border bg-background w-full max-w-2xl border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>storage · gib · forecast</span>
        <span>80% interval</span>
      </div>
      <div className="p-4 sm:p-5">
        <CartesianChart
          data={data}
          x="week"
          glyphs="braille"
          zero={false}
          height={228}
          series={[
            { color: "blue", label: "Used", type: "area", value: "actual" },
            {
              color: "purple",
              dashed: true,
              label: "Forecast",
              range: { high: "high", low: "low" },
              type: "line",
              value: "forecast",
            },
          ]}
          format={{ maximumFractionDigits: 0 }}
        />
      </div>
    </div>
  );
}
