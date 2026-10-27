"use client";

import { MatrixCathedralScene } from "@/components/asciicn/scenes/matrix-cathedral-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/matrix-cathedral-scene-controls";

export default function MatrixCathedralSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const crt = usePreviewValue(knobs.crt);

  return (
    <MatrixCathedralScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      glide={usePreviewValue(knobs.glide)}
      density={usePreviewValue(knobs.density)}
      fog={usePreviewValue(knobs.fog)}
      light={usePreviewValue(knobs.light)}
      fx={crt ? undefined : {}}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
