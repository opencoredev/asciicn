import { ServerRack } from "@/components/asciicn/server-rack";

// An on-call status card: the rack flags the shelf that raised the page.
export default function ServerRackIncident() {
  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-lg border bg-background font-mono text-xs">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <span className="text-foreground">rack b-07 · u05 nas-01</span>
        <span className="text-[color:var(--ascii-color-orange)]">
          degraded · disk 3 rebuilding
        </span>
      </div>
      <ServerRack
        units={12}
        alert={5}
        activity={0.85}
        cell={11}
        className="relative h-[340px] w-full"
      />
    </div>
  );
}
