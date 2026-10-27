"use client";

import { FluidSmokeScene } from "@/components/asciicn/scenes/fluid-smoke-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/fluid-smoke-scene-controls";

export default function FluidSmokeSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);

  return (
    <FluidSmokeScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      buoyancy={usePreviewValue(knobs.buoyancy)}
      swirl={usePreviewValue(knobs.swirl)}
      fade={usePreviewValue(knobs.fade)}
      emitter={usePreviewValue(knobs.emitter)}
      fx={crt ? undefined : {}}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
