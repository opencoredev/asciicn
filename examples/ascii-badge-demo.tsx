"use client";

import { AsciiBadge } from "@/components/asciicn/ascii-badge";
import type { AsciiBadgeTone } from "@/components/asciicn/ascii-badge";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-badge-controls";

const SERVICES = [
  { badge: "OK", detail: "p95 84 ms", name: "api", tone: "ok" },
  { badge: "RUN", detail: "migrating 3 of 7", name: "worker", tone: "info" },
  { badge: "WARN", detail: "index 2h behind", name: "search", tone: "warn" },
  { badge: "FAIL", detail: "webhook 502", name: "billing", tone: "error" },
] as const satisfies readonly {
  badge: string;
  detail: string;
  name: string;
  tone: AsciiBadgeTone;
}[];

export default function AsciiBadgeDemo() {
  const shape = usePreviewValue(knobs.shape);
  const size = usePreviewValue(knobs.size);
  const dot = usePreviewValue(knobs.dot);
  const aligned = usePreviewValue(knobs.aligned);
  // The live dot and its gap take two cells of the width.
  const width = dot ? 6 : 4;

  return (
    <div className="bg-background border-border flex w-full max-w-md flex-col gap-4 rounded-lg border p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium">acme-prod</span>
        <AsciiBadge shape={shape} size={size} tone="accent">
          beta
        </AsciiBadge>
      </div>
      <ul className="flex flex-col gap-2.5">
        {SERVICES.map((service) => (
          <li key={service.name} className="flex items-center gap-3">
            <AsciiBadge
              shape={shape}
              size={size}
              tone={service.tone}
              dot={dot && service.tone === "info"}
              width={aligned ? width : undefined}
            >
              {service.badge}
            </AsciiBadge>
            <span className="font-mono text-sm">{service.name}</span>
            <span className="text-muted-foreground ml-auto truncate font-mono text-xs">
              {service.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
