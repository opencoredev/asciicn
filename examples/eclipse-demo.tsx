"use client";

import { Eclipse } from "@/components/asciicn/eclipse";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/eclipse-controls";

export default function EclipseDemo() {
  return (
    <Eclipse
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      size={usePreviewValue(knobs.size)}
      corona={usePreviewValue(knobs.corona)}
      streamers={usePreviewValue(knobs.streamers)}
      light={usePreviewValue(knobs.light)}
      pulse={usePreviewValue(knobs.pulse)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
