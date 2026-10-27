import { BarChart } from "@/components/asciicn/bar-chart";

const data = [
  { region: "us-east-1", requests: 48_210 },
  { region: "eu-west-2", requests: 36_904 },
  { region: "ap-south-1", requests: 21_377 },
  { region: "us-west-2", requests: 18_620 },
  { region: "sa-east-1", requests: 7415 },
  { region: "af-south-1", requests: 2088 },
];

export default function BarChartHorizontal() {
  return (
    <div className="border-border bg-background w-full max-w-xl border font-mono">
      <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase">
        <span>requests by region · 1h</span>
        <span>134.6K</span>
      </div>
      <div className="p-4">
        <BarChart
          data={data}
          x="region"
          orientation="horizontal"
          highlight="none"
          series={[{ color: "blue", label: "Requests", value: "requests" }]}
        />
      </div>
    </div>
  );
}
