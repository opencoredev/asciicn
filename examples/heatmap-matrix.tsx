import { Heatmap } from "@/components/asciicn/heatmap";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HOURS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0")
);

const noise = (n: number) => {
  const x = Math.sin(n * 39.346 + 11.135) * 24_634.6345;
  return x - Math.floor(x);
};

// Pushes to main by weekday and hour: office hours, a dip at lunch, little on weekends.
const data = DAYS.map((_, day) =>
  HOURS.map((__, hour) => {
    const office = hour >= 9 && hour <= 18 ? 1 : 0.12;
    const lunch = hour === 12 || hour === 13 ? 0.55 : 1;
    const weekend = day >= 5 ? 0.18 : 1;
    const friday = day === 4 && hour >= 15 ? 0.4 : 1;
    return Math.round(
      40 *
        office *
        lunch *
        weekend *
        friday *
        (0.6 + noise(day * 24 + hour) * 0.6)
    );
  })
);

export default function HeatmapMatrix() {
  return (
    <div className="border-border bg-background w-full max-w-2xl border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>pushes to main · weekday × hour utc</span>
        <span>90d</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="text-muted-foreground mb-4 text-xs">
          Office hours, a lunch dip, and Fridays go quiet after 15:00.
        </p>
        <Heatmap
          mode="matrix"
          data={data}
          rows={DAYS}
          columns={HOURS}
          steps={5}
          glyphs="blocks"
          color="orange"
          unit={{ one: "push", other: "pushes" }}
        />
      </div>
    </div>
  );
}
