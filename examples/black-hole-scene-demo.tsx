"use client";

import { BlackHoleScene } from "@/components/asciicn/scenes/black-hole-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/black-hole-scene-controls";
import { CRT_FX } from "@/lib/ascii";

export default function BlackHoleSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);
  return (
    <BlackHoleScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      fx={crt ? CRT_FX : undefined}
      tilt={usePreviewValue(knobs.tilt)}
      spin={usePreviewValue(knobs.spin)}
      doppler={usePreviewValue(knobs.doppler)}
      stars={usePreviewValue(knobs.stars)}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
