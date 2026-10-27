"use client";

import { SynthwaveSun } from "@/components/asciicn/synthwave-sun";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/synthwave-sun-controls";

export default function SynthwaveSunDemo() {
  const phosphor = usePreviewValue(knobs.phosphor);
  return (
    <SynthwaveSun
      charset={usePreviewValue(knobs.charset)}
      colorMode={usePreviewValue(knobs.colorMode)}
      phosphor={phosphor === "none" ? undefined : phosphor}
      ramp={usePreviewValue(knobs.ramp)}
      travel={usePreviewValue(knobs.travel)}
      slices={usePreviewValue(knobs.slices)}
      glow={usePreviewValue(knobs.glow)}
      mountains={usePreviewValue(knobs.mountains)}
      stars={usePreviewValue(knobs.stars)}
      interactive={usePreviewValue(knobs.interactive)}
      interaction={usePreviewValue(knobs.interaction)}
      cell={usePreviewValue(knobs.cell)}
      className="absolute inset-0"
    />
  );
}
