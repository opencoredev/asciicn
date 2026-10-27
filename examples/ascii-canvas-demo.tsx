"use client";

import { AsciiCanvas } from "@/components/asciicn/ascii-canvas";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-canvas-controls";

export default function AsciiCanvasDemo() {
  const charset = usePreviewValue(knobs.charset);
  const inks = knobs.INKS[usePreviewValue(knobs.inks)];
  const brushSize = usePreviewValue(knobs.brushSize);
  const decay = usePreviewValue(knobs.decay);
  const cell = usePreviewValue(knobs.cell);
  const ripples = usePreviewValue(knobs.ripples);
  const idle = usePreviewValue(knobs.idle);

  return (
    <AsciiCanvas
      charset={charset}
      inks={inks}
      brushSize={brushSize}
      decay={decay}
      cell={cell}
      ripples={ripples}
      idle={idle}
      className="size-full min-h-80"
    />
  );
}
