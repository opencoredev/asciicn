import { LineChart } from "@/components/asciicn/line-chart";

const data = [
  { day: "Mon", lastWeek: 1240, thisWeek: 1310 },
  { day: "Tue", lastWeek: 1380, thisWeek: 1520 },
  { day: "Wed", lastWeek: 1410, thisWeek: 1490 },
  { day: "Thu", lastWeek: 1350, thisWeek: 1640 },
  { day: "Fri", lastWeek: 1520, thisWeek: 1810 },
  { day: "Sat", lastWeek: 980, thisWeek: 1160 },
  { day: "Sun", lastWeek: 910, thisWeek: 1090 },
];

export default function LineChartCompare() {
  return (
    <div className="border-border bg-background w-full max-w-2xl border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>checkouts · this week vs last</span>
        <span className="text-foreground">▲ 13.4%</span>
      </div>
      <div className="p-4 sm:p-5">
        <LineChart
          data={data}
          x="day"
          height={216}
          markers="all"
          series={[
            { color: "green", label: "This week", value: "thisWeek" },
            {
              color: "grey",
              dashed: true,
              label: "Last week",
              value: "lastWeek",
            },
          ]}
          format={{ maximumFractionDigits: 0 }}
        />
      </div>
    </div>
  );
}
