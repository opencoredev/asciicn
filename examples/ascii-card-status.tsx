import { AsciiCard } from "@/components/asciicn/ascii-card";

const ROWS = [
  { name: "api", state: "healthy", tone: "text-[var(--ascii-color-green)]" },
  { name: "worker", state: "healthy", tone: "text-[var(--ascii-color-green)]" },
  {
    name: "billing",
    state: "degraded",
    tone: "text-[var(--ascii-color-orange)]",
  },
  { name: "search", state: "healthy", tone: "text-[var(--ascii-color-green)]" },
] as const;

export default function AsciiCardStatus() {
  return (
    <AsciiCard
      title="services"
      description="Checked every 30 seconds from 6 regions."
      footer="3/4 ok"
      frame="double"
      shadow="medium"
      className="max-w-sm"
    >
      <ul className="font-mono text-sm">
        {ROWS.map((row) => (
          <li key={row.name} className="flex justify-between gap-4">
            <span>{row.name}</span>
            <span className={row.tone}>{row.state}</span>
          </li>
        ))}
      </ul>
    </AsciiCard>
  );
}
