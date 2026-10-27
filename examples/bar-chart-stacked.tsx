import { BarChart } from "@/components/asciicn/bar-chart";

const data = [
  { day: "Mon", paid: 182, trial: 96 },
  { day: "Tue", paid: 204, trial: 118 },
  { day: "Wed", paid: 231, trial: 104 },
  { day: "Thu", paid: 219, trial: 131 },
  { day: "Fri", paid: 256, trial: 142 },
  { day: "Sat", paid: 141, trial: 77 },
  { day: "Sun", paid: 128, trial: 69 },
];

export default function BarChartStacked() {
  return (
    <div className="border-border bg-background w-full max-w-2xl border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>signups · this week</span>
        <span>2,098</span>
      </div>
      <div className="p-4 sm:p-5">
        <BarChart
          data={data}
          x="day"
          layout="stacked"
          highlight="max"
          series={[
            { label: "Paid", value: "paid" },
            { color: "orange", label: "Trial", value: "trial" },
          ]}
          format={{ maximumFractionDigits: 0 }}
        />
      </div>
    </div>
  );
}
