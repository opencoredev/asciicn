import { AsciiBadge } from "@/components/asciicn/ascii-badge";
import type { AsciiBadgeTone } from "@/components/asciicn/ascii-badge";

const LOG = [
  { badge: "OK", text: "Mounted /data", tone: "ok" },
  { badge: "OK", text: "Started glyph atlas cache", tone: "ok" },
  { badge: "OK", text: "Reached target network", tone: "ok" },
  { badge: "WARN", text: "Clock drift 212 ms, resyncing", tone: "warn" },
  { badge: "FAIL", text: "Failed to start metrics exporter", tone: "error" },
  { badge: "OK", text: "Started web server on :3000", tone: "ok" },
] as const satisfies readonly {
  badge: string;
  text: string;
  tone: AsciiBadgeTone;
}[];

export default function AsciiBadgeBoot() {
  return (
    <ol className="flex w-full max-w-md flex-col gap-1 font-mono text-[13px]">
      {LOG.map((line) => (
        <li key={line.text} className="flex items-baseline gap-[1ch]">
          <AsciiBadge tone={line.tone} width={6}>
            {line.badge}
          </AsciiBadge>
          <span
            className={
              line.tone === "error"
                ? "text-foreground"
                : "text-muted-foreground"
            }
          >
            {line.text}
          </span>
        </li>
      ))}
    </ol>
  );
}
