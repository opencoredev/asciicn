"use client";

import { CampfireWoodsScene } from "@/components/asciicn/scenes/campfire-woods-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/campfire-woods-scene-controls";
import { CRT_FX } from "@/lib/ascii";

export default function CampfireWoodsSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const ramp = usePreviewValue(knobs.ramp);
  const crt = usePreviewValue(knobs.crt);
  return (
    <CampfireWoodsScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={ramp}
      fx={crt ? CRT_FX : undefined}
      flame={usePreviewValue(knobs.flame)}
      sparks={usePreviewValue(knobs.sparks)}
      smoke={usePreviewValue(knobs.smoke)}
      fireflies={usePreviewValue(knobs.fireflies)}
      stars={usePreviewValue(knobs.stars)}
      breeze={usePreviewValue(knobs.breeze)}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
