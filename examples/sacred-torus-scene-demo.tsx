"use client";

import { SacredTorusScene } from "@/components/asciicn/scenes/sacred-torus-scene";
import type { KnotType } from "@/components/asciicn/scenes/sacred-torus-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/sacred-torus-scene-controls";

const KNOTS = {
  "2:3": [[2, 3]],
  "2:7": [[2, 7]],
  "3:4": [[3, 4]],
  "3:5": [[3, 5]],
  "5:2": [[5, 2]],
} as const satisfies Record<string, readonly KnotType[]>;

export default function SacredTorusSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const knot = usePreviewValue(knobs.knot);
  const crt = usePreviewValue(knobs.crt);

  return (
    <SacredTorusScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={usePreviewValue(knobs.ramp)}
      knots={knot === "cycle" ? undefined : KNOTS[knot]}
      tube={usePreviewValue(knobs.tube)}
      solids={usePreviewValue(knobs.solids)}
      contours={usePreviewValue(knobs.contours)}
      fx={crt ? undefined : {}}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
