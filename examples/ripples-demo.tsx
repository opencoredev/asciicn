"use client";

import { Ripples } from "@/components/asciicn/ripples";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ripples-controls";

export default function RipplesDemo() {
  return (
    <Ripples
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      secondColor={usePreviewValue(knobs.second)}
      rings={usePreviewValue(knobs.rings)}
      decay={usePreviewValue(knobs.decay)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
