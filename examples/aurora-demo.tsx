"use client";

import { Aurora } from "@/components/asciicn/aurora";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/aurora-controls";

export default function AuroraDemo() {
  return (
    <Aurora
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      tipColor={usePreviewValue(knobs.tip)}
      curtains={usePreviewValue(knobs.curtains)}
      height={usePreviewValue(knobs.height)}
      sway={usePreviewValue(knobs.sway)}
      rays={usePreviewValue(knobs.rays)}
      length={usePreviewValue(knobs.length)}
      glow={usePreviewValue(knobs.glow)}
      tilt={usePreviewValue(knobs.tilt)}
      direction={usePreviewValue(knobs.direction)}
      mask={usePreviewValue(knobs.mask)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
