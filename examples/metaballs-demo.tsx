"use client";

import { Metaballs } from "@/components/asciicn/metaballs";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/metaballs-controls";

export default function MetaballsDemo() {
  const ink = usePreviewValue(knobs.ink);
  return (
    <Metaballs
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      colors={[ink]}
      variant={usePreviewValue(knobs.variant)}
      count={usePreviewValue(knobs.count)}
      size={usePreviewValue(knobs.size)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
