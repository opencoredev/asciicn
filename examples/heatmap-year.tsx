import { Heatmap } from "@/components/asciicn/heatmap";

const END = Date.UTC(2026, 9, 12);
const DAY = 86_400_000;

const noise = (n: number) => {
  const x = Math.sin(n * 78.233 + 12.9898) * 43_758.5453;
  return x - Math.floor(x);
};

// Writing sessions in minutes: a seasonal swell, quiet Sundays, a break in August.
const data = Array.from({ length: 371 }, (_, index) => {
  const time = END - index * DAY;
  const date = new Date(time);
  const season = 0.55 + 0.45 * Math.sin((index / 365) * Math.PI * 2 + 1.2);
  const sunday = date.getUTCDay() === 0 ? 0.25 : 1;
  const holiday = date.getUTCMonth() === 7 && date.getUTCDate() < 15 ? 0 : 1;
  const minutes = Math.round(
    Math.max(0, season * sunday * holiday * 140 * noise(index) - 18)
  );
  return { date: date.toISOString().slice(0, 10), value: minutes };
});

const hours = Math.round(data.reduce((sum, day) => sum + day.value, 0) / 60);

export default function HeatmapYear() {
  return (
    <div className="border-border bg-background w-full max-w-3xl border font-mono">
      <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-x-4 border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>writing · {hours.toLocaleString("en")} h this year</span>
        <span>oct 2025 – oct 2026</span>
      </div>
      <div className="p-4 sm:p-5">
        <Heatmap
          data={data}
          weekStart={1}
          glyphs="ascii"
          color="purple"
          unit="min"
        />
      </div>
    </div>
  );
}
