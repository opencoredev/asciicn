"use client";

import { Beams } from "@/components/asciicn/beams";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/beams-controls";

export default function BeamsDemo() {
  return (
    <Beams
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      farColor={usePreviewValue(knobs.far)}
      rays={usePreviewValue(knobs.rays)}
      spread={usePreviewValue(knobs.spread)}
      sweep={usePreviewValue(knobs.sweep)}
      reach={usePreviewValue(knobs.reach)}
      dust={usePreviewValue(knobs.dust)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
