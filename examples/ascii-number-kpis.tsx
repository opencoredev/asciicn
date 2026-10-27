import { AsciiBox } from "@/components/asciicn/ascii-box";
import { AsciiNumber } from "@/components/asciicn/ascii-number";

const STATS = [
  {
    color: "green",
    format: { maximumFractionDigits: 2, minimumFractionDigits: 2 },
    label: "uptime",
    suffix: "%",
    value: 99.98,
  },
  { color: "blue", format: {}, label: "p95", suffix: "ms", value: 182 },
  {
    color: "orange",
    format: { compactDisplay: "short", notation: "compact" },
    label: "events",
    suffix: "",
    value: 2_400_000,
  },
] as const;

export default function AsciiNumberKpis() {
  return (
    <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
      {STATS.map((stat) => (
        <AsciiBox key={stat.label} title={stat.label} className="w-full">
          <AsciiNumber
            value={stat.value}
            suffix={stat.suffix}
            format={stat.format}
            font="half"
            color={stat.color}
            cell={14}
          />
        </AsciiBox>
      ))}
    </div>
  );
}
