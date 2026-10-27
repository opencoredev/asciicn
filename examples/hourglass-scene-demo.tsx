"use client";

import { HourglassScene } from "@/components/asciicn/scenes/hourglass-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/hourglass-scene-controls";

export default function HourglassSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);

  return (
    <HourglassScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      finish={usePreviewValue(knobs.finish)}
      duration={usePreviewValue(knobs.duration)}
      fill={usePreviewValue(knobs.fill)}
      tilt={usePreviewValue(knobs.tilt)}
      fx={crt ? undefined : {}}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
