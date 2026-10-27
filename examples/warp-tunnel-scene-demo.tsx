"use client";

import { WarpTunnelScene } from "@/components/asciicn/scenes/warp-tunnel-scene";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/warp-tunnel-scene-controls";
import { CRT_FX } from "@/lib/ascii";

export default function WarpTunnelSceneDemo() {
  const colorMode = usePreviewValue(knobs.colorMode);
  const phosphor = usePreviewValue(knobs.phosphor);
  const ramp = usePreviewValue(knobs.ramp);
  const crt = usePreviewValue(knobs.crt);
  return (
    <WarpTunnelScene
      charset={usePreviewValue(knobs.charset)}
      colorMode={colorMode}
      phosphor={colorMode === "mono" ? phosphor : undefined}
      ramp={ramp}
      fx={crt ? CRT_FX : undefined}
      velocity={usePreviewValue(knobs.velocity)}
      streak={usePreviewValue(knobs.streak)}
      density={usePreviewValue(knobs.density)}
      twist={usePreviewValue(knobs.twist)}
      walls={usePreviewValue(knobs.walls)}
      speed={usePreviewValue(knobs.speed)}
      cell={usePreviewValue(knobs.cell)}
      interactive={usePreviewValue(knobs.interactive)}
      className="absolute inset-0"
    />
  );
}
