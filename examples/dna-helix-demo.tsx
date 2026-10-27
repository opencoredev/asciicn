"use client";

import { DnaHelix } from "@/components/asciicn/dna-helix";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/dna-helix-controls";

export default function DnaHelixDemo() {
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const orientation = usePreviewValue(knobs.orientation);
  const speed = usePreviewValue(knobs.speed);
  const twist = usePreviewValue(knobs.twist);
  const rungs = usePreviewValue(knobs.rungs);
  const cell = usePreviewValue(knobs.cell);

  return (
    <DnaHelix
      charset={charset}
      colorMode={colorMode}
      orientation={orientation}
      speed={speed}
      twist={twist}
      rungs={rungs}
      cell={cell}
      className="absolute inset-0"
    />
  );
}
