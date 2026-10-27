"use client";

import { TempestStormScene } from "@/components/asciicn/scenes/tempest-storm-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/tempest-storm-scene-controls";
import { CRT_FX } from "@/lib/ascii";

export default function TempestStormSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const ramp = usePreviewValue(knobs.ramp);
  const crt = usePreviewValue(knobs.crt);
  return (
    <TempestStormScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={ramp}
      fx={crt ? CRT_FX : undefined}
      strikes={usePreviewValue(knobs.strikes)}
      flash={usePreviewValue(knobs.flash)}
      rain={usePreviewValue(knobs.rain)}
      wind={usePreviewValue(knobs.wind)}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
