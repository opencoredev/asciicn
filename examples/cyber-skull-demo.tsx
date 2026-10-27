"use client";

import { CyberSkull } from "@/components/asciicn/cyber-skull";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/cyber-skull-controls";

export default function CyberSkullDemo() {
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const shading = usePreviewValue(knobs.shading);
  const surface = usePreviewValue(knobs.surface);
  const speed = usePreviewValue(knobs.speed);
  const jaw = usePreviewValue(knobs.jaw);
  const scan = usePreviewValue(knobs.scan);
  const cell = usePreviewValue(knobs.cell);

  return (
    <CyberSkull
      charset={charset}
      colorMode={colorMode}
      shading={shading}
      surface={surface}
      speed={speed}
      jaw={jaw}
      scan={scan}
      cell={cell}
      className="absolute inset-0"
    />
  );
}
