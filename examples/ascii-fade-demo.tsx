"use client";

import { AsciiFade } from "@/components/asciicn/ascii-fade";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-fade-controls";

const LOG = Array.from({ length: 40 }, (_, index) => {
  const ms = 12 + ((index * 37) % 180);
  const route = ["/api/render", "/api/frames", "/r/ascii-box.json", "/studio"][
    index % 4
  ];
  return `${String(index).padStart(3, "0")}  GET ${route}  200  ${ms}ms`;
});

export default function AsciiFadeDemo() {
  const side = usePreviewValue(knobs.side);
  const charset = usePreviewValue(knobs.charset);
  const size = usePreviewValue(knobs.size);
  const drift = usePreviewValue(knobs.drift);

  return (
    <div className="relative size-full overflow-hidden bg-[var(--ascii-paper)]">
      <pre className="p-6 font-mono text-[13px] leading-5 text-muted-foreground">
        {LOG.join("\n")}
      </pre>
      <AsciiFade side={side} charset={charset} size={size} drift={drift} />
    </div>
  );
}
