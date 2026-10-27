"use client";

import { StatusDot } from "@/components/asciicn/status-dot";
import type { StatusDotState } from "@/components/asciicn/status-dot";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/status-dot-controls";

const TEAM = [
  { name: "Ada", role: "Engine", status: "busy" },
  { name: "Grace", role: "Docs", status: "online" },
  { name: "Linus", role: "Studio", status: "offline" },
] as const satisfies readonly {
  name: string;
  role: string;
  status: StatusDotState;
}[];

export default function StatusDotDemo() {
  const status = usePreviewValue(knobs.status);
  const variant = usePreviewValue(knobs.variant);
  const size = usePreviewValue(knobs.size);
  const animate = usePreviewValue(knobs.animate);
  const people = [{ name: "You", role: "Design", status }, ...TEAM];

  return (
    <ul className="bg-background border-border flex w-full max-w-xs flex-col gap-3 rounded-lg border p-5">
      {people.map((person) => (
        <li
          key={person.name}
          className="flex items-center justify-between gap-4"
        >
          <span className="flex flex-col">
            <span className="text-sm font-medium">{person.name}</span>
            <span className="text-muted-foreground text-xs">{person.role}</span>
          </span>
          <StatusDot
            status={person.status}
            variant={variant}
            size={size}
            animate={animate}
          />
        </li>
      ))}
    </ul>
  );
}
