"use client";

import { AsciiDonut } from "@/components/asciicn/ascii-donut";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-donut-controls";

export default function AsciiDonutDemo() {
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const surface = usePreviewValue(knobs.surface);
  const thickness = usePreviewValue(knobs.thickness);
  const speed = usePreviewValue(knobs.speed);
  const cell = usePreviewValue(knobs.cell);

  return (
    <AsciiDonut
      charset={charset}
      colorMode={colorMode}
      surface={surface}
      thickness={thickness}
      speed={speed}
      cell={cell}
      className="absolute inset-0"
    />
  );
}
