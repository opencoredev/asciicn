"use client";

import { Starfield } from "@/components/asciicn/starfield";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/starfield-controls";

export default function StarfieldDemo() {
  return (
    <Starfield
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      ink={usePreviewValue(knobs.ink)}
      hazeColor={usePreviewValue(knobs.haze)}
      density={usePreviewValue(knobs.density)}
      twinkle={usePreviewValue(knobs.twinkle)}
      drift={usePreviewValue(knobs.drift)}
      haze={usePreviewValue(knobs.hazeAmount)}
      temperature={usePreviewValue(knobs.temperature)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      animate={usePreviewValue(knobs.animate)}
      className="absolute inset-0"
    />
  );
}
