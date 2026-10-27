"use client";

import { CircuitBloomScene } from "@/components/asciicn/scenes/circuit-bloom-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/circuit-bloom-scene-controls";

export default function CircuitBloomSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);

  return (
    <CircuitBloomScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      board={usePreviewValue(knobs.board)}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      growth={usePreviewValue(knobs.growth)}
      traffic={usePreviewValue(knobs.traffic)}
      density={usePreviewValue(knobs.density)}
      fx={crt ? undefined : {}}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
