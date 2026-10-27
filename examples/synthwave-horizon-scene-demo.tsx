"use client";

import { SynthwaveHorizonScene } from "@/components/asciicn/scenes/synthwave-horizon-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/synthwave-horizon-scene-controls";
import { CRT_FX } from "@/lib/ascii";

export default function SynthwaveHorizonSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);
  return (
    <SynthwaveHorizonScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      fx={crt ? CRT_FX : undefined}
      travel={usePreviewValue(knobs.travel)}
      mountains={usePreviewValue(knobs.mountains)}
      sunBands={usePreviewValue(knobs.sunBands)}
      shimmer={usePreviewValue(knobs.shimmer)}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
