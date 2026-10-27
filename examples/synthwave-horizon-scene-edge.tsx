import { SynthwaveHorizonScene } from "@/components/asciicn/scenes/synthwave-horizon-scene";

export default function SynthwaveHorizonSceneEdge() {
  return (
    <SynthwaveHorizonScene
      charset="edge"
      mountains={1.3}
      shimmer={0.2}
      className="absolute inset-0"
    />
  );
}
