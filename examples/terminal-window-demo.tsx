"use client";

import { TerminalWindow } from "@/components/asciicn/terminal-window";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/terminal-window-controls";

export default function TerminalWindowDemo() {
  const speed = usePreviewValue(knobs.speed);
  const loop = usePreviewValue(knobs.loop);
  const frame = usePreviewValue(knobs.frame);
  const size = usePreviewValue(knobs.size);
  const color = usePreviewValue(knobs.tint);

  return (
    <TerminalWindow
      speed={speed}
      loop={loop}
      frame={frame}
      size={size}
      color={color}
      className="max-w-2xl"
    />
  );
}
