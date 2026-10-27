"use client";

import { CoastalLighthouseScene } from "@/components/asciicn/scenes/coastal-lighthouse-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/coastal-lighthouse-scene-controls";
import { CRT_FX } from "@/lib/ascii";

export default function CoastalLighthouseSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);
  return (
    <CoastalLighthouseScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      fx={crt ? CRT_FX : undefined}
      beamSpeed={usePreviewValue(knobs.beamSpeed)}
      swell={usePreviewValue(knobs.swell)}
      storm={usePreviewValue(knobs.storm)}
      fog={usePreviewValue(knobs.fog)}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
