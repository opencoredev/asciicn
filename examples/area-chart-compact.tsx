import { AreaChart } from "@/components/asciicn/area-chart";

const USERS = [
  6.1, 6.6, 6.4, 7.3, 7.9, 7.6, 8.8, 9.4, 9.1, 10.2, 10.9, 11.5, 11.3, 12.4,
];

const data = USERS.map((value, index) => ({
  users: value * 1000,
  week: `Week ${String(index + 27)}`,
}));

export default function AreaChartCompact() {
  return (
    <div className="border-border bg-background flex w-full max-w-xs flex-col overflow-hidden border font-mono">
      <div className="flex flex-col gap-1 p-4 pb-3">
        <span className="text-muted-foreground text-[11px] tracking-[0.08em] uppercase">
          weekly active users
        </span>
        <span className="text-3xl font-semibold tracking-tight">12.4K</span>
        <span className="text-muted-foreground text-xs">
          <span className="text-foreground">▲ 8.1%</span> on last week
        </span>
      </div>
      <AreaChart
        data={data}
        x="week"
        series={[{ color: "green", label: "Active users", value: "users" }]}
        glyphs="braille"
        axes={false}
        grid={false}
        curve="linear"
        height={84}
      />
    </div>
  );
}
