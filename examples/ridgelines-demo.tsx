"use client";

import { Ridgelines } from "@/components/asciicn/ridgelines";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ridgelines-controls";

export default function RidgelinesDemo() {
  return (
    <Ridgelines
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      farColor={usePreviewValue(knobs.far)}
      lines={usePreviewValue(knobs.lines)}
      amplitude={usePreviewValue(knobs.amplitude)}
      spread={usePreviewValue(knobs.spread)}
      shade={usePreviewValue(knobs.shade)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
