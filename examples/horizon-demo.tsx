"use client";

import { Horizon } from "@/components/asciicn/horizon";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/horizon-controls";

export default function HorizonDemo() {
  return (
    <Horizon
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      hazeColor={usePreviewValue(knobs.haze)}
      horizon={usePreviewValue(knobs.horizon)}
      curve={usePreviewValue(knobs.curve)}
      glow={usePreviewValue(knobs.glow)}
      aurora={usePreviewValue(knobs.aurora)}
      stars={usePreviewValue(knobs.stars)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
