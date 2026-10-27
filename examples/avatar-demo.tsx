"use client";

import { Avatar } from "@/components/asciicn/avatar";
import type { AvatarStatus } from "@/components/asciicn/avatar";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/avatar-controls";

const SIZES = ["sm", "md", "lg", "xl"] as const;

export default function AvatarDemo() {
  const source = usePreviewValue(knobs.source);
  const name = usePreviewValue(knobs.name);
  const charset = usePreviewValue(knobs.charset);
  const fromName = usePreviewValue(knobs.fromName);
  const tint = usePreviewValue(knobs.tint);
  const status = usePreviewValue(knobs.status);
  const shape = usePreviewValue(knobs.shape);
  const presence: AvatarStatus | undefined =
    status === "none" ? undefined : status;
  const photo = source === "photo";

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-end gap-5">
        {SIZES.map((size) => (
          <Avatar
            key={size}
            name={photo ? "Buzz Aldrin" : name}
            src={photo ? "/examples/aldrin.jpg" : undefined}
            size={size}
            charset={charset}
            color={fromName ? undefined : tint}
            status={presence}
            shape={shape}
          />
        ))}
      </div>
      <span className="text-muted-foreground font-mono text-xs">
        {photo ? "aldrin.jpg" : name} · {charset}
      </span>
    </div>
  );
}
