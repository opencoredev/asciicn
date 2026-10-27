"use client";

import { useEffect, useState } from "react";

import { StatusDot } from "@/components/asciicn/status-dot";
import type { StatusDotState } from "@/components/asciicn/status-dot";

// A deploy walking through its states, so each glyph and change shows.
const STAGES = [
  { label: "Building", status: "busy" },
  { label: "Health check failed", status: "error" },
  { label: "Rebuilding", status: "busy" },
  { label: "Live", status: "online" },
  { label: "Scaled to zero", status: "offline" },
] as const satisfies readonly { label: string; status: StatusDotState }[];

export default function StatusDotLive() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setStage((value) => (value + 1) % STAGES.length),
      2200
    );
    return () => window.clearInterval(timer);
  }, []);
  const current = STAGES[stage] ?? STAGES[0];

  return (
    <div className="bg-background border-border flex w-full max-w-xs items-center justify-between gap-4 rounded-lg border px-4 py-3">
      <span className="flex flex-col">
        <span className="text-sm font-medium">preview-4f2a1c9</span>
        <span className="text-muted-foreground font-mono text-xs">
          acme-web.dev
        </span>
      </span>
      <StatusDot status={current.status} label={current.label} size="lg" />
    </div>
  );
}
